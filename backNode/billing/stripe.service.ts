import Stripe from 'stripe';
import { prisma, type TransactionClient } from "./../prisma/singletonPrisma.js"
import { Prisma, PlanName, PlanInterval, SubscriptionStatus, CreditTransactionType } from "@prisma/client"
import { Mailer } from "../src/infrastructure/mailer/classMailer.js"
import type { InvoiceData } from "../src/infrastructure/pdf/invoicePDF.js"
import {
    buildInvoiceNumber,
    buildCustomerInvoiceInfo,
    USER_INVOICE_SELECT,
} from "../src/services/classSubscription.js"

/**
 * Erreur "à rejouer" : levée quand un event Stripe arrive trop tôt (avant que
 * les données dont il dépend soient en base, ex. paiement reçu avant que
 * checkout.session.completed ait lié l'abonnement). Ce n'est pas un bug : on
 * renvoie un 500 pour que Stripe rejoue l'event, sans polluer les logs d'erreur.
 */
class WebhookRetryError extends Error {}


export class StripeLumenJuris {


    private stripeClient = new Stripe(process.env.STRIPE_SK!, {
        maxNetworkRetries: 2,
        telemetry: process.env.NODE_ENV == "dev" ? true : false
    })

    async createCustomer(email: string, name: string) {
        try {
            const params: Stripe.CustomerCreateParams = {
                description: "Client Lumen Juris",
                email,
                name
            }

            const customer: Stripe.Customer = await this.stripeClient.customers.create(params)
            const id = customer.id
            return {
                success: !!id,
                message: id ? "Le nouveau client a été créé dans stripe avec succès" : "Echec, le client stripe n'a pas pu être créé",
                customerId: id
            }
        } catch (err) {
            console.error(`Une erreur est survenue lors de la création d'un customer stripe, error : \n ${err}`)
            return {
                success: false,
                message: "Une erreur est survenue lors de la création d'un customer stripe"
            }
        }
    }



    /**
     * Purge de la table eventStripe après 30 jours. 
     * Les Events stripes sont redéclaché dans un interval de 3 jours max environ.
     * On laisse 30 jours en dur mais c'est variable.
     */
    static async purgeOldProcessedEvents(olderThanDays = 30) {
        try {
            const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
            const deleted = await prisma.processedStripeEvent.deleteMany({
                where: { processedAt: { lt: cutoff } },
            });
            return { success: true, deleted: deleted.count };
        } catch (err) {
            console.error("Erreur lors de la purge des ProcessedStripeEvent :", err);
            return { success: false };
        }
    }


    async handleEvent(event: Stripe.Event) {
        try {

            console.log("Type de l'event Stripe :", event.type)

            switch (event.type) {
                case "checkout.session.completed":
                    //Création de la nouvelle subscription succès, première activation
                    //Commencer a mettre les credits
                    return this.onCheckoutCompleted(event)

                case "invoice.payment_succeeded":
                    //Chaque mois quand un paiment a lieux pour une subscription 
                    return this.onPaymentSucceeded(event)

                case "invoice.payment_failed":
                    //Le paiment d'une subscription a échoué
                    return this.onPaymentFailed(event)

                case "customer.subscription.created":
                    // Création abonnement à un plan
                    return this.onSubscriptionCreated(event)

                case "customer.subscription.updated":
                    //mise à jour d'un plan d'abonnement
                    return this.onSubscriptionUpdated(event)

                case "customer.subscription.deleted":
                    // Résiliation
                    return this.onSubscriptionDeleted(event)

                default:
                    console.error("Evenement Stripe non géré : ", event.type);
                    return {
                        success: true,
                        message: "Event ignoré"
                    }
            }

        } catch (err) {
            console.error(err)
            return {
                success: false
            }
        }
    }


    /**
     * Exécute le traitement métier d'un event Stripe de façon idempotente ET atomique.
     *
     * La marque `ProcessedStripeEvent` et tout le travail `work` sont dans UNE SEULE
     * transaction :
     *  - si `work` échoue -> rollback complet (la marque est annulée) -> Stripe rejouera ;
     *  - si l'event a déjà été traité -> la création de la marque lève P2002 (contrainte
     *    @unique) -> on l'ignore proprement sans retoucher la base.
     * Chaque handler (onCheckoutCompleted, onPaymentSucceeded...) passe par ici et reçoit
     * le client transactionnel `tx` à utiliser pour toutes les écritures de prisma.
     */
    private async processOnce(
        event: Stripe.Event,
        work: (tx: TransactionClient) => Promise<void>,
    ) {
        try {
            await prisma.$transaction(async (tx) => {
                await tx.processedStripeEvent.create({
                    data: { eventId: event.id, type: event.type },
                });
                await work(tx);
            });
            return { success: true };
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
            ) {
                console.log("Event Stripe déjà traité, doublon ignoré :", event.id);
                return { success: true, message: "Event déjà traité (doublon ignoré)" };
            }
            // Event arrivé trop tôt : ce n'est pas une erreur, Stripe le rejouera.
            if (err instanceof WebhookRetryError) {
                console.log(
                    "Event Stripe en attente, sera rejoué par Stripe :",
                    event.id,
                    err.message,
                );
                return { success: false };
            }
            console.error("Echec du traitement de l'event Stripe :", event.id, err);
            return { success: false };
        }
    }


    /**
     * Extrait les quotas *à valeur finie et activée* d'un plan, sous forme
     * { feature -> montant accordé }. Ce sont les seuls qui génèrent une
     * CreditTransaction.
     *  - quota illimité (unlimited) -> ignoré (rien à décompter) ;
     *  - feature désactivée (enabled: false) -> ignorée ;
     *  - features booléennes (droits d'accès) -> jamais retournées.
     */
    private extractFiniteQuotas(creditsIncluded: Prisma.JsonValue): { feature: string; amount: number }[] {
        // Structure attendue (miroir de CreditPlan dans seedPlans.ts)
        type NumericQuota = { unlimited: true } | { unlimited: false; value: number };
        type MeteredQuota = { enabled: false } | { enabled: true; limit: number };
        const q = creditsIncluded as unknown as {
            analyzer?: NumericQuota;
            signatureEnhanced?: MeteredQuota;
            contrathequeLimit?: NumericQuota;
        };

        const result: { feature: string; amount: number }[] = [];

        if (q.analyzer && q.analyzer.unlimited === false) {
            result.push({ feature: "analyzer", amount: q.analyzer.value });
        }
        if (q.contrathequeLimit && q.contrathequeLimit.unlimited === false) {
            result.push({ feature: "contrathequeLimit", amount: q.contrathequeLimit.value });
        }
        if (q.signatureEnhanced && q.signatureEnhanced.enabled === true) {
            result.push({ feature: "signatureEnhanced", amount: q.signatureEnhanced.limit });
        }

        return result;
    }


    /** Converti le statut Stripe(string) en enum prisma SubscriptionStatus. */
    private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
        switch (status) {
            case "active":
            case "trialing":
            case "past_due": // Stripe retente encore -> on garde l'accès actif
                return SubscriptionStatus.ACTIVE;
            case "canceled":
                return SubscriptionStatus.CANCELLED;
            default:
                // incomplete, incomplete_expired, paused, unpaid...
                return SubscriptionStatus.PENDING;
        }
    }



    /**
     * Date de fin de période courante. Depuis l'API v2206, elle n'est plus à la
     * racine de la subscription mais portée par chaque item.
     */
    private readSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
        const periodEnd = subscription.items?.data?.[0]?.current_period_end;
        return typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null;
    }

    //Récupère le priceId de Stripe de la subscription. Ce qui permettra de retrouver le bon plan
    private readSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
        return subscription.items?.data?.[0]?.price?.id ?? null;
    }


    async createPayementIntent(customerId: string, amount: number, autmaticPayment: boolean) {
        try {

            const paymentIntent = await this.stripeClient.paymentIntents.create({
                amount: amount,
                currency: "eur",
                automatic_payment_methods: {
                    enabled: autmaticPayment
                },
                customer: customerId

            })

            const id = paymentIntent.id
            return {
                success: !!id,
                clientSecret: paymentIntent.client_secret,
                message: id
                    ? "Le payment intent a été créé avec succès."
                    : "Le payment intent n'a pas pu être créé.",

            }
        } catch (err) {
            console.error(`Une erreur est survenue lors de la creation d'un payment intent, error : \n ${err}`)
            return {
                success: false,
                message: "Une erreur est survenue lors de la creation d'un payment intent"
            }
        }
    }




    // Stripe création d'une subscription qui se renouvelle -> Initinialisé par le front, c'est ensuite stripe qui 
    // reprend la charge et envera un webhook pour valider le process
    async createCheckout(userId: number, planName: PlanName) {
        const successUrl = `${process.env.HOST_FRONT}/subscription/success`
        const cancelUrl = `${process.env.HOST_FRONT}/subscription/failed`


        const user = await prisma.user.findFirst({
            where: { idUser: userId },
            select: {
                email: true,
                nom: true,
                prenom: true,
                stripeCustomerId: true
            }
        })

        if (!user) {
            return {
                success: false,
                status: 404,
                message: "Utilisateur introuvable."
            }
        }

        // Garde anti-doublon : on refuse un nouveau checkout si l'utilisateur a déjà
        // un abonnement PAYANT actif (vrai abonnement Stripe en cours). Sinon Stripe
        // créerait une 2e subscription qui facturerait en parallèle de l'ancienne.
        // L'upgrade depuis Freemium (pas de stripeSubscriptionId) reste autorisé.
        const existingSubscription = await prisma.subscription.findUnique({
            where: { userId },
            select: { status: true, stripeSubscriptionId: true }
        })
        if (
            existingSubscription?.status === SubscriptionStatus.ACTIVE &&
            existingSubscription.stripeSubscriptionId
        ) {
            return {
                success: false,
                status: 409,
                message: "Vous avez déjà un abonnement actif. Annulez-le avant d'en souscrire un nouveau."
            }
        }

        //recherche du plan dans la bdd
        const plan = await prisma.plan.findFirst({
            where: { name: planName },
            select: {
                stripeProductId: true,
                idPlan: true,
                name: true,
                price: true,
                stripePriceId: true
            }
        })

        //Retour si le plan n'a pas été retrouvé
        if (!plan) {
            return {
                success: false,
                message: "Le plan d'abonnement n'a pas pu être retrouvé",
                status: 404
            }
        }

        // Réutilise le customer existant, sinon en crée un ET le persiste tout de
        // suite : sans ça, chaque checkout abandonné recréerait un customer Stripe
        // (le webhook ne l'enregistre qu'en cas de paiement abouti).
        let customerId = user?.stripeCustomerId ?? undefined;
        if (!customerId) {
            customerId = (await this.createCustomer(user.email, user.nom ? user.nom : user.prenom ?? "Non défini")).customerId;
            if (customerId) {
                await prisma.user.update({
                    where: { idUser: userId },
                    data: { stripeCustomerId: customerId },
                });
            }
        }


        const checkout = await this.stripeClient.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [
                {
                    price: plan.stripePriceId,
                    quantity: 1
                }
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId: userId.toString(),
                planName,
                idPlan: plan.idPlan, //Envoyé pour le récupérer et retrouver le plan correspondant dans notre BDD
            },
            // On recopie les identifiants sur la subscription elle-même, les
            // events qui n'ont pas les metadata de la session (subscription.*,
            // invoice.*) peuvent aussi retrouver l'utilisateur et le plan.
            subscription_data: {
                metadata: {
                    userId: userId.toString(),
                    idPlan: plan.idPlan.toString(),
                }
            }
        })

        const dataCheckout = {
            id: checkout.id,
            url: checkout.url,
            customer: checkout.customer,
            mode: checkout.mode,
            status: checkout.status,
            paymentStatus: checkout.payment_status
        }

        return {
            success: !!checkout,
            data: dataCheckout,
            url: dataCheckout.url
        }
    }


    // Crée une session Stripe Customer Portal : page hébergée par Stripe où le
    // client gère son abonnement (changement de plan, moyen de paiement,
    // annulation, factures). Les changements reviennent via les webhooks
    // customer.subscription.updated / deleted.
    async createPortalSession(userId: number) {
        const user = await prisma.user.findUnique({
            where: { idUser: userId },
            select: { stripeCustomerId: true }
        })

        // Sans customer Stripe (ex : utilisateur Freemium n'ayant jamais payé),
        // il n'y a rien à gérer dans le portail.
        if (!user?.stripeCustomerId) {
            return {
                success: false,
                status: 400,
                message: "Aucun compte de facturation Stripe pour cet utilisateur."
            }
        }

        const session = await this.stripeClient.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            // Retour sur l'onglet Facturation ; `from=portal` indique au front de
            // relire l'abonnement le temps que le webhook de mise à jour arrive.
            return_url: `${process.env.HOST_FRONT}/mon-compte?tab=subscription&from=portal`
        })

        return { success: true, url: session.url }
    }







    //==HANDLE WEBHOOK STRIPE
    // Validation d'un premier achat via Stripe Checkout
    private async onCheckoutCompleted(event: Stripe.Event) {
        return this.processOnce(event, async (tx) => {
            const session = event.data.object as Stripe.Checkout.Session;

            if (!session.metadata) throw new Error("Metadata Stripe checkout.session absente.");

            // Récupérer les metadata posées lors de la création du checkout
            const userId = Number(session.metadata.userId);
            const idPlan = Number(session.metadata.idPlan);
            if (!Number.isInteger(userId) || !Number.isInteger(idPlan)) {
                throw new Error(
                    `Metadata checkout invalides : userId=${session.metadata.userId}, idPlan=${session.metadata.idPlan}`,
                );
            }

            // Dans le webhook, customer et subscription arrivent sous forme de string
            // (non "expanded"). On sécurise quand même le cas objet.
            const stripeCustomerId =
                typeof session.customer === "string"
                    ? session.customer
                    : session.customer?.id ?? null;
            const stripeSubscriptionId =
                typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription?.id ?? null;

            // Vérifier que l'utilisateur existe
            const user = await tx.user.findUnique({
                where: { idUser: userId },
                select: { idUser: true },
            });
            if (!user) {
                throw new Error(`Utilisateur introuvable pour le checkout (userId=${userId})`);
            }

            // Récupérer le plan acheté (intervalle pour les dates, stripePriceId à stocker)
            const plan = await tx.plan.findUnique({
                where: { idPlan },
                select: { idPlan: true, interval: true, stripePriceId: true },
            });
            if (!plan) {
                throw new Error(`Plan introuvable pour le checkout (idPlan=${idPlan})`);
            }

            // Enregistrer le Stripe Customer ID sur l'utilisateur (réutilisé aux prochains achats)
            if (stripeCustomerId) {
                await tx.user.update({
                    where: { idUser: userId },
                    data: { stripeCustomerId },
                });
            }

            // Dates de période provisoires, calculées depuis l'intervalle du plan.
            // Les dates authentiques (current_period_end de Stripe) seront resynchronisées
            // par customer.subscription.created / updated.
            const now = new Date();
            const expiresAt =
                plan.interval === PlanInterval.yearly
                    ? new Date(new Date(now).setFullYear(now.getFullYear() + 1))
                    : new Date(new Date(now).setMonth(now.getMonth() + 1));


            // Créer/associer l'abonnement + stocker les IDs Stripe. Ces IDs sont la clé
            // de correspondance pour les events suivants (invoice.payment_succeeded,
            // customer.subscription.*) qui, eux, n'ont pas nos metadata.
            // NB : les quotas ne sont PAS attribués ici -> c'est invoice.payment_succeeded.
            await tx.subscription.upsert({
                where: { userId },
                create: {
                    userId,
                    planId: plan.idPlan,
                    status: SubscriptionStatus.ACTIVE,
                    startAt: now,
                    expiresAt,
                    stripeSubscriptionId,
                    stripePriceId: plan.stripePriceId,
                },
                update: {
                    planId: plan.idPlan,
                    status: SubscriptionStatus.ACTIVE,
                    startAt: now,
                    expiresAt,
                    stripeSubscriptionId,
                    stripePriceId: plan.stripePriceId,
                },
            });

            console.log(`Checkout complété : abonnement activé pour userId=${userId}, idPlan=${idPlan}`)
        });
    }


    // Paiement d'une facture Stripe (premier paiement + renouvellements)
    private async onPaymentSucceeded(event: Stripe.Event) {
        // Rempli DANS la transaction, envoyé APRES le commit (l'email est un effet
        // externe non annulable). Reste undefined si l'event est un doublon ou une
        // facture hors abonnement -> aucun email envoyé.
        let invoiceEmail:
            | {
                email: string;
                prenom: string | null;
                data: InvoiceData;
            }
            | undefined;



        const result = await this.processOnce(event, async (tx) => {
            const invoice = event.data.object as Stripe.Invoice;

            // Depuis l'API v2206, l'ID de la subscription n'est plus à la racine de
            // l'invoice mais sous parent.subscription_details.subscription.
            const subscriptionDetails = invoice.parent?.subscription_details;
            const stripeSubscriptionId = subscriptionDetails
                ? typeof subscriptionDetails.subscription === "string"
                    ? subscriptionDetails.subscription
                    : subscriptionDetails.subscription?.id ?? null
                : null;

            // Facture hors abonnement (paiement ponctuel) -> rien à créditer ici
            if (!stripeSubscriptionId) {
                console.log("invoice.payment_succeeded sans subscription, ignoré :", invoice.id);
                return;
            }

            // Retrouver NOTRE abonnement via l'ID Stripe (persisté par onCheckoutCompleted)
            let subscription = await tx.subscription.findFirst({
                where: { stripeSubscriptionId },
                include: { plan: true },
            });

            // Lors d'un premier achat, Stripe envoie très souvent invoice.payment_succeeded
            // AVANT checkout.session.completed : l'abonnement n'est donc pas encore lié.
            // On le lie nous-mêmes grâce aux metadata (userId, idPlan) recopiées sur la
            // subscription Stripe par createCheckout (subscription_data.metadata).
            if (!subscription) {
                const metadata = subscriptionDetails?.metadata ?? {};
                const userIdFromMetadata = Number(metadata.userId);
                const idPlanFromMetadata = Number(metadata.idPlan);

                if (!Number.isInteger(userIdFromMetadata) || !Number.isInteger(idPlanFromMetadata)) {
                    // Pas de metadata exploitables : on attend que checkout.session.completed
                    // lie l'abonnement, sinon on réinitialiserait les quotas sur le mauvais plan.
                    throw new WebhookRetryError(`Abonnement pas encore lié pour stripeSubscriptionId=${stripeSubscriptionId}`)
                }

                const planFromMetadata = await tx.plan.findUnique({
                    where: { idPlan: idPlanFromMetadata },
                    select: { idPlan: true, interval: true, stripePriceId: true },
                });
                if (!planFromMetadata) {
                    throw new Error(`Plan introuvable pour la facture (idPlan=${idPlanFromMetadata})`);
                }

                // Même écriture que onCheckoutCompleted (qui la refera sans risque ensuite)
                const now = new Date();
                const firstExpiresAt =
                    planFromMetadata.interval === PlanInterval.yearly
                        ? new Date(new Date(now).setFullYear(now.getFullYear() + 1))
                        : new Date(new Date(now).setMonth(now.getMonth() + 1));

                subscription = await tx.subscription.upsert({
                    where: { userId: userIdFromMetadata },
                    create: {
                        userId: userIdFromMetadata,
                        planId: planFromMetadata.idPlan,
                        status: SubscriptionStatus.ACTIVE,
                        startAt: now,
                        expiresAt: firstExpiresAt,
                        stripeSubscriptionId,
                        stripePriceId: planFromMetadata.stripePriceId,
                    },
                    update: {
                        planId: planFromMetadata.idPlan,
                        status: SubscriptionStatus.ACTIVE,
                        startAt: now,
                        expiresAt: firstExpiresAt,
                        stripeSubscriptionId,
                        stripePriceId: planFromMetadata.stripePriceId,
                    },
                    include: { plan: true },
                });

                console.log(`Abonnement lié depuis la facture (checkout pas encore reçu) : userId=${userIdFromMetadata}`)
            }



            const { userId, plan } = subscription;
            // Réinitialiser les quotas de la période : copie fraîche du plan.
            // Vaut pour le premier paiement ET les renouvellements (mêmes règles).
            await tx.userCredit.upsert({
                where: { userId },
                create: {
                    userId,
                    quotas: plan.creditsIncluded as Prisma.InputJsonValue,
                },
                update: {
                    quotas: plan.creditsIncluded as Prisma.InputJsonValue,
                },
            });

            // Journaliser l'attribution, une ligne par quota à valeur finie.
            // Les features booléennes et les quotas illimités ne sont pas journalisés.
            const finiteQuotas = this.extractFiniteQuotas(plan.creditsIncluded);
            for (const { feature, amount } of finiteQuotas) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        feature,
                        amount, // + montant accordé
                        balanceAfter: amount, // après reset, le restant = le montant plein
                        type: CreditTransactionType.SUBSCRIPTION,
                        description: `Attribution quota ${feature} (plan ${plan.name})`,
                        sourceId: event.id,
                    },
                });
            }

            // Mettre à jour la prochaine échéance depuis l'intervalle du plan
            // (les dates authentiques Stripe sont synchronisées par subscription.updated).
            const now = new Date();
            const expiresAt =
                plan.interval === PlanInterval.yearly
                    ? new Date(new Date(now).setFullYear(now.getFullYear() + 1))
                    : new Date(new Date(now).setMonth(now.getMonth() + 1));

            await tx.subscription.update({
                where: { idSubscription: subscription.idSubscription },
                data: { status: SubscriptionStatus.ACTIVE, expiresAt },
            });

            // Créer la Facture (source de vérité = Stripe). Couvre le premier
            // paiement et les renouvellements.
            const amountPaidCents = invoice.amount_paid ?? 0;
            const facture = await tx.facture.create({
                data: {
                    subscriptionId: subscription.idSubscription,
                    price: amountPaidCents,
                    stripeInvoiceId: invoice.id ?? `stripe_${event.id}`,
                    status: "PAID",
                },
            });

            // Préparer les données de l'email de facture (envoyé après le commit)
            const user = await tx.user.findUnique({
                where: { idUser: userId },
                select: USER_INVOICE_SELECT,
            });
            if (user) {
                invoiceEmail = {
                    email: user.email,
                    prenom: user.prenom,
                    data: {
                        invoiceNumber: buildInvoiceNumber(facture.idFacture, facture.createdAt),
                        date: facture.createdAt,
                        ...buildCustomerInvoiceInfo(user),
                        planName: plan.name,
                        interval: plan.interval,
                        amountTTCCents: amountPaidCents,
                        stripePaymentIntentId: facture.stripeInvoiceId,
                    },
                };
            }

            console.log(
                `Paiement réussi : quotas réinitialisés pour userId=${userId}, plan=${plan.name}`,
            );
        });

        // Effet externe non annulable : hors transaction, uniquement si le travail a
        // réellement tourné (pas un doublon) et si l'utilisateur a été trouvé.
        if (result.success && invoiceEmail) {
            new Mailer(invoiceEmail.email)
                .sendInvoice(invoiceEmail.data, invoiceEmail.prenom ?? undefined)
                .catch((error) =>
                    console.error(
                        "Erreur lors de l'envoi de la facture par email (webhook):",
                        error,
                    ),
                );
        }

        return result;
    }


    // Création d'une subscription : synchronise statut + dates de période réelles.
    private async onSubscriptionCreated(event: Stripe.Event) {
        return this.processOnce(event, async (tx) => {
            const subscription = event.data.object as Stripe.Subscription;

            // On retrouve NOTRE abonnement via l'ID Stripe (posé par onCheckoutCompleted).
            // Si l'ordre des events fait que checkout.completed n'a pas encore tourné,
            // on ne fait rien : la synchro se fera via onSubscriptionUpdated / paiement.
            const local = await tx.subscription.findFirst({
                where: { stripeSubscriptionId: subscription.id },
                select: { idSubscription: true },
            });
            if (!local) {
                console.log(
                    "subscription.created : abonnement local pas encore créé, ignoré :",
                    subscription.id,
                );
                return;
            }

            const expiresAt = this.readSubscriptionPeriodEnd(subscription);
            await tx.subscription.update({
                where: { idSubscription: local.idSubscription },
                data: {
                    status: this.mapStripeSubscriptionStatus(subscription.status),
                    ...(expiresAt ? { expiresAt } : {}),
                },
            });

            console.log("subscription.created synchronisée :", subscription.id);
        });
    }


    // Modification d'une subscription : changement de plan, période, annulation différée.
    private async onSubscriptionUpdated(event: Stripe.Event) {
        return this.processOnce(event, async (tx) => {
            const subscription = event.data.object as Stripe.Subscription;

            const local = await tx.subscription.findFirst({
                where: { stripeSubscriptionId: subscription.id },
                select: { idSubscription: true },
            });
            if (!local) {
                console.log(
                    "subscription.updated : abonnement local introuvable, ignoré :",
                    subscription.id,
                );
                return;
            }

            // Si le priceId courant a changé, on retrouve le plan correspondant pour
            // resynchroniser le lien. (Les quotas, eux, sont réattribués au paiement.)
            const stripePriceId = this.readSubscriptionPriceId(subscription);
            let planId: number | undefined;
            if (stripePriceId) {
                const plan = await tx.plan.findFirst({
                    where: { stripePriceId },
                    select: { idPlan: true },
                });
                if (plan) {
                    planId = plan.idPlan;
                } else {
                    console.warn(
                        "subscription.updated : aucun plan local pour le priceId",
                        stripePriceId,
                    );
                }
            }

            const expiresAt = this.readSubscriptionPeriodEnd(subscription);
            await tx.subscription.update({
                where: { idSubscription: local.idSubscription },
                data: {
                    status: this.mapStripeSubscriptionStatus(subscription.status),
                    ...(planId ? { planId } : {}),
                    ...(stripePriceId ? { stripePriceId } : {}),
                    ...(expiresAt ? { expiresAt } : {}),
                },
            });

            console.log(`subscription.updated synchronisée : ${subscription.id} (annulation différée: ${subscription.cancel_at_period_end})`);
        });
    }


    // Suppression d'une subscription : retour au plan Freemium.
    private async onSubscriptionDeleted(event: Stripe.Event) {
        return this.processOnce(event, async (tx) => {
            const subscription = event.data.object as Stripe.Subscription;

            const local = await tx.subscription.findFirst({
                where: { stripeSubscriptionId: subscription.id },
                select: { idSubscription: true, userId: true },
            });
            if (!local) {
                console.log(
                    "subscription.deleted : abonnement local introuvable, ignoré :",
                    subscription.id,
                );
                return;
            }

            // Plan Freemium = état de repli après résiliation.
            const freemium = await tx.plan.findFirst({
                where: { name: PlanName.Freemium, interval: PlanInterval.monthly },
                select: { idPlan: true, creditsIncluded: true },
            });
            if (!freemium) {
                throw new Error("Plan Freemium introuvable en BDD (résiliation).");
            }

            const now = new Date();
            const expiresAt = new Date(new Date(now).setMonth(now.getMonth() + 1));

            // Basculer l'abonnement sur Freemium et couper le lien Stripe payant.
            await tx.subscription.update({
                where: { idSubscription: local.idSubscription },
                data: {
                    planId: freemium.idPlan,
                    status: SubscriptionStatus.ACTIVE,
                    startAt: now,
                    expiresAt,
                    stripeSubscriptionId: null,
                    stripePriceId: null,
                },
            });

            // Réinitialiser les quotas sur ceux du Freemium.
            await tx.userCredit.upsert({
                where: { userId: local.userId },
                create: {
                    userId: local.userId,
                    quotas: freemium.creditsIncluded as Prisma.InputJsonValue,
                },
                update: {
                    quotas: freemium.creditsIncluded as Prisma.InputJsonValue,
                },
            });

            console.log(`subscription.deleted : userId=${local.userId} repassé en Freemium.`);
        });
    }


    // Paiement refusé : on trace l'échec mais on NE rétrograde PAS.
    // Stripe retente automatiquement les jours suivants 
    // -> du coup c'est customer.subscription.deleted qui déclenchera le retour au Freemium.
    private async onPaymentFailed(event: Stripe.Event) {
        // Rempli DANS la transaction, envoyé APRÈS le commit (effet externe non annulable).
        // Il reste undefined si doublon, échec hors abonnement, ou abonnement local introuvable -> aucun email envoyé.
        let failureEmail:
            | {
                email: string;
                username?: string;
                planName: string;
                amountCents: number;
            }
            | undefined;

        const result = await this.processOnce(event, async (tx) => {
            const invoice = event.data.object as Stripe.Invoice;

            const subscriptionDetails = invoice.parent?.subscription_details;
            const stripeSubscriptionId = subscriptionDetails
                ? typeof subscriptionDetails.subscription === "string"
                    ? subscriptionDetails.subscription
                    : subscriptionDetails.subscription?.id ?? null : null;

            // Échec hors abonnement -> rien à tracer côté abonnement
            if (!stripeSubscriptionId) {
                console.log("invoice.payment_failed sans subscription, ignoré :", invoice.id);
                return
            }

            const subscription = await tx.subscription.findFirst({
                where: { stripeSubscriptionId },
                select: {
                    idSubscription: true,
                    userId: true,
                    plan: { select: { name: true } },
                    user: { select: { email: true, prenom: true } },
                },
            });
            if (!subscription) {
                console.log(
                    "invoice.payment_failed : abonnement local introuvable, ignoré :",
                    stripeSubscriptionId,
                );
                return
            }

            // Tracer la tentative échouée (montant dû, non encaissé).
            const amountDueCents = invoice.amount_due ?? 0;
            await tx.facture.create({
                data: {
                    subscriptionId: subscription.idSubscription,
                    price: amountDueCents,
                    stripeInvoiceId: invoice.id ?? `stripe_${event.id}`,
                    status: "FAILED",
                },
            });

            // Préparer l'email d'information (envoyé après le commit).
            failureEmail = {
                email: subscription.user.email,
                username: subscription.user.prenom ?? undefined,
                planName: subscription.plan.name,
                amountCents: amountDueCents,
            };

            console.log(`invoice.payment_failed tracée pour userId=${subscription.userId} (pas de rétrogradation).`);
        });

        // Effet externe non annulable : hors transaction, seulement si le travail a
        // réellement tourné (pas un doublon) et si l'abonnement a été trouvé.
        if (result.success && failureEmail) {
            new Mailer(failureEmail.email)
                .sendPaymentFailed({
                    username: failureEmail.username,
                    planName: failureEmail.planName,
                    amountCents: failureEmail.amountCents,
                    manageBillingUrl: `${process.env.HOST_FRONT}/mon-compte`,
                })
                .catch((error) =>
                    console.error(
                        "Erreur lors de l'envoi de l'email d'échec de paiement (webhook):",
                        error,
                    ),
                );
        }

        return result;
    }


}