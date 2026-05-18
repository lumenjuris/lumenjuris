import { prisma } from "../../prisma/singletonPrisma";

type PlanSeed = {
  name: string;
  price: number;
  interval: string;
  creditIncluded: number;
};

const PLANS_SEED: PlanSeed[] = [
  {
    name: "Freemium",
    price: 0,
    interval: "month",
    creditIncluded: 500,
  },
  {
    name: "Starter",
    price: 2900,
    interval: "month",
    creditIncluded: 500,
  },
  {
    name: "Starter",
    price: 28800,
    interval: "year",
    creditIncluded: 500,
  },
  {
    name: "Pro",
    price: 7900,
    interval: "month",
    creditIncluded: 2000,
  },
  {
    name: "Pro",
    price: 78000,
    interval: "year",
    creditIncluded: 2000,
  },
];

export async function seedPlans(): Promise<void> {
  for (const plan of PLANS_SEED) {
    const exists = await prisma.plan.findFirst({
      where: { name: plan.name, interval: plan.interval },
    });

    if (!exists) {
      await prisma.plan.create({ data: plan });
    }
  }

  console.log("Plans ready.");
}
