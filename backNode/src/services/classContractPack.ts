import fs from "fs/promises";
import path from "path";
import { BillingOneShotStatus, DeliveryStatus, LivrableKind } from "@prisma/client";
import { prisma } from "../../prisma/singletonPrisma.js";
import { decryptBuffer, encryptBuffer } from "./encryption.js";
import { documentFromPlainText, isContractNode, readContractBlocks, readContractFields } from "./contractDocument.js";
import { generateContractPDF, generateContractSummaryPDF } from "../infrastructure/pdf/contractPackPDF.js";
import { generateContractDocx } from "../infrastructure/docx/contractDocx.js";
import { Mailer } from "../infrastructure/mailer/classMailer.js";

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

export class ContractPack {

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
    const generated = await this.generateDeliverables(idBilling);
    if (!generated) return;

    const purchase = await prisma.billingOneShot.findUnique({ where: { idBilling }, select: { emailSentAt: true } });
    // Pas de second e-mail si l'event a déjà été livré (rejeu Stripe)
    if (purchase?.emailSentAt) return;

    const sent = await this.sendDeliveryEmail(idBilling);
    if (!sent) console.error(`E-mail des livrables non envoyé pour l'achat ${idBilling}`);
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

  /** Renvoie l'e-mail des livrables à la demande de l'utilisateur (régénère si besoin). */
  async resendEmail(userId: number, idBilling: number): Promise<boolean> {
    const purchase = await this.findPaidPurchase(userId, idBilling);
    if (!purchase) return false;

    if (purchase.deliveryStatus !== DeliveryStatus.READY) {
      const regenerated = await this.generateDeliverables(idBilling);
      if (!regenerated) return false;
    }
    return this.sendDeliveryEmail(idBilling);
  }
}
