/**
 * Charge et met en forme toutes les données de la page d'accueil.
 *
 * Un seul hook pour toute la page : les appels réseau partent en parallèle et
 * chacun retombe sur une valeur vide en cas d'erreur, pour qu'un module
 * indisponible ne vide jamais le tableau de bord entier.
 */
import { useEffect, useMemo, useState } from "react";

import { fetchProxy } from "../../../utils/fetchProxy";
import { useUserStore } from "../../../store/userStore";
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
  DeadlineCard, KpiCard, OnboardingStep, QueueItem, QuotaBar, QuotaState, RiskAlert,
  SignatureEnvelope,
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

/**
 * Construit les statistiques compactes de l'en-tête.
 *
 * Le `hint` n'est renseigné que lorsqu'il ajoute vraiment une information
 * (retards, propositions reçues, plafond de la formule) : sur une ligne aussi
 * dense, un « aucune » de plus ne serait que du bruit.
 */
function buildKpis(raw: RawData, queue: QueueItem[]): KpiCard[] {
  const contractTotal = raw.contractStats?.total ?? 0;

  const pendingSignatures = queue.filter((item) => item.group === "Signature").length;
  const openNegotiations = queue.filter((item) => item.group === "Négociation").length;
  const proposals = raw.negotiations.reduce((sum, n) => sum + n.counts.proposals, 0);

  const soon = raw.deadlines.filter((event) => (daysUntil(event.date) ?? 999) <= 30);
  const overdue = soon.filter((event) => (daysUntil(event.date) ?? 0) < 0).length;

  return [
    {
      // Toujours affiché : c'est le repère de volume de l'espace de travail.
      label: contractTotal > 1 ? "contrats suivis" : "contrat suivi",
      value: contractTotal,
      hint: "",
      toneClassName: "text-white/45",
      hideWhenZero: false,
      to: "/contratheque",
    },
    {
      label: pendingSignatures > 1 ? "signatures en attente" : "signature en attente",
      value: pendingSignatures,
      hint: "",
      toneClassName: "text-white/45",
      hideWhenZero: true,
      to: "/signature",
    },
    {
      label: openNegotiations > 1 ? "négociations ouvertes" : "négociation ouverte",
      value: openNegotiations,
      hint: proposals > 0 ? `· ${plural(proposals, "proposition")}` : "",
      toneClassName: "text-[#b9a7ee]",
      hideWhenZero: true,
      to: "/negociations",
    },
    {
      label: soon.length > 1 ? "échéances à 30 jours" : "échéance à 30 jours",
      value: soon.length,
      hint: overdue > 0 ? `· ${plural(overdue, "en retard")}` : "",
      toneClassName: "text-[#ff8f96]",
      hideWhenZero: true,
      to: "/contratheque?vue=echeances",
    },
  ];
}

/**
 * Construit les trois étapes de prise en main.
 *
 * Elles suivent le parcours naturel de l'outil (rédiger → négocier → signer) et
 * se cochent à partir des données déjà chargées : aucun état n'est stocké.
 */
function buildOnboarding(raw: RawData): OnboardingStep[] {
  return [
    {
      key: "premier-contrat",
      title: "Ajoutez un premier contrat",
      description: "Générez-en un depuis un brief, ou importez un document existant.",
      done: (raw.contractStats?.total ?? 0) > 0,
      actionLabel: "Commencer",
      to: "/contrat-generation?section=scratch",
    },
    {
      key: "premiere-negociation",
      title: "Ouvrez une négociation",
      description: "Partagez le document, recevez les propositions et tranchez.",
      done: raw.negotiations.length > 0,
      actionLabel: "Ouvrir",
      to: "/negociations",
    },
    {
      key: "premiere-signature",
      title: "Envoyez en signature",
      description: "Faites signer en ligne, avec valeur probante.",
      done: raw.envelopes.length > 0,
      actionLabel: "Envoyer",
      to: "/signature",
    },
  ];
}

/** Construit les prochaines échéances (les plus proches d'abord). */
function buildDeadlines(raw: RawData): DeadlineCard[] {
  return [...raw.deadlines]
    .sort((a, b) => timestamp(a.date) - timestamp(b.date))
    .slice(0, 5)
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
}[] = [
  { key: "contrathequeLimit", label: "Contrats suivis" },
  { key: "analyzer", label: "Analyses de contrat" },
  { key: "signatureEnhanced", label: "Signatures avancées" },
];

/** À partir de ce pourcentage consommé, la jauge passe en orange. */
const QUOTA_WARNING_PERCENT = 80;

/** Pourcentage borné à [0, 100] ; renvoie 0 si le total est nul. */
function ratio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/** Construit les jauges de consommation de la formule. */
function buildQuotas(raw: RawData): QuotaBar[] {
  const contractTotal = raw.contractStats?.total ?? 0;

  return QUOTA_FEATURES.map(({ key, label }) => {
    const full = readQuotaValue(raw.credits?.planQuotas?.[key]);
    const remaining = readQuotaValue(raw.credits?.quotas?.[key]);

    if (full.kind === "unlimited") {
      return { label, text: "Illimité", percent: 100, state: "unlimited" as const };
    }
    // Un plafond à zéro revient à ne pas inclure la fonctionnalité.
    if (full.kind === "disabled" || full.value <= 0) {
      return { label, text: "Non inclus", percent: 0, state: "disabled" as const };
    }

    // La contrathèque est un plafond de stockage et non un compteur consommé :
    // on part du nombre réel de contrats, sinon le chiffre contredirait celui
    // affiché en haut de la page.
    const consumed = key === "contrathequeLimit"
      ? contractTotal
      : full.value - (remaining.kind === "finite" ? remaining.value : 0);

    const used = Math.max(0, Math.min(consumed, full.value));
    const percent = ratio(used, full.value);

    let state: QuotaState = "ok";
    if (used >= full.value) state = "full";
    else if (percent >= QUOTA_WARNING_PERCENT) state = "warning";

    return { label, text: `${used} / ${full.value}`, percent, state };
  });
}

/** Tout ce dont la page d'accueil a besoin pour s'afficher. */
export interface DashboardData {
  loading: boolean;
  /**
   * Vrai quand la page est consultée sans compte. Les blocs affichent alors une
   * présentation de l'outil au lieu de données personnelles, et aucun appel
   * réseau n'est lancé.
   */
  isGuest: boolean;
  /** Vrai quand l'utilisateur n'a encore ni contrat, ni signature, ni négociation. */
  isEmpty: boolean;
  kpis: KpiCard[];
  /** Nombre total d'éléments en attente, hors contrats suivis. */
  pendingActions: number;
  queue: QueueItem[];
  deadlines: DeadlineCard[];
  alerts: RiskAlert[];
  onboarding: OnboardingStep[];
  /** Vrai quand les trois étapes de prise en main sont franchies. */
  onboardingCompleted: boolean;
  quotas: QuotaBar[];
  planName: string;
  /** Compteurs affichés en indice sur les cartes de modules. */
  moduleCounts: { contracts: number; negotiations: number; signatures: number; alerts: number };
}

export function useDashboardData(): DashboardData {
  const authStatus = useUserStore((state) => state.authStatus);
  const isGuest = authStatus === "unauthenticated";
  // Tant que le cookie est en cours de vérification, on reste en chargement :
  // ça évite d'afficher l'accueil visiteur une seconde avant l'accueil connecté.
  const checkingSession = authStatus === "idle" || authStatus === "loading";

  const [raw, setRaw] = useState<RawData>(EMPTY_RAW);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Visiteur : toutes ces APIs répondraient 401, on ne les appelle pas.
    if (isGuest) {
      setRaw(EMPTY_RAW);
      setLoading(false);
      return;
    }
    if (checkingSession) {
      setLoading(true);
      return;
    }

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
  }, [isGuest, checkingSession]);

  return useMemo(() => {
    const queue = buildQueue(raw);
    const alerts = buildAlerts(raw);
    const contracts = raw.contractStats?.total ?? 0;
    const onboarding = buildOnboarding(raw);

    return {
      loading,
      isGuest,
      isEmpty:
        !loading
        && contracts === 0
        && raw.envelopes.length === 0
        && raw.negotiations.length === 0,
      kpis: buildKpis(raw, queue),
      pendingActions: queue.length,
      queue,
      deadlines: buildDeadlines(raw),
      alerts,
      onboarding,
      onboardingCompleted: !loading && onboarding.every((step) => step.done),
      quotas: buildQuotas(raw),
      planName: raw.planName ?? "Découverte",
      moduleCounts: {
        contracts,
        negotiations: queue.filter((item) => item.group === "Négociation").length,
        signatures: queue.filter((item) => item.group === "Signature").length,
        alerts: alerts.length,
      },
    };
  }, [raw, loading, isGuest]);
}
