import "dotenv/config";
import { prisma } from "./prisma/singletonPrisma.js";
import { Credit } from "./src/services/classCredit.js";

/**
 * Tâches planifiées de backNode, lancées par le cron de cPanel.
 *
 * Pourquoi un fichier séparé : en production, Passenger (cPanel) arrête le
 * serveur quand il n'y a pas de trafic, donc un setInterval dans index.ts ne
 * se déclencherait pas de façon fiable. Ce script tourne indépendamment du
 * serveur : il fait son travail, puis s'arrête.
 *
 * Lancement (après `npm run build`) :
 *   npm run cron            (équivaut à : node dist/cron.js)
 *
 * Commande à configurer dans cPanel > Tâches Cron, 1 fois par jour (ex : 3h) :
 *   0 3 * * * cd /home/<compte>/<chemin>/backNode && /home/<compte>/nodevenv/<chemin>/backNode/<version>/bin/node dist/cron.js >> cron.log 2>&1
 * (le chemin exact de node est indiqué dans cPanel > Setup Node.js App)
 */
async function runCron(): Promise<void> {
  console.log(`[cron] Démarrage : ${new Date().toISOString()}`);

  // Remise à niveau mensuelle des quotas (plans gratuits et plans annuels).
  // Sans risque si le cron tourne plusieurs fois : chaque abonnement n'est
  // remis à niveau qu'une fois par mois.
  const refillResult = await new Credit().refillMonthlyQuotas();
  console.log(`[cron] Quotas : ${refillResult.message}`);

  if (!refillResult.success) {
    throw new Error("La remise à niveau des quotas a rencontré des erreurs.");
  }
};


runCron()
  .then(() => {
    console.log("[cron] Terminé avec succès.");
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error("[cron] Échec :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
