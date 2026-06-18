/**
 * Seed de démonstration pour la Contrathèque.
 *
 * Idempotent : supprime d'abord les contrats/dossiers/tags de démo de l'utilisateur
 * cible (repérés par le préfixe externalId "seed-") puis les recrée.
 *
 * Lancement : npx tsx prisma/seedContratheque.ts [userId]
 * (userId par défaut = 1)
 */
import "dotenv/config";
import crypto from "crypto";
import { prisma } from "./singletonPrisma";

const SEED_PREFIX = "seed-";
const TARGET_USER_ID = Number(process.argv[2] ?? 1);

/** Date relative à aujourd'hui, en jours (négatif = passé). */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function cleanup(userId: number) {
  // Contracts (cascade → metadataFields, amendments, versions, contractTags, auditLogs)
  await prisma.contract.deleteMany({
    where: { userId, externalId: { startsWith: SEED_PREFIX } },
  });
  await prisma.tag.deleteMany({
    where: { userId, externalId: { startsWith: SEED_PREFIX } },
  });
  // Détache d'abord les enfants (self-relation NoAction) avant de supprimer.
  await prisma.folder.updateMany({
    where: { userId, externalId: { startsWith: SEED_PREFIX }, parentId: { not: null } },
    data: { parentId: null },
  });
  await prisma.folder.deleteMany({
    where: { userId, externalId: { startsWith: SEED_PREFIX } },
  });
}

async function main() {
  const user = await prisma.user.findUnique({ where: { idUser: TARGET_USER_ID } });
  if (!user) {
    throw new Error(`Utilisateur idUser=${TARGET_USER_ID} introuvable. Passe un id valide en argument.`);
  }
  console.log(`Seed contrathèque pour ${user.email} (idUser=${user.idUser})`);

  await cleanup(TARGET_USER_ID);

  // ── Dossiers (arborescence) ────────────────────────────────────────────────
  const dossierCommercial = await prisma.folder.create({
    data: { externalId: SEED_PREFIX + crypto.randomUUID(), name: "Commercial", userId: TARGET_USER_ID },
  });
  const dossierFournisseurs = await prisma.folder.create({
    data: {
      externalId: SEED_PREFIX + crypto.randomUUID(),
      name: "Fournisseurs",
      userId: TARGET_USER_ID,
      parentId: dossierCommercial.idFolder,
    },
  });
  const dossierRH = await prisma.folder.create({
    data: { externalId: SEED_PREFIX + crypto.randomUUID(), name: "RH", userId: TARGET_USER_ID },
  });

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tagStrategique = await prisma.tag.create({
    data: { externalId: SEED_PREFIX + crypto.randomUUID(), label: "Stratégique", color: "#dc2626", userId: TARGET_USER_ID },
  });
  const tagVigilance = await prisma.tag.create({
    data: { externalId: SEED_PREFIX + crypto.randomUUID(), label: "À surveiller", color: "#f59e0b", userId: TARGET_USER_ID },
  });
  const tagB2C = await prisma.tag.create({
    data: { externalId: SEED_PREFIX + crypto.randomUUID(), label: "B2C / Chatel", color: "#7c3aed", userId: TARGET_USER_ID },
  });

  // ── Helper de création de contrat + métadonnées + audit ──────────────────────
  type FieldSeed = {
    fieldKey: string;
    value: string;
    confidenceScore: number;
    validationStatus?: "AI_SUGGESTED" | "HUMAN_VALIDATED" | "HUMAN_CORRECTED";
  };

  async function makeContract(opts: {
    title: string;
    contractType: string;
    counterpartyName: string;
    status: "DRAFT" | "IN_NEGOTIATION" | "ACTIVE" | "TACIT_RENEWAL" | "EXPIRED" | "TERMINATED";
    signatureDate?: Date | null;
    effectiveDate?: Date | null;
    endDate?: Date | null;
    renewalType?: "NONE" | "TACIT" | "EXPRESS";
    noticePeriodDays?: number | null;
    isB2C?: boolean;
    amount?: number | null;
    governingLaw?: string;
    folderId?: number | null;
    tagIds?: number[];
    fields: FieldSeed[];
  }) {
    const contract = await prisma.contract.create({
      data: {
        externalId: SEED_PREFIX + crypto.randomUUID(),
        title: opts.title,
        contractType: opts.contractType,
        counterpartyName: opts.counterpartyName,
        responsibleName: "Margaux Chauvin",
        status: opts.status,
        signatureDate: opts.signatureDate ?? null,
        effectiveDate: opts.effectiveDate ?? null,
        endDate: opts.endDate ?? null,
        renewalType: opts.renewalType ?? "NONE",
        noticePeriodDays: opts.noticePeriodDays ?? null,
        isB2C: opts.isB2C ?? false,
        amount: opts.amount ?? null,
        currency: "EUR",
        governingLaw: opts.governingLaw ?? "Droit français",
        userId: TARGET_USER_ID,
        folderId: opts.folderId ?? null,
        metadataFields: {
          create: opts.fields.map((f) => ({
            fieldKey: f.fieldKey,
            value: f.value,
            confidenceScore: f.confidenceScore,
            validationStatus: f.validationStatus ?? "AI_SUGGESTED",
            validatedById: f.validationStatus && f.validationStatus !== "AI_SUGGESTED" ? TARGET_USER_ID : null,
            validatedAt: f.validationStatus && f.validationStatus !== "AI_SUGGESTED" ? new Date() : null,
          })),
        },
      },
    });

    if (opts.tagIds?.length) {
      await prisma.contractTag.createMany({
        data: opts.tagIds.map((tagId) => ({ contractId: contract.idContract, tagId })),
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "IMPORT",
        entityType: "Contract",
        entityId: contract.externalId,
        payloadAfter: { title: opts.title, status: opts.status },
        userId: TARGET_USER_ID,
        contractId: contract.idContract,
      },
    });

    return contract;
  }

  // ── Contrats de démo couvrant tous les cas KPI ──────────────────────────────

  // 1. Actif, échéance dans 45j (urgence < 90j), tacite reconduction B2B
  const c1 = await makeContract({
    title: "Contrat de prestation SaaS — CloudNova",
    contractType: "Prestation de services",
    counterpartyName: "CloudNova SAS",
    status: "TACIT_RENEWAL",
    signatureDate: daysFromNow(-320),
    effectiveDate: daysFromNow(-320),
    endDate: daysFromNow(45),
    renewalType: "TACIT",
    noticePeriodDays: 60,
    isB2C: false,
    amount: 48000,
    folderId: dossierFournisseurs.idFolder,
    tagIds: [tagStrategique.idTag, tagVigilance.idTag],
    fields: [
      { fieldKey: "contract_type", value: "Prestation de services", confidenceScore: 0.97, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "amount", value: "48000", confidenceScore: 0.91, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "notice_period_days", value: "60", confidenceScore: 0.73, validationStatus: "HUMAN_CORRECTED" },
      { fieldKey: "governing_law", value: "Droit français", confidenceScore: 0.99, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "renewal_type", value: "tacite", confidenceScore: 0.62, validationStatus: "AI_SUGGESTED" },
    ],
  });

  // Avenant + version sur le contrat 1
  await prisma.amendment.create({
    data: {
      externalId: SEED_PREFIX + crypto.randomUUID(),
      title: "Avenant n°1 — extension de périmètre",
      signatureDate: daysFromNow(-120),
      effectiveDate: daysFromNow(-120),
      summary: "Ajout du module analytics, +12 000 € / an.",
      parentContractId: c1.idContract,
    },
  });
  await prisma.contractVersion.create({
    data: { versionNumber: 1, note: "Version initiale signée.", createdById: TARGET_USER_ID, contractId: c1.idContract },
  });
  await prisma.contractVersion.create({
    data: { versionNumber: 2, note: "Intègre l'avenant n°1.", createdById: TARGET_USER_ID, contractId: c1.idContract },
  });
  await prisma.auditLog.create({
    data: {
      action: "AMENDMENT_ADDED", entityType: "Contract", entityId: c1.externalId,
      payloadAfter: { amendment: "Avenant n°1" }, userId: TARGET_USER_ID, contractId: c1.idContract,
    },
  });

  // 2. Abonnement B2C — tacite reconduction, loi Chatel (différenciateur)
  await makeContract({
    title: "Abonnement logiciel — particulier (offre Pro)",
    contractType: "Abonnement",
    counterpartyName: "Jean Dupont",
    status: "ACTIVE",
    signatureDate: daysFromNow(-200),
    effectiveDate: daysFromNow(-200),
    endDate: daysFromNow(75),
    renewalType: "TACIT",
    noticePeriodDays: 30,
    isB2C: true,
    amount: 240,
    folderId: dossierCommercial.idFolder,
    tagIds: [tagB2C.idTag, tagVigilance.idTag],
    fields: [
      { fieldKey: "contract_type", value: "Abonnement", confidenceScore: 0.95, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "is_b2c", value: "true", confidenceScore: 0.88, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "renewal_type", value: "tacite", confidenceScore: 0.81, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "notice_period_days", value: "30", confidenceScore: 0.69, validationStatus: "AI_SUGGESTED" },
    ],
  });

  // 3. Actif, sans date de fin renseignée (KPI "sans date de fin")
  await makeContract({
    title: "Accord-cadre de confidentialité (NDA)",
    contractType: "NDA",
    counterpartyName: "BioTech Partners",
    status: "ACTIVE",
    signatureDate: daysFromNow(-90),
    effectiveDate: daysFromNow(-90),
    endDate: null,
    renewalType: "NONE",
    isB2C: false,
    amount: null,
    folderId: dossierRH.idFolder,
    fields: [
      { fieldKey: "contract_type", value: "NDA", confidenceScore: 0.93, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "governing_law", value: "Droit français", confidenceScore: 0.98, validationStatus: "AI_SUGGESTED" },
    ],
  });

  // 4. En négociation (brouillon avancé)
  await makeContract({
    title: "Contrat de distribution — Iberia Retail",
    contractType: "Distribution",
    counterpartyName: "Iberia Retail SL",
    status: "IN_NEGOTIATION",
    signatureDate: null,
    effectiveDate: null,
    endDate: daysFromNow(400),
    renewalType: "EXPRESS",
    noticePeriodDays: 90,
    isB2C: false,
    amount: 150000,
    governingLaw: "Droit français",
    folderId: dossierCommercial.idFolder,
    tagIds: [tagStrategique.idTag],
    fields: [
      { fieldKey: "contract_type", value: "Distribution", confidenceScore: 0.86, validationStatus: "AI_SUGGESTED" },
      { fieldKey: "amount", value: "150000", confidenceScore: 0.54, validationStatus: "AI_SUGGESTED" },
      { fieldKey: "governing_law", value: "Droit espagnol ?", confidenceScore: 0.41, validationStatus: "AI_SUGGESTED" },
    ],
  });

  // 5. Échu
  await makeContract({
    title: "Bail commercial — local Lyon 3e",
    contractType: "Bail commercial",
    counterpartyName: "SCI Part-Dieu",
    status: "EXPIRED",
    signatureDate: daysFromNow(-1500),
    effectiveDate: daysFromNow(-1500),
    endDate: daysFromNow(-30),
    renewalType: "EXPRESS",
    noticePeriodDays: 180,
    isB2C: false,
    amount: 36000,
    folderId: dossierCommercial.idFolder,
    fields: [
      { fieldKey: "contract_type", value: "Bail commercial", confidenceScore: 0.96, validationStatus: "HUMAN_VALIDATED" },
      { fieldKey: "amount", value: "36000", confidenceScore: 0.9, validationStatus: "HUMAN_VALIDATED" },
    ],
  });

  // 6. Brouillon fraîchement importé (tout en AI_SUGGESTED, à revoir)
  await makeContract({
    title: "Contrat de maintenance — à valider",
    contractType: "Maintenance",
    counterpartyName: "TechServ",
    status: "DRAFT",
    signatureDate: null,
    effectiveDate: null,
    endDate: daysFromNow(365),
    renewalType: "NONE",
    isB2C: false,
    amount: 9000,
    folderId: dossierFournisseurs.idFolder,
    fields: [
      { fieldKey: "contract_type", value: "Maintenance", confidenceScore: 0.78 },
      { fieldKey: "amount", value: "9000", confidenceScore: 0.66 },
      { fieldKey: "notice_period_days", value: "30", confidenceScore: 0.5 },
    ],
  });

  // ── Résumé ───────────────────────────────────────────────────────────────────
  const total = await prisma.contract.count({ where: { userId: TARGET_USER_ID, externalId: { startsWith: SEED_PREFIX } } });
  console.log(`✔ ${total} contrats de démo créés, 3 dossiers, 3 tags, avenants + versions + audit.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
