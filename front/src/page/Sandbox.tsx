/**
 * Onboarding — formulaire d'accueil des nouveaux utilisateurs.
 *
 * Tout tient provisoirement dans ce fichier (page Sandbox). Il est découpé en
 * sections indépendantes, dans l'ordre où elles devront être extraites :
 *
 *   1. Référentiel   — étapes, listes de réponses, libellés      → onboarding/constants.ts
 *   2. API           — appels proxy (réponses, entreprise)       → onboarding/api.ts
 *   3. Logique       — hook `useOnboardingForm`                  → onboarding/useOnboardingForm.ts
 *   4. Briques UI    — cartes, pastilles, titres                 → onboarding/ui.tsx
 *   5. Étapes        — un composant par écran                    → onboarding/steps/*.tsx
 *   6. Fenêtre       — `OnboardingForm` (coquille + navigation)  → onboarding/OnboardingForm.tsx
 *   7. Page Sandbox  — banc d'essai, à supprimer après déplacement
 *
 * ⚠ Les codes de réponse de la section 1 doivent rester identiques à ceux de
 * `backNode/src/services/classUserMetadata.ts` : le serveur refuse un code inconnu.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FolderOpen,
  Handshake,
  Library,
  Loader2,
  Lock,
  MessageSquare,
  PenLine,
  PenTool,
  ScanSearch,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";

import { Input } from "../components/ui/Input";
import { useCompanyLookup } from "../hooks/useCompanyLookup";
import { selectShouldShowOnboarding, useUserStore } from "../store/userStore";
import type { CompanyResult } from "../types/companySearch";
import type { OnboardingData, OnboardingPatch } from "../types/onboarding";
import type { UserData } from "../types/userData";
import { formatCompanyOption, mapCompanyToEnterprise } from "../utils/companyLookup";
import { fetchProxy } from "../utils/fetchProxy";
import { cn } from "../utils/shadcnUtils/cn";

/* ════════════════════════════════════════════════════════════════════════════
   1. RÉFÉRENTIEL — étapes, listes de réponses, libellés
   ════════════════════════════════════════════════════════════════════════════ */

type StepId = "intent" | "profession" | "activity" | "enterprise";

/**
 * Étapes du formulaire. `index` est l'identifiant envoyé au serveur
 * (`currentStep`) : il ne change pas même quand une étape est masquée, pour que
 * les statistiques d'abandon restent comparables entre utilisateurs.
 */
const STEPS: { id: StepId; index: number; label: string }[] = [
  { id: "intent", index: 0, label: "Vos priorités" },
  { id: "profession", index: 1, label: "Votre profil" },
  { id: "activity", index: 2, label: "Votre activité" },
  { id: "enterprise", index: 3, label: "Votre structure" },
];

/** Outils proposés à la première étape. `to` est la page ouverte en fin de parcours. */
const INTENT_OPTIONS: {
  code: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
}[] = [
  {
    code: "analyze_contract",
    title: "Analyser un contrat",
    description: "Repérer les clauses à risque d'un contrat reçu",
    to: "/analyzer",
    icon: ScanSearch,
  },
  {
    code: "generate_contract",
    title: "Rédiger un contrat",
    description: "Partir d'un modèle ou d'une page blanche",
    to: "/generateur",
    icon: PenLine,
  },
  {
    code: "negotiation",
    title: "Négocier",
    description: "Échanger les versions avec l'autre partie",
    to: "/negociations",
    icon: Handshake,
  },
  {
    code: "esignature",
    title: "Faire signer",
    description: "Envoyer un contrat en signature électronique",
    to: "/signature",
    icon: PenTool,
  },
  {
    code: "contract_library",
    title: "Centraliser mes contrats",
    description: "Contrathèque, échéances et renouvellements",
    to: "/contratheque",
    icon: FolderOpen,
  },
  {
    code: "clause_library",
    title: "Gérer mes clauses",
    description: "Constituer une bibliothèque de clauses de référence",
    to: "/clauses",
    icon: Library,
  },
  {
    code: "chat",
    title: "Poser une question juridique",
    description: "Interroger l'assistant sur un point de droit",
    to: "/chatjuridique",
    icon: MessageSquare,
  },
];

const MAX_INTENTS = 3;

const PROFESSION_OPTIONS: { code: string; label: string }[] = [
  { code: "avocat", label: "Avocat" },
  { code: "juriste_entreprise", label: "Juriste d'entreprise" },
  { code: "notaire_commissaire", label: "Notaire ou commissaire de justice" },
  { code: "dirigeant", label: "Dirigeant ou fondateur" },
  { code: "rh", label: "Ressources humaines" },
  { code: "expert_comptable", label: "Expert-comptable ou conseil" },
  { code: "independant", label: "Indépendant ou freelance" },
  { code: "etudiant", label: "Étudiant" },
  { code: "particulier", label: "Particulier" },
  { code: "autre", label: "Autre" },
];

const PROFESSION_OTHER = "autre";
const PROFESSION_OTHER_MAX_LENGTH = 60;

/** Profils à qui l'on ne demande ni volume de contrats, ni équipe, ni structure. */
const PROFESSIONS_WITHOUT_ORGANISATION = ["etudiant", "particulier"];

const CONTRACT_VOLUME_OPTIONS: { code: string; label: string }[] = [
  { code: "lt_5", label: "Moins de 5" },
  { code: "5_20", label: "5 à 20" },
  { code: "20_100", label: "20 à 100" },
  { code: "gt_100", label: "Plus de 100" },
];

const TEAM_SIZE_OPTIONS: { code: string; label: string }[] = [
  { code: "solo", label: "Moi seul" },
  { code: "2_5", label: "2 à 5" },
  { code: "6_20", label: "6 à 20" },
  { code: "gt_20", label: "Plus de 20" },
];

/** Courbe d'animation commune : départ franc, arrivée douce (celle du tableau de bord). */
const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;

/* ════════════════════════════════════════════════════════════════════════════
   2. API — appels au proxy
   ════════════════════════════════════════════════════════════════════════════ */

const GENERIC_SAVE_ERROR = "L'enregistrement a échoué. Vérifiez votre connexion puis réessayez.";

/** Enregistre une étape (ou la fin / le refus) et met le store à jour. */
async function patchOnboarding(patch: OnboardingPatch): Promise<OnboardingData> {
  const response = await fetchProxy("/api/user-metadata", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message || GENERIC_SAVE_ERROR);
  }

  const onboarding = payload.data as OnboardingData;
  useUserStore.getState().setOnboarding(onboarding);
  return onboarding;
}

/** Efface les réponses (banc d'essai uniquement pour l'instant). */
async function deleteOnboardingAnswers(): Promise<void> {
  const response = await fetchProxy("/api/user-metadata", {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.success && payload.data) {
    useUserStore.getState().setOnboarding(payload.data as OnboardingData);
  }
}

/**
 * Rattache l'entreprise choisie au compte.
 *
 * On passe d'abord par l'aperçu INSEE du serveur (il ajoute les conventions
 * collectives déduites du code NAF) ; s'il est indisponible, on enregistre les
 * données publiques déjà reçues par la recherche.
 */
async function saveEnterpriseFromCompany(company: CompanyResult): Promise<void> {
  const fallback = mapCompanyToEnterprise(company);
  let enterprise: Record<string, unknown> = {
    name: fallback.name,
    siren: fallback.siren,
    codeNaf: fallback.codeNaf,
    intituleNaf: fallback.intituleNaf,
    statusJuridiqueCode: fallback.statusJuridiqueCode,
    statusJuridique: fallback.statusJuridique,
    address: fallback.address?.address ?? "",
    codePostal: fallback.address?.codePostal ?? "",
    pays: fallback.address?.pays ?? "France",
  };

  if (fallback.siren) {
    try {
      const preview = await fetchProxy(`/api/enterprise/insee/${encodeURIComponent(fallback.siren)}`, {
        credentials: "include",
      });
      const previewPayload = await preview.json().catch(() => null);
      if (preview.ok && previewPayload?.success && previewPayload.data) {
        const data = previewPayload.data;
        enterprise = {
          name: data.name ?? fallback.name,
          siren: data.siren ?? fallback.siren,
          codeNaf: data.codeNaf ?? fallback.codeNaf,
          intituleNaf: data.intituleNaf ?? fallback.intituleNaf,
          statusJuridiqueCode: data.statusJuridiqueCode ?? fallback.statusJuridiqueCode,
          statusJuridique: data.statusJuridique ?? fallback.statusJuridique,
          address: data.address?.address ?? fallback.address?.address ?? "",
          codePostal: data.address?.codePostal ?? fallback.address?.codePostal ?? "",
          pays: data.address?.pays ?? fallback.address?.pays ?? "France",
          idccSelections: data.idccSelections,
          selectedIdccKey: data.selectedIdccKey,
        };
      }
    } catch {
      // Aperçu indisponible : on garde les données de la recherche.
    }
  }

  const response = await fetchProxy("/api/enterprise", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enterprise),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Impossible d'enregistrer votre structure.");
  }

  // On range la fiche dans le store sans relancer `fetchUser` : celui-ci repasse
  // par l'état « chargement », ce qui démonterait la page (et ce formulaire).
  if (payload.data) {
    useUserStore.setState((state) =>
      state.userData
        ? { userData: { ...state.userData, enterprise: payload.data as UserData["enterprise"] } }
        : state,
    );
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   3. LOGIQUE — état du formulaire et navigation entre étapes
   ════════════════════════════════════════════════════════════════════════════ */

interface OnboardingAnswers {
  intents: string[];
  profession: string | null;
  professionOther: string;
  contractVolume: string | null;
  teamSize: string | null;
  company: CompanyResult | null;
  noEnterprise: boolean;
}

/** Réponses de départ : celles déjà enregistrées, pour reprendre où l'on s'était arrêté. */
function initialAnswers(onboarding: OnboardingData | null): OnboardingAnswers {
  const knownIntents = INTENT_OPTIONS.map((option) => option.code);
  return {
    intents: (onboarding?.primaryIntents ?? []).filter((code) => knownIntents.includes(code)),
    profession: onboarding?.profession ?? null,
    professionOther: onboarding?.professionOther ?? "",
    contractVolume: onboarding?.contractVolume ?? null,
    teamSize: onboarding?.teamSize ?? null,
    company: null,
    noEnterprise: onboarding?.hasNoEnterprise ?? false,
  };
}

function useOnboardingForm() {
  // Photographie du store à l'ouverture : le formulaire ne doit pas se
  // réorganiser sous les yeux de l'utilisateur quand ses propres
  // enregistrements mettent le store à jour.
  const [snapshot] = useState(() => {
    const { onboarding, userData } = useUserStore.getState();
    const enterprise = userData?.enterprise;
    return {
      onboarding,
      hasEnterprise: Boolean(enterprise?.siren || enterprise?.name),
    };
  });

  const [answers, setAnswers] = useState<OnboardingAnswers>(() => initialAnswers(snapshot.onboarding));
  const [stepId, setStepId] = useState<StepId>(() => {
    // Reprise d'un parcours interrompu : on rouvre à l'étape atteinte.
    if (snapshot.onboarding?.onboardingStatus !== "IN_PROGRESS") return "intent";
    return STEPS.find((step) => step.index === snapshot.onboarding?.currentStep)?.id ?? "intent";
  });
  /** Sens de la dernière navigation : +1 vers l'avant, -1 vers l'arrière (pilote l'animation). */
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  // Étapes réellement affichées : un étudiant ou un particulier n'a ni volume
  // de contrats ni structure à déclarer ; une structure déjà connue n'est pas
  // redemandée.
  const visibleSteps = useMemo(() => {
    const withoutOrganisation =
      answers.profession !== null && PROFESSIONS_WITHOUT_ORGANISATION.includes(answers.profession);
    return STEPS.filter((step) => {
      if (step.id === "activity") return !withoutOrganisation;
      if (step.id === "enterprise") return !withoutOrganisation && !snapshot.hasEnterprise;
      return true;
    });
  }, [answers.profession, snapshot.hasEnterprise]);

  const position = Math.max(
    0,
    visibleSteps.findIndex((step) => step.id === stepId),
  );
  const currentStep = visibleSteps[position];
  const isLastStep = position === visibleSteps.length - 1;

  const canContinue = (() => {
    switch (currentStep.id) {
      case "intent":
        return answers.intents.length > 0;
      case "profession":
        return answers.profession === PROFESSION_OTHER
          ? answers.professionOther.trim().length >= 2
          : answers.profession !== null;
      case "activity":
        return answers.contractVolume !== null && answers.teamSize !== null;
      case "enterprise":
        return answers.company !== null || answers.noEnterprise;
    }
  })();

  const update = (changes: Partial<OnboardingAnswers>) => {
    setError(null);
    setAnswers((current) => ({ ...current, ...changes }));
  };

  /** Coche / décoche un outil, en conservant l'ordre de sélection. */
  const toggleIntent = (code: string) => {
    setError(null);
    setAnswers((current) => {
      if (current.intents.includes(code)) {
        return { ...current, intents: current.intents.filter((intent) => intent !== code) };
      }
      if (current.intents.length >= MAX_INTENTS) return current;
      return { ...current, intents: [...current.intents, code] };
    });
  };

  /** Réponses de l'étape affichée, au format attendu par le serveur. */
  const answersOfCurrentStep = (): OnboardingPatch => {
    switch (currentStep.id) {
      case "intent":
        return { primaryIntents: answers.intents };
      case "profession":
        return {
          profession: answers.profession,
          professionOther: answers.profession === PROFESSION_OTHER ? answers.professionOther.trim() : null,
        };
      case "activity":
        return { contractVolume: answers.contractVolume, teamSize: answers.teamSize };
      case "enterprise":
        return { hasNoEnterprise: answers.noEnterprise };
    }
  };

  /**
   * Passe à l'étape suivante en enregistrant celle-ci. `skip` avance sans
   * enregistrer de réponse : chaque question reste facultative.
   */
  const goNext = async (skip = false) => {
    if (saving) return;
    const nextStep = visibleSteps[position + 1];
    const patch: OnboardingPatch = skip ? {} : answersOfCurrentStep();
    if (nextStep) patch.currentStep = nextStep.index;
    else patch.status = "COMPLETED";

    setSaving(true);
    setError(null);
    try {
      if (!skip && currentStep.id === "enterprise" && answers.company) {
        await saveEnterpriseFromCompany(answers.company);
      }
      await patchOnboarding(patch);
      setDirection(1);
      if (nextStep) setStepId(nextStep.id);
      else setFinished(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const previousStep = visibleSteps[position - 1];
    if (!previousStep || saving) return;
    setError(null);
    setDirection(-1);
    setStepId(previousStep.id);
  };

  /** « Ne plus me le proposer » : le parcours est marqué comme refusé. */
  const decline = async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    setError(null);
    try {
      await patchOnboarding({ status: "SKIPPED" });
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_SAVE_ERROR);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    answers,
    update,
    toggleIntent,
    visibleSteps,
    position,
    currentStep,
    isLastStep,
    canContinue,
    direction,
    saving,
    error,
    finished,
    goNext,
    goBack,
    decline,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   4. BRIQUES UI — éléments réutilisés par les étapes
   ════════════════════════════════════════════════════════════════════════════ */

/** Apparition en cascade des réponses d'une étape (chaque enfant utilise `revealItem`). */
const revealList = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.06 } },
};

const revealItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-[26px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[28px]">
        {title}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{subtitle}</p>
    </div>
  );
}

/** Carte d'outil à cocher. `rank` (1, 2, 3) rappelle l'ordre de sélection. */
function IntentCard({
  title,
  description,
  icon: Icon,
  rank,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  rank: number | null;
  disabled: boolean;
  onToggle: () => void;
}) {
  const selected = rank !== null;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      variants={revealItem}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200",
        FOCUS_RING,
        selected
          ? "border-brand bg-brand-light/70 shadow-[0_0_0_1px_#2C3A5E]"
          : "border-line bg-white hover:border-brand-muted hover:bg-surface-subtle",
        disabled && "cursor-not-allowed opacity-45 hover:border-line hover:bg-white",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
          selected ? "bg-brand text-white" : "bg-surface-subtle text-brand group-hover:bg-brand-light",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1 pr-5">
        <span className="block text-[13.5px] font-semibold leading-snug text-ink">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{description}</span>
      </span>

      <AnimatePresence>
        {selected && (
          <motion.span
            key="rank"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#BE9243] text-[11px] font-semibold text-white"
            aria-hidden="true"
          >
            {rank}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Pastille à choix unique (profession, volume, équipe). */
function ChoiceChip({
  label,
  selected,
  onSelect,
  centered = false,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  centered?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      variants={revealItem}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex min-h-[42px] items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-medium leading-snug transition-[border-color,background-color,color] duration-200",
        FOCUS_RING,
        centered ? "justify-center text-center" : "justify-between text-left",
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-white text-ink-secondary hover:border-brand-muted hover:bg-surface-subtle",
      )}
    >
      {label}
      {!centered && (
        <Check
          className={cn(
            "h-4 w-4 shrink-0 transition-[opacity,transform] duration-200",
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          strokeWidth={2.5}
        />
      )}
    </motion.button>
  );
}

/** Groupe de pastilles à choix unique, avec son intitulé. */
function ChoiceGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { code: string; label: string }[];
  value: string | null;
  onChange: (code: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-semibold text-ink-secondary">{legend}</p>
      <motion.div
        role="radiogroup"
        aria-label={legend}
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {options.map((option) => (
          <ChoiceChip
            key={option.code}
            label={option.label}
            selected={value === option.code}
            onSelect={() => onChange(option.code)}
            centered
          />
        ))}
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   5. ÉTAPES — un composant par écran
   ════════════════════════════════════════════════════════════════════════════ */

type OnboardingFormState = ReturnType<typeof useOnboardingForm>;

function StepIntent({ form }: { form: OnboardingFormState }) {
  const { intents } = form.answers;
  const limitReached = intents.length >= MAX_INTENTS;

  return (
    <>
      <StepHeading
        title="Par quoi souhaitez-vous commencer ?"
        subtitle={`Choisissez jusqu'à ${MAX_INTENTS} outils. Le premier sélectionné sera mis en avant à la fin.`}
      />

      <motion.div
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {INTENT_OPTIONS.map((option) => {
          const rankIndex = intents.indexOf(option.code);
          return (
            <IntentCard
              key={option.code}
              title={option.title}
              description={option.description}
              icon={option.icon}
              rank={rankIndex === -1 ? null : rankIndex + 1}
              disabled={limitReached && rankIndex === -1}
              onToggle={() => form.toggleIntent(option.code)}
            />
          );
        })}
      </motion.div>

      <p className="mt-3 text-[12px] text-ink-subtle" aria-live="polite">
        {intents.length} / {MAX_INTENTS} sélectionné{intents.length > 1 ? "s" : ""}
      </p>
    </>
  );
}

function StepProfession({ form }: { form: OnboardingFormState }) {
  const { profession, professionOther } = form.answers;

  return (
    <>
      <StepHeading
        title="Quelle est votre activité ?"
        subtitle="Nous adaptons le vocabulaire et les modèles proposés à votre métier."
      />

      <motion.div
        role="radiogroup"
        aria-label="Votre activité"
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {PROFESSION_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.code}
            label={option.label}
            selected={profession === option.code}
            onSelect={() => form.update({ profession: option.code })}
          />
        ))}
      </motion.div>

      <AnimatePresence initial={false}>
        {profession === PROFESSION_OTHER && (
          <motion.div
            key="other"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            {/* La marge interne laisse la place à l'anneau de focus, sinon rogné. */}
            <div className="px-1 pb-1 pt-3">
              <label htmlFor="onboarding-profession-other" className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">
                Précisez votre activité
              </label>
              <Input
                id="onboarding-profession-other"
                autoFocus
                maxLength={PROFESSION_OTHER_MAX_LENGTH}
                placeholder="Ex. : responsable des achats"
                value={professionOther}
                onChange={(event) => form.update({ professionOther: event.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StepActivity({ form }: { form: OnboardingFormState }) {
  return (
    <>
      <StepHeading
        title="Quelle place occupent les contrats ?"
        subtitle="Deux repères pour vous proposer la formule et l'organisation adaptées."
      />

      <div className="flex flex-col gap-6">
        <ChoiceGroup
          legend="Contrats traités chaque mois"
          options={CONTRACT_VOLUME_OPTIONS}
          value={form.answers.contractVolume}
          onChange={(code) => form.update({ contractVolume: code })}
        />
        <ChoiceGroup
          legend="Personnes qui travaillent sur ces contrats"
          options={TEAM_SIZE_OPTIONS}
          value={form.answers.teamSize}
          onChange={(code) => form.update({ teamSize: code })}
        />
      </div>
    </>
  );
}

function StepEnterprise({ form }: { form: OnboardingFormState }) {
  const lookup = useCompanyLookup();
  const { company, noEnterprise } = form.answers;
  const selected = company ? formatCompanyOption(company) : null;

  const selectCompany = (result: CompanyResult) => {
    form.update({ company: result, noEnterprise: false });
    lookup.setQuery("");
  };

  return (
    <>
      <StepHeading
        title="Pour quelle structure travaillez-vous ?"
        subtitle="Recherchez-la par son nom ou son SIRET : ses informations pré-rempliront vos contrats."
      />

      {selected ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="flex items-center gap-3 rounded-xl border border-brand bg-brand-light/70 px-3.5 py-3 shadow-[0_0_0_1px_#2C3A5E]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{selected.title}</span>
            <span className="block truncate text-[12px] text-ink-muted">{selected.subtitle}</span>
          </span>
          <button
            type="button"
            onClick={() => form.update({ company: null })}
            className={cn("rounded-lg px-2 py-1 text-[12.5px] font-semibold text-brand hover:bg-white", FOCUS_RING)}
          >
            Modifier
          </button>
        </motion.div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              autoFocus
              type="search"
              aria-label="Nom ou SIRET de votre structure"
              placeholder="Nom de la structure ou SIRET"
              value={lookup.query}
              disabled={noEnterprise}
              onChange={(event) => lookup.setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9 pr-9"
            />
            {lookup.status === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-subtle" />
            )}
          </div>

          <div className="mt-2 min-h-[20px]" aria-live="polite">
            {lookup.status === "success" && (
              <motion.ul
                variants={revealList}
                initial="hidden"
                animate="visible"
                className="flex max-h-[216px] flex-col overflow-y-auto rounded-xl border border-line"
              >
                {lookup.results.slice(0, 6).map((result, index) => {
                  const option = formatCompanyOption(result);
                  return (
                    <motion.li key={result.siren ?? index} variants={revealItem} className="border-b border-line-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => selectCompany(result)}
                        className="flex w-full flex-col px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                      >
                        <span className="truncate text-[13.5px] font-semibold text-ink">{option.title}</span>
                        <span className="truncate text-[12px] text-ink-muted">{option.subtitle}</span>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
            {lookup.status === "empty" && (
              <p className="text-[12.5px] text-ink-muted">Aucune structure trouvée. Vérifiez l'orthographe ou saisissez le SIRET.</p>
            )}
            {lookup.status === "error" && (
              <p className="text-[12.5px] text-danger">
                La recherche est momentanément indisponible. Vous pourrez renseigner votre structure plus tard dans Mon compte.
              </p>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={noEnterprise}
        onClick={() => {
          form.update({ noEnterprise: !noEnterprise, company: null });
          lookup.setQuery("");
        }}
        className={cn("mt-4 flex items-center gap-2.5 rounded-lg py-1 pr-2 text-[13px] text-ink-secondary", FOCUS_RING)}
      >
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors duration-200",
            noEnterprise ? "border-brand bg-brand text-white" : "border-line-emphasis bg-white",
          )}
        >
          {noEnterprise && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        Je n'exerce pas au sein d'une structure
      </button>
    </>
  );
}

/** Écran de fin : confirme, puis emmène l'utilisateur vers l'outil qu'il a choisi en premier. */
function StepDone({
  intents,
  firstName,
  onNavigate,
}: {
  intents: string[];
  firstName: string;
  onNavigate: (to: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const chosen = intents
    .map((code) => INTENT_OPTIONS.find((option) => option.code === code))
    .filter((option): option is (typeof INTENT_OPTIONS)[number] => option !== undefined);
  const [first, ...others] = chosen;

  return (
    <div className="flex h-full flex-col items-center justify-center py-4 text-center">
      <motion.span
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.2, ease: EASE_OUT }}
          />
        </svg>
      </motion.span>

      <h2 className="mt-5 font-serif text-[28px] leading-[1.15] tracking-[-0.01em] text-ink">
        Votre espace est prêt{firstName ? `, ${firstName}` : ""}
      </h2>
      <p className="mt-2 max-w-[380px] text-[13.5px] leading-relaxed text-ink-muted">
        {first
          ? "Merci. Vous pouvez commencer tout de suite par l'outil que vous avez placé en premier."
          : "Merci. Vous pouvez dès maintenant découvrir vos outils depuis le tableau de bord."}
      </p>

      <div className="mt-6 flex w-full max-w-[340px] flex-col gap-2">
        {first && (
          <button
            type="button"
            onClick={() => onNavigate(first.to)}
            className={cn(
              "group flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover",
              FOCUS_RING,
            )}
          >
            {first.title}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}

        {others.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => onNavigate(option.to)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[13.5px] font-medium text-ink-secondary transition-colors hover:border-brand-muted hover:bg-surface-subtle",
              FOCUS_RING,
            )}
          >
            <option.icon className="h-4 w-4 text-brand" />
            {option.title}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onNavigate("/dashboard")}
          className={cn(
            first
              ? "mt-1 rounded-lg py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
              : "flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover",
            FOCUS_RING,
          )}
        >
          Aller au tableau de bord
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   6. FENÊTRE — coquille, progression et navigation
   ════════════════════════════════════════════════════════════════════════════ */

/** Panneau latéral (écrans larges) : accueil et progression étape par étape. */
function OnboardingAside({
  firstName,
  steps,
  position,
  finished,
}: {
  firstName: string;
  steps: { id: StepId; label: string }[];
  position: number;
  finished: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <aside className="relative hidden w-[290px] shrink-0 flex-col overflow-hidden bg-[linear-gradient(150deg,#28486a_0%,#1c3350_52%,#152840_100%)] p-7 text-white md:flex">
      {/* Halo doré discret : la seule touche décorative, elle dérive très lentement. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D6B266] opacity-[0.16] blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, -14, 0], y: [0, 12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D6B266]">Lumen Juris</p>
      <h1 className="relative mt-4 font-serif text-[30px] leading-[1.1] tracking-[-0.01em]">
        Bienvenue{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="relative mt-3 text-[13.5px] leading-relaxed text-white/70">
        Quelques questions pour préparer un espace qui vous ressemble.
      </p>

      <ol className="relative mt-9 flex flex-col">
        {steps.map((step, index) => {
          const done = finished || index < position;
          const active = !finished && index === position;
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300",
                    done && "bg-[#D6B266] text-[#16263a]",
                    active && "bg-white text-[#16263a] shadow-[0_0_0_4px_rgba(255,255,255,0.14)]",
                    !done && !active && "border border-white/25 text-white/50",
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span className="my-1 h-6 w-px overflow-hidden bg-white/15">
                    <motion.span
                      className="block h-full w-full origin-top bg-[#D6B266]"
                      initial={false}
                      animate={{ scaleY: done ? 1 : 0 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                    />
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "pt-0.5 text-[13.5px] transition-colors duration-300",
                  active ? "font-semibold text-white" : done ? "text-white/80" : "text-white/45",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="relative mt-auto flex items-start gap-2 pt-8 text-[11.5px] leading-relaxed text-white/55">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Moins d'une minute. Vos réponses servent à configurer votre espace et à améliorer Lumen Juris.
      </p>
    </aside>
  );
}

interface OnboardingFormProps {
  /** Ferme la fenêtre sans rien refuser : le formulaire sera reproposé à la prochaine session. */
  onClose: () => void;
}

/**
 * Fenêtre d'onboarding. Elle se suffit à elle-même : il suffit de la monter
 * quand `selectShouldShowOnboarding` est vrai, et de la démonter dans `onClose`.
 */
export function OnboardingForm({ onClose }: OnboardingFormProps) {
  const form = useOnboardingForm();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const firstName = useUserStore((state) => state.userData?.profile?.prenom) ?? "";

  // Échap referme la fenêtre ; la page derrière ne défile pas pendant ce temps.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleNavigate = (to: string) => {
    onClose();
    navigate(to);
  };

  const handleDecline = async () => {
    if (await form.decline()) onClose();
  };

  const totalSteps = form.visibleSteps.length;
  const progress = form.finished ? 1 : form.position / totalSteps;
  const slide = reduceMotion ? 0 : 26;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#0f1b2d]/55 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Configuration de votre espace Lumen Juris"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="relative flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[900px] overflow-hidden rounded-[20px] bg-white shadow-[0_40px_90px_-30px_rgba(11,22,40,0.65)]"
      >
        <OnboardingAside
          firstName={firstName}
          steps={form.visibleSteps}
          position={form.position}
          finished={form.finished}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          {/* Barre de progression : seul repère sur mobile, où le panneau latéral est masqué. */}
          <div className="h-[3px] w-full bg-line-subtle">
            <motion.div
              className="h-full origin-left bg-[linear-gradient(90deg,#2C3A5E_0%,#BE9243_100%)]"
              initial={false}
              animate={{ scaleX: Math.max(progress, 0.04) }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            />
          </div>

          <header className="flex items-center justify-between px-6 pt-4 sm:px-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {form.finished ? "Terminé" : `Étape ${form.position + 1} sur ${totalSteps}`}
            </span>
            <div className="flex items-center gap-1">
              {!form.finished && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn("rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink", FOCUS_RING)}
                >
                  Plus tard
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className={cn("rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink", FOCUS_RING)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Contenu de l'étape : glisse dans le sens de la navigation. */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 pt-4 sm:px-8">
            <AnimatePresence mode="wait" custom={form.direction} initial={false}>
              <motion.div
                key={form.finished ? "done" : form.currentStep.id}
                custom={form.direction}
                variants={{
                  enter: (direction: number) => ({ opacity: 0, x: direction * slide }),
                  center: { opacity: 1, x: 0 },
                  exit: (direction: number) => ({ opacity: 0, x: direction * -slide }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: EASE_OUT }}
                className="h-full"
              >
                {form.finished ? (
                  <StepDone intents={form.answers.intents} firstName={firstName} onNavigate={handleNavigate} />
                ) : (
                  <>
                    {form.currentStep.id === "intent" && <StepIntent form={form} />}
                    {form.currentStep.id === "profession" && <StepProfession form={form} />}
                    {form.currentStep.id === "activity" && <StepActivity form={form} />}
                    {form.currentStep.id === "enterprise" && <StepEnterprise form={form} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {!form.finished && (
            <footer className="border-t border-line-subtle px-6 py-3.5 sm:px-8">
              {form.error && (
                <p role="alert" className="mb-2.5 text-[12.5px] text-danger">
                  {form.error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {form.position > 0 ? (
                  <button
                    type="button"
                    onClick={form.goBack}
                    disabled={form.saving}
                    className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-subtle disabled:opacity-50", FOCUS_RING)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleDecline()}
                    disabled={form.saving}
                    className={cn("rounded-lg px-1 py-1.5 text-[12.5px] text-ink-subtle underline-offset-2 transition-colors hover:text-ink-muted hover:underline disabled:opacity-50", FOCUS_RING)}
                  >
                    Ne plus me le proposer
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void form.goNext(true)}
                    disabled={form.saving}
                    className={cn("h-10 rounded-xl px-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink disabled:opacity-50", FOCUS_RING)}
                  >
                    Passer
                  </button>
                  <button
                    type="button"
                    onClick={() => void form.goNext()}
                    disabled={!form.canContinue || form.saving}
                    className={cn(
                      "group flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[13.5px] font-semibold text-white transition-[background-color,opacity] duration-200 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40",
                      FOCUS_RING,
                    )}
                  >
                    {form.saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {form.isLastStep ? "Terminer" : "Continuer"}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-enabled:group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </footer>
          )}
        </section>
      </motion.div>
    </div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   7. PAGE SANDBOX — banc d'essai (à supprimer une fois le formulaire déplacé)
   ════════════════════════════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<OnboardingData["onboardingStatus"], string> = {
  NOT_STARTED: "Non commencé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  SKIPPED: "Refusé ou compte antérieur",
};

export const Sandbox = () => {
  const onboarding = useUserStore((state) => state.onboarding);
  const shouldShow = useUserStore(selectShouldShowOnboarding);
  const dismissOnboarding = useUserStore((state) => state.dismissOnboarding);
  // Ouverture forcée : permet de rejouer le formulaire avec un compte qui l'a déjà terminé ou refusé.
  const [forceOpen, setForceOpen] = useState(false);

  const closeForm = () => {
    setForceOpen(false);
    dismissOnboarding();
  };

  const buttonClassName =
    "rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-subtle";

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-[520px] rounded-card border border-line bg-white p-5 shadow-card">
        <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-ink-subtle">Banc d'essai</p>
        <h1 className="mt-1 text-[15px] font-semibold text-ink">Onboarding</h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          État du parcours :{" "}
          <span className="font-semibold text-ink">
            {onboarding ? STATUS_LABELS[onboarding.onboardingStatus] : "non chargé"}
          </span>
          {onboarding ? ` (étape atteinte : ${onboarding.currentStep + 1})` : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setForceOpen(true)} className={buttonClassName}>
            Ouvrir le formulaire
          </button>
          <button type="button" onClick={() => void deleteOnboardingAnswers()} className={buttonClassName}>
            Effacer mes réponses
          </button>
        </div>
      </div>

      {(forceOpen || shouldShow) && <OnboardingForm onClose={closeForm} />}
    </div>
  );
};
