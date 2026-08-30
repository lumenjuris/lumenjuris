/**
 * Charge et met en forme toutes les données de la page d'accueil.
 *
 * Un seul hook pour toute la page : les appels réseau partent en parallèle et
 * chacun retombe sur une valeur vide en cas d'erreur, pour qu'un module
 * indisponible ne vide jamais le tableau de bord entier.
 */
import { useEffect, useMemo, useState } from "react";

import { fetchProxy } from "../../../utils/fetchProxy";
import { contractApi } from "../contratheque/api";
import { negotiationApi } from "../negotiation/api";
import { DEADLINE_SHORT, daysUntil } from "../contratheque/types";
import type {
  ContractListItem, ContractStats, DeadlineEvent,
} from "../contratheque/types";
import type { NegotiationListItem } from "../negotiation/types";
import type { CreditsData } from "../../../types/creditsData";
import { readQuotaValue } from "../../../types/quotas";
import type { SubscriptionData } from "../../../types/subscriptionData";
import type {
  DeadlineCard, KpiCard, QueueItem, QuotaBar, RiskAlert, SignatureEnvelope,
} from "./types";

/** Statuts d'un contrat encore en cours de rédaction / discussion. */
const CONTRACT_IN_PROGRESS: string[] = ["DRAFT", "IN_NEGOTIATION"];
/** Statuts d'une enveloppe qui demande encore une action de l'utilisateur. */
const ENVELOPE_PENDING: string[] = ["DRAFT", "SENT", "PARTIALLY_SIGNED"];
/** Statuts d'une négociation encore ouverte. */
const NEGOTIATION_OPEN: string[] = ["DRAFT", "IN_NEGOTIATION", "BLOCKED"];

/** Au-delà de ce délai sans signature, on propose de relancer le cocontractant. */
const RELANCE_AFTER_DAYS = 7;
/** Horizon de chargement des échéances (en jours). */
const DEADLINE_HORIZON_DAYS = 90;
/** Nombre de contrats récents lus pour alimenter la file « À traiter ». */
const CONTRACTS_PAGE_SIZE = 50;

const MONTHS_SHORT = [
  "janv", "févr", "mars", "avr", "mai", "juin",
  "juil", "août", "sept", "oct", "nov", "déc",
];

/** « il y a 3 h » / « il y a 2 j » à partir d'une date ISO. */
function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "—";
  const minutes = Math.floor((Date.now() - time) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Timestamp d'une date ISO, 0 si absente ou invalide (sert au tri). */
function timestamp(iso: string | null): number {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Pourcentage borné à [0, 100] ; renvoie 0 si le total est nul. */
function ratio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/** Accorde le pluriel d'un mot selon le nombre : « 2 propositions ». */
function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** Données brutes rassemblées par les appels réseau. */
interface RawData {
  contractStats: ContractStats | null;
  contracts: ContractListItem[];
  deadlines: DeadlineEvent[];
  envelopes: SignatureEnvelope[];
  negotiations: NegotiationListItem[];
  planName: string | null;
  credits: CreditsData | null;
}

const EMPTY_RAW: RawData = {
  contractStats: null,
  contracts: [],
  deadlines: [],
  envelopes: [],
  negotiations: [],
  planName: null,
  credits: null,
};

/** Exécute une promesse en retombant sur `fallback` si elle échoue. */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("[dashboard] chargement partiel :", error);
    return fallback;
  }
}

/** GET /api/signature-envelope — toutes les enveloppes de l'utilisateur. */
async function fetchEnvelopes(): Promise<SignatureEnvelope[]> {
  const response = await fetchProxy("/api/signature-envelope", { credentials: "include" });
  const body = (await response.json()) as { success?: boolean; data?: SignatureEnvelope[] };
  return body.success && body.data ? body.data : [];
}

/** GET /api/billing/subscription — formule en cours + crédits restants. */
async function fetchBilling(): Promise<{ planName: string | null; credits: CreditsData | null }> {
  const response = await fetchProxy("/api/billing/subscription", { credentials: "include" });
  const body = (await response.json()) as {
    success?: boolean;
    data?: { subscription?: SubscriptionData | null; credits?: CreditsData | null };
  };
  if (!body.success || !body.data) return { planName: null, credits: null };
  return {
    planName: body.data.subscription?.planName ?? null,
    credits: body.data.credits ?? null,
  };
}

/** Construit la file « À traiter » à partir des trois modules concernés. */
function buildQueue(raw: RawData): QueueItem[] {
  const items: QueueItem[] = [];

  // Contrats encore en rédaction ou en discussion dans la contrathèque.
  for (const contract of raw.contracts) {
    if (!CONTRACT_IN_PROGRESS.includes(contract.status)) continue;
    items.push({
      key: `contrat-${contract.id}`,
      group: "Rédaction",
      title: contract.title,
      meta: contract.counterpartyName ?? contract.contractType ?? "Sans cocontractant",
      due: relativeTime(contract.updatedAt),
      isUrgent: false,
      action: "Reprendre",
      to: `/contratheque/${contract.id}`,
      updatedAt: timestamp(contract.updatedAt),
    });
  }

  // Enveloppes de signature en attente d'envoi ou de signature.
  for (const envelope of raw.envelopes) {
    if (!ENVELOPE_PENDING.includes(envelope.status)) continue;
    const isDraft = envelope.status === "DRAFT";
    // daysUntil est négatif pour une date passée : on l'inverse pour obtenir l'attente.
    const waitingDays = envelope.sentAt ? -(daysUntil(envelope.sentAt) ?? 0) : 0;
    const needsRelance = !isDraft && waitingDays >= RELANCE_AFTER_DAYS;
    items.push({
      key: `signature-${envelope.id}`,
      group: "Signature",
      title: envelope.documentName,
      meta: isDraft ? "Brouillon d'enveloppe" : `Envoyé à ${envelope.counterpartyName}`,
      due: needsRelance ? "À relancer" : relativeTime(envelope.sentAt ?? envelope.updatedAt),
      isUrgent: needsRelance,
      action: isDraft ? "Reprendre" : "Suivre",
      to: "/signature",
      updatedAt: timestamp(envelope.updatedAt),
    });
  }

  // Négociations ouvertes : les propositions reçues passent en tête de file.
  for (const negotiation of raw.negotiations) {
    if (!NEGOTIATION_OPEN.includes(negotiation.status)) continue;
    const proposals = negotiation.counts.proposals;
    const completion = negotiation.completion;

    let meta = "Aucune modification proposée";
    if (proposals > 0) meta = `${plural(proposals, "proposition")} à traiter`;
    else if (completion) meta = `Complétion ${completion.filled}/${completion.total} champs`;

    let due = relativeTime(negotiation.updatedAt);
    if (negotiation.status === "BLOCKED") due = "Bloquée";
    else if (proposals > 0) due = "À répondre";

    items.push({
      key: `negociation-${negotiation.id}`,
      group: "Négociation",
      title: negotiation.title,
      meta,
      due,
      isUrgent: proposals > 0 || negotiation.status === "BLOCKED",
      action: "Répondre",
      to: `/negociation/${negotiation.id}`,
      updatedAt: timestamp(negotiation.updatedAt),
    });
  }

  // Les lignes urgentes d'abord, puis les plus récemment modifiées.
  return items.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/** Construit les quatre statistiques de l'en-tête. */
function buildKpis(raw: RawData, queue: QueueItem[]): KpiCard[] {
  const contractTotal = raw.contractStats?.total ?? 0;
  const contractLimit = readQuotaValue(raw.credits?.planQuotas?.contrathequeLimit);

  const pendingSignatures = queue.filter((item) => item.group === "Signature").length;
  const openNegotiations = queue.filter((item) => item.group === "Négociation").length;
  const proposals = raw.negotiations.reduce((sum, n) => sum + n.counts.proposals, 0);

  const soon = raw.deadlines.filter((event) => (daysUntil(event.date) ?? 999) <= 30);
  const overdue = soon.filter((event) => (daysUntil(event.date) ?? 0) < 0).length;

  let contractHint = "—";
  if (contractLimit.kind === "finite") contractHint = `sur ${contractLimit.value}`;
  else if (contractLimit.kind === "unlimited") contractHint = "illimité";

  let contractPercent = contractTotal > 0 ? 100 : 0;
  if (contractLimit.kind === "finite") contractPercent = ratio(contractTotal, contractLimit.value);

  return [
    {
      label: "Contrats suivis",
      value: contractTotal,
      hint: contractHint,
      toneClassName: "text-white/55",
      barClassName: "bg-white",
      barPercent: contractPercent,
      to: "/contratheque",
    },
    {
      label: "Signatures en attente",
      value: pendingSignatures,
      hint: pendingSignatures > 0 ? "à suivre" : "aucune",
      toneClassName: "text-[#f0c86a]",
      barClassName: "bg-[#f0c86a]",
      barPercent: ratio(pendingSignatures, raw.envelopes.length),
      to: "/signature",
    },
    {
      label: "Négociations",
      value: openNegotiations,
      hint: proposals > 0 ? plural(proposals, "proposition") : "aucune réponse",
      toneClassName: "text-[#b9a7ee]",
      barClassName: "bg-[#b9a7ee]",
      barPercent: ratio(openNegotiations, raw.negotiations.length),
      to: "/negociations",
    },
    {
      label: "Échéances à 30 j",
      value: soon.length,
      hint: overdue > 0 ? plural(overdue, "en retard") : "à venir",
      toneClassName: overdue > 0 ? "text-[#ff8f96]" : "text-white/55",
      barClassName: "bg-[#ff8f96]",
      barPercent: ratio(soon.length, raw.deadlines.length),
      to: "/contratheque?vue=echeances",
    },
  ];
}

/** Construit les prochaines échéances (les plus proches d'abord). */
function buildDeadlines(raw: RawData): DeadlineCard[] {
  return [...raw.deadlines]
    .sort((a, b) => timestamp(a.date) - timestamp(b.date))
    .slice(0, 4)
    .map((event) => {
      const date = new Date(event.date);
      const remaining = daysUntil(event.date) ?? 0;
      const party = [
        event.counterpartyName,
        event.noticePeriodDays ? `préavis ${event.noticePeriodDays} jours` : null,
      ].filter(Boolean).join(" · ");

      return {
        key: `${event.contractId}-${event.type}`,
        day: String(date.getDate()).padStart(2, "0"),
        month: MONTHS_SHORT[date.getMonth()],
        title: event.contractTitle,
        party: party || "Sans cocontractant",
        tag: DEADLINE_SHORT[event.type],
        tagClassName: remaining < 15 ? "text-red-primary" : "text-warning",
        to: `/contratheque/${event.contractId}`,
      };
    });
}

/** Construit les alertes de conformité à partir des données déjà chargées. */
function buildAlerts(raw: RawData): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const stats = raw.contractStats;

  const overdue = raw.deadlines.filter((event) => (daysUntil(event.date) ?? 0) < 0).length;
  if (overdue > 0) {
    alerts.push({
      key: "echeances-depassees",
      level: "high",
      title: `${plural(overdue, "échéance")} dépassée${overdue > 1 ? "s" : ""}`,
      detail: "Ces contrats ont dépassé leur date de fin sans renouvellement enregistré.",
      to: "/contratheque?vue=echeances",
    });
  }

  const blocked = raw.negotiations.filter((n) => n.status === "BLOCKED").length;
  if (blocked > 0) {
    alerts.push({
      key: "negociations-bloquees",
      level: "high",
      title: `${plural(blocked, "négociation")} bloquée${blocked > 1 ? "s" : ""}`,
      detail: "Un désaccord empêche la validation de la version finale.",
      to: "/negociations",
    });
  }

  if (stats && stats.tacitRenewal > 0) {
    alerts.push({
      key: "tacite-reconduction",
      level: "medium",
      title: `${plural(stats.tacitRenewal, "contrat")} en tacite reconduction`,
      detail: "Vérifiez les délais de préavis pour ne pas repartir pour une période.",
      to: "/contratheque?vue=echeances",
    });
  }

  if (stats && stats.withoutEndDate > 0) {
    alerts.push({
      key: "sans-date-de-fin",
      level: "medium",
      title: `${plural(stats.withoutEndDate, "contrat")} sans date de fin`,
      detail: "Sans date d'échéance renseignée, aucun rappel ne peut être déclenché.",
      to: "/contratheque",
    });
  }

  return alerts.slice(0, 3);
}

/** Features consommables affichées en jauge dans la carte « Votre abonnement ». */
const QUOTA_FEATURES: {
  key: "contrathequeLimit" | "analyzer" | "signatureEnhanced";
  label: string;
  barClassName: string;
}[] = [
  { key: "contrathequeLimit", label: "Contrats suivis", barClassName: "bg-blue-primary" },
  { key: "analyzer", label: "Analyses de contrat", barClassName: "bg-[#354F99]" },
  { key: "signatureEnhanced", label: "Signatures avancées", barClassName: "bg-[#6b86d6]" },
];

/** Construit les jauges de consommation de la formule. */
function buildQuotas(raw: RawData): QuotaBar[] {
  return QUOTA_FEATURES.map(({ key, label, barClassName }) => {
    const full = readQuotaValue(raw.credits?.planQuotas?.[key]);
    const remaining = readQuotaValue(raw.credits?.quotas?.[key]);

    if (full.kind === "disabled") {
      return { label, text: "Non inclus", percent: 0, barClassName: "bg-line-emphasis" };
    }
    if (full.kind === "unlimited") {
      return { label, text: "Illimité", percent: 100, barClassName };
    }

    const used = full.value - (remaining.kind === "finite" ? remaining.value : 0);
    return { label, text: `${used} / ${full.value}`, percent: ratio(used, full.value), barClassName };
  });
}

/** Tout ce dont la page d'accueil a besoin pour s'afficher. */
export interface DashboardData {
  loading: boolean;
  /** Vrai quand l'utilisateur n'a encore ni contrat, ni signature, ni négociation. */
  isEmpty: boolean;
  kpis: KpiCard[];
  queue: QueueItem[];
  deadlines: DeadlineCard[];
  alerts: RiskAlert[];
  quotas: QuotaBar[];
  planName: string;
  /** Compteurs affichés en indice sur les cartes de modules. */
  moduleCounts: { contracts: number; negotiations: number; signatures: number; alerts: number };
}

export function useDashboardData(): DashboardData {
  const [raw, setRaw] = useState<RawData>(EMPTY_RAW);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [contractStats, contracts, deadlines, envelopes, negotiations, billing] =
        await Promise.all([
          safe(contractApi.stats(), null as ContractStats | null),
          safe(
            contractApi.list({ pageSize: CONTRACTS_PAGE_SIZE, sortBy: "createdAt", sortDir: "desc" }),
            { items: [] as ContractListItem[], total: 0 },
          ),
          safe(contractApi.deadlines(DEADLINE_HORIZON_DAYS), [] as DeadlineEvent[]),
          safe(fetchEnvelopes(), [] as SignatureEnvelope[]),
          safe(negotiationApi.list(), [] as NegotiationListItem[]),
          safe(fetchBilling(), { planName: null as string | null, credits: null as CreditsData | null }),
        ]);

      if (cancelled) return;

      setRaw({
        contractStats,
        contracts: contracts.items,
        deadlines,
        envelopes,
        negotiations,
        planName: billing.planName,
        credits: billing.credits,
      });
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const queue = buildQueue(raw);
    const alerts = buildAlerts(raw);
    const contracts = raw.contractStats?.total ?? 0;

    return {
      loading,
      isEmpty:
        !loading
        && contracts === 0
        && raw.envelopes.length === 0
        && raw.negotiations.length === 0,
      kpis: buildKpis(raw, queue),
      queue,
      deadlines: buildDeadlines(raw),
      alerts,
      quotas: buildQuotas(raw),
      planName: raw.planName ?? "Découverte",
      moduleCounts: {
        contracts,
        negotiations: queue.filter((item) => item.group === "Négociation").length,
        signatures: queue.filter((item) => item.group === "Signature").length,
        alerts: alerts.length,
      },
    };
  }, [raw, loading]);
}
