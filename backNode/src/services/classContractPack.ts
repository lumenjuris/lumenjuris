import fs from "fs/promises";
import path from "path";
import { BillingOneShotStatus, DeliveryStatus, LivrableKind, Prisma } from "@prisma/client";
import { prisma } from "../../prisma/singletonPrisma.js";
import { decryptBuffer, encryptBuffer } from "./encryption.js";
import { documentFromPlainText, isContractNode, readContractBlocks, readContractFields, type ContractBlock } from "./contractDocument.js";
import { generateContractPDF, generateContractSummaryPDF, type AiContractSummary } from "../infrastructure/pdf/contractPackPDF.js";
import { generateContractDocx } from "../infrastructure/docx/contractDocx.js";
import { Mailer } from "../infrastructure/mailer/classMailer.js";
import { Credit } from "./classCredit.js";

/**
 * Livrables d'un achat unitaire (« Pack Contrat ») : PDF sans filigrane, Word
 * modifiable et fiche de synthèse.
 *
 * Cycle de vie :
 *  1. le webhook confirme le paiement puis appelle `deliver` (hors transaction) ;
 *  2. `generateDeliverables` construit les fichiers à partir du contenu de
 *     l'éditeur reçu au checkout (ou du texte du contrat en contrathèque à défaut),
 *     les chiffre dans ./livrables/<userId>/<idBilling>/ et les enregistre en base ;
 *  3. `sendDeliveryEmail` les envoie en pièces jointes ;
 *  4. si la génération a échoué, `getFile` la relance à la demande.
 */

// Dossier dédié aux livrables, à côté de ./contracts (PDF de la contrathèque)
const LIVRABLES_DIR = path.join(process.cwd(), "livrables");

// Proxy : seul endroit où sont construits les prompts IA (route interne, clé partagée)
const PROXY_URL = process.env.PROXY_URL || "http://localhost:3000";
// gpt-5.2 sur un contrat complet : on laisse le temps de répondre, sans bloquer indéfiniment
const AI_SUMMARY_TIMEOUT_MS = 120_000;

const LIVRABLE_FILES: Record<LivrableKind, { label: string; suffix: string; contentType: string }> = {
  [LivrableKind.PDF]: {
    label: "Contrat PDF sans filigrane",
    suffix: ".pdf",
    contentType: "application/pdf",
  },
  [LivrableKind.DOCX]: {
    label: "Contrat Word (.docx) modifiable",
    suffix: ".docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  [LivrableKind.FICHE]: {
    label: "Fiche de synthèse (PDF)",
    suffix: "-fiche-synthese.pdf",
    contentType: "application/pdf",
  },
};

export type LivrableFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

/** Référence d'achat lisible, reprise sur la fiche de synthèse (ex : LJ-PACK-00012). */
function buildPurchaseReference(idBilling: number): string {
  return `LJ-PACK-${String(idBilling).padStart(5, "0")}`;
}

/** Nom de fichier sûr à partir du titre du contrat. */
function toFileBase(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, "").trim();
  return cleaned || "contrat";
}

/** La synthèse IA stockée est un objet JSON (pas une liste ni une valeur simple). */
function isAiSummary(value: unknown): value is AiContractSummary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texte brut du contrat envoyé à l'IA : titres et paragraphes séparés par une ligne vide. */
function blocksToText(blocks: ContractBlock[]): string {
  return blocks.map((block) => block.text).join("\n\n");
}

export class ContractPack {

  /**
   * Demande au proxy la synthèse IA du contrat (gpt-5.2, prompt « Comprendre
   * contrat »). Renvoie null en cas d'échec : la fiche est alors générée sans IA,
   * la livraison n'est jamais bloquée. Aucun quota n'est consommé.
   */
  private async requestAiSummary(blocks: ContractBlock[], userId: number): Promise<AiContractSummary | null> {
    try {
      const response = await fetch(`${PROXY_URL}/api/internal/contract-pack/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({ contractText: blocksToText(blocks), userId }),
        signal: AbortSignal.timeout(AI_SUMMARY_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(`Synthèse IA de la fiche refusée par le proxy (HTTP ${response.status})`);
        return null;
      }
      const data = await response.json();
      return isAiSummary(data?.data) ? data.data : null;
    } catch (err) {
      console.error("Synthèse IA de la fiche indisponible, fiche générée sans IA :", err);
      return null;
    }
  }

  /** Contrat de la contrathèque rattaché à l'achat (titre et texte déchiffrés par l'extension Prisma). */
  private async findPurchasedContract(userId: number, contractRef: string) {
    return prisma.contract.findFirst({
      where: { externalId: contractRef, userId },
      select: { title: true, contractType: true, createdAt: true, ocrText: true },
    });
  }

  /**
   * Génère les trois livrables d'un achat payé et les stocke chiffrés.
   * Renvoie false (et passe l'achat en FAILED) si la génération est impossible.
   */
  async generateDeliverables(idBilling: number): Promise<boolean> {
    try {
      const purchase = await prisma.billingOneShot.findUnique({ where: { idBilling } });
      if (!purchase || purchase.status !== BillingOneShotStatus.PAID) return false;

      const contract = await this.findPurchasedContract(purchase.userId, purchase.contractRef);

      // Source : contenu de l'éditeur reçu au checkout, sinon texte de la contrathèque
      // (achat antérieur ou contenu absent) avec des titres non distingués.
      const document = isContractNode(purchase.documentContent)
        ? purchase.documentContent
        : contract?.ocrText?.trim()
          ? documentFromPlainText(contract.ocrText)
          : null;

      if (!document) {
        console.error(`Livrables impossibles : aucun contenu pour l'achat ${idBilling}`);
        await prisma.billingOneShot.update({ where: { idBilling }, data: { deliveryStatus: DeliveryStatus.FAILED } });
        return false;
      }

      const title = contract?.title || "Contrat";
      const blocks = readContractBlocks(document);

      // Synthèse IA de la fiche : réutilisée si déjà obtenue (régénération sans
      // nouvel appel IA), sinon demandée au proxy puis gardée sur l'achat.
      let aiSummary: AiContractSummary | null = isAiSummary(purchase.aiSummary) ? purchase.aiSummary : null;
      if (!aiSummary) {
        aiSummary = await this.requestAiSummary(blocks, purchase.userId);
        if (aiSummary) {
          await prisma.billingOneShot.update({
            where: { idBilling },
            data: { aiSummary: aiSummary as Prisma.InputJsonValue },
          });
        }
      }

      const buffers: Record<LivrableKind, Buffer> = {
        [LivrableKind.PDF]: await generateContractPDF(title, blocks),
        [LivrableKind.DOCX]: await generateContractDocx(blocks),
        [LivrableKind.FICHE]: await generateContractSummaryPDF({
          contractTitle: title,
          contractType: contract?.contractType ?? null,
          createdAt: contract?.createdAt ?? purchase.createdAt,
          fields: readContractFields(document),
          articleTitles: blocks.filter((block) => block.kind === "heading").map((block) => block.text),
          purchaseReference: buildPurchaseReference(idBilling),
          paidAt: purchase.paidAt,
          aiSummary, // null : fiche sans IA (repli)
        }),
      };

      const purchaseDir = path.join(LIVRABLES_DIR, String(purchase.userId), String(idBilling));
      await fs.mkdir(purchaseDir, { recursive: true });

      for (const kind of Object.values(LivrableKind)) {
        const filePath = path.join(purchaseDir, `${kind.toLowerCase()}.enc`);
        await fs.writeFile(filePath, encryptBuffer(buffers[kind]));

        // Une régénération remplace le fichier précédent du même type
        await prisma.livrableAchat.upsert({
          where: { billingOneShotId_kind: { billingOneShotId: idBilling, kind } },
          create: { billingOneShotId: idBilling, kind, filePath },
          update: { filePath },
        });
      }

      await prisma.billingOneShot.update({ where: { idBilling }, data: { deliveryStatus: DeliveryStatus.READY } });
      return true;
    } catch (err) {
      console.error(`Echec de génération des livrables de l'achat ${idBilling} :`, err);
      await prisma.billingOneShot
        .update({ where: { idBilling }, data: { deliveryStatus: DeliveryStatus.FAILED } })
        .catch(() => undefined);
      return false;
    }
  }

  /** Lit et déchiffre un livrable déjà généré. Renvoie null si le fichier manque sur le disque. */
  private async readLivrable(idBilling: number, kind: LivrableKind, fileBase: string): Promise<LivrableFile | null> {
    const livrable = await prisma.livrableAchat.findUnique({
      where: { billingOneShotId_kind: { billingOneShotId: idBilling, kind } },
    });
    if (!livrable) return null;

    try {
      const encrypted = await fs.readFile(livrable.filePath);
      return {
        buffer: decryptBuffer(encrypted),
        filename: `${fileBase}${LIVRABLE_FILES[kind].suffix}`,
        contentType: LIVRABLE_FILES[kind].contentType,
      };
    } catch (err) {
      console.error(`Livrable ${kind} illisible pour l'achat ${idBilling} :`, err);
      return null;
    }
  }

  /** Nom de fichier des livrables : titre du contrat acheté. */
  private async fileBaseOf(userId: number, contractRef: string): Promise<string> {
    const contract = await this.findPurchasedContract(userId, contractRef);
    return toFileBase(contract?.title ?? "contrat");
  }

  /** Envoie les livrables en pièces jointes à l'acheteur. */
  async sendDeliveryEmail(idBilling: number): Promise<boolean> {
    const purchase = await prisma.billingOneShot.findUnique({
      where: { idBilling },
      select: { userId: true, contractRef: true, user: { select: { email: true, prenom: true } } },
    });
    if (!purchase) return false;

    const contract = await this.findPurchasedContract(purchase.userId, purchase.contractRef);
    const fileBase = toFileBase(contract?.title ?? "contrat");

    const attachments: { label: string; filename: string; content: Buffer; contentType: string }[] = [];
    for (const kind of Object.values(LivrableKind)) {
      const file = await this.readLivrable(idBilling, kind, fileBase);
      if (!file) return false; // livraison incomplète : on n'envoie pas un e-mail partiel
      attachments.push({
        label: LIVRABLE_FILES[kind].label,
        filename: file.filename,
        content: file.buffer,
        contentType: file.contentType,
      });
    }

    const result = await new Mailer(purchase.user.email).sendContractPack({
      username: purchase.user.prenom ?? undefined,
      contractTitle: contract?.title ?? "Votre contrat",
      contractUrl: `${process.env.HOST_FRONT}/contratheque/${encodeURIComponent(purchase.contractRef)}`,
      attachments,
    });

    if (!result.success) return false;
    await prisma.billingOneShot.update({ where: { idBilling }, data: { emailSentAt: new Date() } });
    return true;
  }

  /**
   * Livraison après paiement : génération puis e-mail. Appelée par le webhook
   * APRÈS le commit (effet externe), jamais bloquante pour Stripe.
   */
  async deliver(idBilling: number): Promise<void> {
    // Le crédit de génération d'un contrat acheté n'est pas consommé : on le rend
    // avant de livrer (indépendant de la génération des documents).
    await this.refundGenerationCredit(idBilling);

    const generated = await this.generateDeliverables(idBilling);
    if (!generated) return;

    const purchase = await prisma.billingOneShot.findUnique({ where: { idBilling }, select: { emailSentAt: true } });
    // Pas de second e-mail si l'event a déjà été livré (rejeu Stripe)
    if (purchase?.emailSentAt) return;

    const sent = await this.sendDeliveryEmail(idBilling);
    if (!sent) console.error(`E-mail des livrables non envoyé pour l'achat ${idBilling}`);
  }

  /**
   * Rend le crédit « Créer de zéro » consommé pour rédiger un contrat acheté.
   * Une seule fois par achat (sourceId) ; sans effet si le contrat ne vient pas
   * de « Créer de zéro » ou si aucun crédit n'a été consommé sur la période.
   */
  async refundGenerationCredit(idBilling: number): Promise<void> {
    const purchase = await prisma.billingOneShot.findUnique({
      where: { idBilling },
      select: { userId: true, status: true, refundGenerationCredit: true, generationCreditRefundedAt: true },
    });
    if (!purchase || purchase.status !== BillingOneShotStatus.PAID) return;
    if (!purchase.refundGenerationCredit || purchase.generationCreditRefundedAt) return;

    const result = await new Credit().refundQuota(
      purchase.userId,
      "generatorFromScratch",
      `contract-pack-${idBilling}`,
      `Crédit rendu : contrat acheté à l'unité (${buildPurchaseReference(idBilling)})`,
    );
    if (!result.success) {
      console.error(`Crédit de génération non rendu pour l'achat ${idBilling} :`, result.message);
      return;
    }
    await prisma.billingOneShot.update({ where: { idBilling }, data: { generationCreditRefundedAt: new Date() } });
  }

  /** Achat payé appartenant à l'utilisateur (contrôle d'accès), sinon null. */
  private async findPaidPurchase(userId: number, idBilling: number) {
    return prisma.billingOneShot.findFirst({
      where: { idBilling, userId, status: BillingOneShotStatus.PAID },
      select: { idBilling: true, contractRef: true, deliveryStatus: true },
    });
  }

  /** Achats payés de l'utilisateur, avec l'état de livraison des documents. */
  async listPurchases(userId: number) {
    const purchases = await prisma.billingOneShot.findMany({
      where: { userId, status: BillingOneShotStatus.PAID },
      orderBy: { paidAt: "desc" },
      select: {
        idBilling: true,
        item: true,
        contractRef: true,
        paidAt: true,
        deliveryStatus: true,
        emailSentAt: true,
        livrables: { select: { kind: true } },
      },
    });

    return purchases.map(({ livrables, ...purchase }) => ({
      ...purchase,
      availableFiles: livrables.map((livrable) => livrable.kind),
    }));
  }

  /**
   * Fichier d'un achat de l'utilisateur. Si les livrables n'ont pas été générés
   * (ou ont échoué), la génération est relancée à la demande.
   */
  async getFile(userId: number, idBilling: number, kind: LivrableKind): Promise<LivrableFile | null> {
    const purchase = await this.findPaidPurchase(userId, idBilling);
    if (!purchase) return null;

    const fileBase = await this.fileBaseOf(userId, purchase.contractRef);
    const file = await this.readLivrable(idBilling, kind, fileBase);
    if (file) return file;

    const regenerated = await this.generateDeliverables(idBilling);
    if (!regenerated) return null;
    return this.readLivrable(idBilling, kind, fileBase);
  }

  /**
   * Renvoie l'e-mail des livrables à la demande de l'utilisateur (régénère si besoin).
   * `not_found` : achat inexistant, non payé ou appartenant à un autre utilisateur.
   */
  async resendEmail(userId: number, idBilling: number): Promise<"sent" | "not_found" | "failed"> {
    const purchase = await this.findPaidPurchase(userId, idBilling);
    if (!purchase) return "not_found";

    if (purchase.deliveryStatus !== DeliveryStatus.READY) {
      const regenerated = await this.generateDeliverables(idBilling);
      if (!regenerated) return "failed";
    }
    return (await this.sendDeliveryEmail(idBilling)) ? "sent" : "failed";
  }
}
