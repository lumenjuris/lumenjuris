import { logger } from "./logger/logger.js";
import { prisma } from "./singletonPrisma.js";
import { Prisma, PlanInterval, PlanName } from "@prisma/client";

/**
 * Création de tous les plans d'abonnement dans la base de données
 * 
 * Comprend actuellement : 
 * -Freemium
 * -Betatesteur
 * -Starter monthly
 * -Starter yearly
 * -Pro monthly
 * -Pro yearly
 */

type Quota = { unlimited: true } | { unlimited: false, value: number } // Outil limité sur Quotas
type Feature = { enabled: true } | { enabled: false } // Outil limité sur boolean
type QuotaFeature = { enabled: false } | { enabled: true, value: number } // Outil limité sur boolean et si true quotas

type CreditPlan = {
    //Outil sur Quotas
    analyzer: Quota;
    analyzerPlaybook: Quota;
    contrathequeLimit: Quota;
    generatorFromScratch: Quota;
    generatorImport: Quota;
    signature: Quota;
    comprendreContrat: Quota;

    //Outil sur Feature
    chatJuridique: Feature;
    generationContractWithFiligrane: Feature;

    //Outil sur feature ET quotas
    signatureEnhanced: QuotaFeature;
};

interface PlanSeed {
    name: PlanName;
    price: number;
    interval: PlanInterval;
    creditsIncluded: CreditPlan;
};

type StripeId = {
    production: string;
    teste: string;
};

type StripePlan = {
    productId: StripeId;
    priceId: StripeId;
};

type StripeProductId = Record<PaidPlanName, StripePlan>;

type PaidPlanName = Exclude<
    typeof PlanName[keyof typeof PlanName],
    "Freemium" | "Betatesteur"
>;

const stripeProductId: StripeProductId = {
    [PlanName.Starter_mensuel]: {
        productId: {
            production: "xxx",
            teste: "prod_Uzwv74n813QFUj"
        },
        priceId: {
            production: "xxx",
            teste: "price_1Tzx1pHjiTZrRhmvwc77AaOP",
        }
    },
    [PlanName.Starter_annuel]: {
        productId: {
            production: "xxx",
            teste: "prod_UzwvInSRbmCi3q"
        },
        priceId: {
            production: "xxx",
            teste: "price_1Tzx1QHjiTZrRhmvhBjNoTWP",
        }
    },
    [PlanName.Pro_mensuel]: {
        productId: {
            production: "xxx",
            teste: "prod_Uzwy9wCTYQtRfr"
        },
        priceId: {
            production: "xxx",
            teste: "price_1Tzx4LHjiTZrRhmvGvNeGbJj",
        }
    },
    [PlanName.Pro_annuel]: {
        productId: {
            production: "xxx",
            teste: "prod_UzwyQfcdBdU0w2"
        },
        priceId: {
            production: "xxx",
            teste: "price_1Tzx4uHjiTZrRhmv24NjwbKr",
        }
    },

}

const PLANS_SEED = [
    // - FREEMIUM
    {
        name: PlanName.Freemium,
        price: 0,
        interval: PlanInterval.monthly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 3
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 5
            },
            contrathequeLimit: {
                unlimited: false,
                value: 5
            },
            generatorFromScratch: {
                unlimited: false,
                value: 5
            },
            generatorImport: {
                unlimited: false,
                value: 10
            },
            signature: {
                unlimited: false,
                value: 5
            },
            comprendreContrat: {
                unlimited: false,
                value: 5
            },

            //Tools Feature
            chatJuridique: {
                enabled: false
            },
            generationContractWithFiligrane: { enabled: true },

            //FeatureQuota
            signatureEnhanced: { enabled: false },
        },
    },

    //Plan pour beta testeur qui sera valide deux mois. Equivalent d'un plan starter
    {
        name: PlanName.Betatesteur,
        price: 0,
        interval: PlanInterval.monthly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 30
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 60
            },
            contrathequeLimit: {
                unlimited: false,
                value: 300
            },
            generatorFromScratch: {
                unlimited: false,
                value: 30
            },
            generatorImport: {
                unlimited: false,
                value: 60
            },
            signature: {
                unlimited: false,
                value: 30
            },
            comprendreContrat: {
                unlimited: false,
                value: 50
            },

            //Tools Feature
            chatJuridique: {
                enabled: true
            },
            generationContractWithFiligrane: { enabled: false },

            //FeatureQuota
            signatureEnhanced: { enabled: false },
        }
    },

    //STARTER mois:49€ | année:468€(39€/mois)
    {
        name: PlanName.Starter_mensuel,
        price: 49_00,
        interval: PlanInterval.monthly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 30
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 60
            },
            contrathequeLimit: {
                unlimited: false,
                value: 300
            },
            generatorFromScratch: {
                unlimited: false,
                value: 30
            },
            generatorImport: {
                unlimited: false,
                value: 60
            },
            signature: {
                unlimited: false,
                value: 30
            },
            comprendreContrat: {
                unlimited: false,
                value: 50
            },

            //Tools Feature
            chatJuridique: {
                enabled: true
            },
            generationContractWithFiligrane: { enabled: false },

            //FeatureQuota
            signatureEnhanced: { enabled: false },
        }
    },

    {
        name: PlanName.Starter_annuel,
        price: 468_00,
        interval: PlanInterval.yearly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 30
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 60
            },
            contrathequeLimit: {
                unlimited: false,
                value: 300
            },
            generatorFromScratch: {
                unlimited: false,
                value: 30
            },
            generatorImport: {
                unlimited: false,
                value: 60
            },
            signature: {
                unlimited: false,
                value: 30
            },
            comprendreContrat: {
                unlimited: false,
                value: 50
            },

            //Tools Feature
            chatJuridique: {
                enabled: true
            },
            generationContractWithFiligrane: { enabled: false },

            //FeatureQuota
            signatureEnhanced: { enabled: false },
        }
    },

    //PRO mois:119€ | année:1188€(99€/mois)
    {
        name: PlanName.Pro_mensuel,
        price: 119_00,
        interval: PlanInterval.monthly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 100
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 120
            },
            contrathequeLimit: {
                unlimited: false,
                value: 1200
            },
            generatorFromScratch: {
                unlimited: false,
                value: 100
            },
            generatorImport: {
                unlimited: false,
                value: 150
            },
            signature: {
                unlimited: true
            },
            comprendreContrat: {
                unlimited: true
            },

            //Tools Feature
            chatJuridique: {
                enabled: true
            },
            generationContractWithFiligrane: { enabled: false },

            //FeatureQuota
            signatureEnhanced: { enabled: true, value: 10 },
        },
    },
    {
        name: PlanName.Pro_annuel,
        price: 1_188_00,
        interval: PlanInterval.yearly,
        creditsIncluded: {
            analyzer: {
                unlimited: false,
                value: 100
            },
            analyzerPlaybook: {
                unlimited: false,
                value: 120
            },
            contrathequeLimit: {
                unlimited: false,
                value: 1200
            },
            generatorFromScratch: {
                unlimited: false,
                value: 100
            },
            generatorImport: {
                unlimited: false,
                value: 150
            },
            signature: {
                unlimited: true
            },
            comprendreContrat: {
                unlimited: true
            },

            //Tools Feature
            chatJuridique: {
                enabled: true
            },
            generationContractWithFiligrane: { enabled: false },

            //FeatureQuota
            signatureEnhanced: { enabled: true, value: 10 },
        },
    },

] satisfies PlanSeed[];

export async function seedPlans(): Promise<void> {
    try {

        const stripeEnv = process.env.STRIPE_ENV;
        if (stripeEnv !== "production" && stripeEnv !== "teste") {
            logger.error("Echec lors de l'introduction seedPlan", {
                error: `Variable d'env STRIPE_ENV invalide : "${stripeEnv}". Doit être : "production" ou "teste".`
            })
            throw new Error(
                `Variable d'env STRIPE_ENV invalide : "${stripeEnv}". Doit être : "production" ou "teste".`
            );
        }

        for (const plan of PLANS_SEED) {

            const stripePlan = stripeProductId[plan.name as PaidPlanName];

            const data = {
                ...plan,
                creditsIncluded: plan.creditsIncluded as Prisma.InputJsonValue,
                stripeProductId: stripePlan ? stripePlan.productId[stripeEnv] : "",
                stripePriceId: stripePlan ? stripePlan.priceId[stripeEnv] : "",
            };

            await prisma.plan.upsert({
                where: {
                    name_interval: {
                        name: plan.name,
                        interval: plan.interval,
                    }
                },
                create: data,
                update: data
            });
        }
        logger.info("Les seeds de Plan sont injectés avec succès.");
    } catch (err) {
        logger.error("Une erreur est survenue lors de l'initialisation des seeds \"Plan\"", { error: err });
        throw err;
    }
}
