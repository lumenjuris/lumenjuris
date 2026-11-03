import { logger } from "../src/logger/logger.js";
import { prisma } from "./singletonPrisma.js";
import { ItemVente } from "@prisma/client";

// Seed de tout les article à vendre de façon unitaire (hors souscription)

type StripeId = {
    live: string;
    teste: string;
};

type StripeItem = {
    productId: StripeId;
    priceId: StripeId;
};

type StripeItemId = Record<ItemVente, StripeItem>;

// Identifiants Stripe de chaque article, à renseigner depuis le dashboard Stripe.
// Tant que le productId ou le priceId de l'environnement est vide, l'article n'est
// pas créé : il ne peut pas être acheté.
const stripeItemId: StripeItemId = {
    // Génération de contrat : débloque le contrat généré sans filigrane
    [ItemVente.CONTRACT_SANS_FILIGRANE]: {
        productId: {
            live: "prod_VY59Bu24H38W7I",
            teste: "prod_VY5ClZQNh9KsSA",
        },
        priceId: {
            live: "price_1UWyzGHo9nqLjCW8DO1R5KK1",
            teste: "price_1UWz2GHjiTZrRhmvrRtHXHRF",
        }
    },
};

export async function seedItemBilling(): Promise<void> {
    try {

        const stripeEnv = process.env.STRIPE_ENV;

        if (stripeEnv !== "live" && stripeEnv !== "teste") {
            logger.error("Echec lors de l'introduction seedItemBilling", {
                error: `Variable d'env STRIPE_ENV invalide : "${stripeEnv}". Doit être : "live" ou "teste".`
            })
            throw new Error(
                `Variable d'env STRIPE_ENV invalide : "${stripeEnv}". Doit être : "live" ou "teste".`
            );
        }

        for (const [item, stripeItem] of Object.entries(stripeItemId) as [ItemVente, StripeItem][]) {

            const data = {
                item,
                stripeProductId: stripeItem.productId[stripeEnv],
                stripePriceId: stripeItem.priceId[stripeEnv],
            };

            if (!data.stripeProductId || !data.stripePriceId) {
                logger.warn(`Article ${item} non créé : productId ou priceId Stripe "${stripeEnv}" non renseigné dans seedItemBilling.`);
                continue;
            }

            await prisma.itemBilling.upsert({
                where: { item },
                create: data,
                update: data
            });
        }
        logger.info("Les seeds de ItemBilling sont injectés avec succès.");
    } catch (err) {
        logger.error("Une erreur est survenue lors de l'initialisation des seeds \"ItemBilling\"", { error: err });
        throw err;
    }
}
