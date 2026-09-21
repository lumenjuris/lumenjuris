import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight, ArrowUp, BookOpen, Briefcase, CheckCircle2, ClipboardList, FileText,
  Lock, Shield, Sparkles, Upload,
} from "lucide-react";
import { PageBanner } from "../../common/PageBanner";

/**
 * Écran d'accueil du générateur : les 3 façons de créer un contrat.
 *  - Créer de zéro (mise en avant, avec un champ de saisie direct)
 *  - Importer un modèle
 *  - Bibliothèque de modèles
 */

// Aperçu des modèles prêts à l'emploi affichés sur la carte bibliothèque
const LIBRARY_PREVIEW = [
  { Icon: Briefcase, label: "CDI" },
  { Icon: ClipboardList, label: "CDD" },
  { Icon: FileText, label: "Avenant" },
  { Icon: Shield, label: "Rupture conv." },
];

// Exemples qui s'écrivent tour à tour dans le placeholder du champ "Créer de zéro"
const PLACEHOLDER_EXAMPLES = [
  "Contrat de prestation de services informatiques",
  "Accord de confidentialité entre deux sociétés",
  "Contrat de mission freelance",
];
const DEFAULT_PLACEHOLDER = "Quel contrat souhaitez-vous créer ?";
const TYPING_SPEED_MS = 45;
const PAUSE_AFTER_TYPING_MS = 1800;

/** Vrai si l'utilisateur a demandé à réduire les animations (réglage système). */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Placeholder "machine à écrire" : écrit un exemple lettre par lettre,
 * attend un peu, l'efface puis passe au suivant.
 */
function useTypingPlaceholder(): string {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const isAnimated = !prefersReducedMotion();

  useEffect(() => {
    if (!isAnimated) return;
    const currentExample = PLACEHOLDER_EXAMPLES[exampleIndex];

    // Exemple entièrement écrit : pause puis effacement
    if (!isErasing && visibleLength === currentExample.length) {
      const pauseTimer = setTimeout(() => setIsErasing(true), PAUSE_AFTER_TYPING_MS);
      return () => clearTimeout(pauseTimer);
    }

    // Exemple entièrement effacé : on passe au suivant
    if (isErasing && visibleLength === 0) {
      setIsErasing(false);
      setExampleIndex((index) => (index + 1) % PLACEHOLDER_EXAMPLES.length);
      return;
    }

    const typingTimer = setTimeout(() => {
      setVisibleLength((length) => length + (isErasing ? -1 : 1));
    }, isErasing ? TYPING_SPEED_MS / 2 : TYPING_SPEED_MS);
    return () => clearTimeout(typingTimer);
  }, [exampleIndex, visibleLength, isErasing, isAnimated]);

  if (!isAnimated) return DEFAULT_PLACEHOLDER;
  return `Ex : ${PLACEHOLDER_EXAMPLES[exampleIndex].slice(0, visibleLength)}`;
}

interface GenerateurHubProps {
  /** Lance le questionnaire avec un titre, ou ouvre l'écran "Créer de zéro" si le titre est vide. */
  onCreate: (title: string) => void;
  onImport: () => void;
  onLibrary: () => void;
}

/**
 * Carte « Créer de zéro » : champ de saisie (exemples qui s'écrivent seuls) et
 * animation des clauses qui se génèrent. Partagée par l'accueil du générateur
 * et l'écran « Créer de zéro », pour une présentation identique.
 * `onCreate("")` quand le titre est trop court (l'appelant décide quoi faire).
 */
export function CreerDeZeroCard({ onCreate, className = "", sansTitre = false }: {
  onCreate: (title: string) => void;
  className?: string;
  /** Écran « Créer de zéro » : le bandeau porte déjà le titre, la carte ne le répète pas. */
  sansTitre?: boolean;
}) {
  const [contractTitle, setContractTitle] = useState("");
  const canStartWithTitle = contractTitle.trim().length >= 3;
  const typingPlaceholder = useTypingPlaceholder();

  const submitContractTitle = () => {
    onCreate(canStartWithTitle ? contractTitle.trim() : "");
  };

  return (
        <section className={`group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-brand/10 bg-gradient-to-br from-brand-light via-white to-white p-6 shadow-card transition-shadow hover:shadow-card-md sm:p-8 ${className}`}>
          {!sansTitre && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Créer de zéro</h2>
              <p className="max-w-md text-sm leading-relaxed text-ink-muted">
                Décrivez le contrat souhaité, répondez à quelques questions : il est rédigé pour vous,
                article RGPD inclus.
              </p>
            </div>
          )}

          {/* Champ de saisie direct */}
          <form
            className="my-auto flex items-center gap-2 rounded-2xl border border-line bg-white p-2 pl-4 shadow-card transition-all focus-within:border-brand/40 focus-within:shadow-ring-brand"
            onSubmit={(event) => {
              event.preventDefault();
              submitContractTitle();
            }}
          >
            <input
              type="text"
              value={contractTitle}
              onChange={(event) => setContractTitle(event.target.value)}
              placeholder={typingPlaceholder}
              aria-label="Quel contrat souhaitez-vous créer ?"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
            <button
              type="submit"
              title={canStartWithTitle ? "Commencer" : "Ouvrir le parcours guidé"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-primary text-white transition-all hover:bg-brand-hover active:scale-95"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>

          {/* Animation décorative : les clauses du contrat qui se génèrent */}
          <ClauseGenerationAnimation />

        </section>
  );
}

export function GenerateurHub({ onCreate, onImport, onLibrary }: GenerateurHubProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* ── En-tête ─────────────────────────────────────────── */}
      <PageBanner
        title="Rédigez un contrat solide, en quelques minutes."
        subtitle="Partez d'une description, d'un document existant ou d'un modèle prêt à l'emploi."
      />

      {/* ── Les 3 sections ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Créer de zéro — carte mise en avant */}
        <CreerDeZeroCard onCreate={onCreate} className="lg:col-span-2" />

        {/* Colonne droite : importer + bibliothèque */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <HubCard
            Icon={Upload}
            title="Importer un modèle"
            description="Transformez un PDF ou un Word existant en modèle réutilisable, champs détectés par l'IA."
            actionLabel="Importer"
            onClick={onImport}
          >
            <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Lock className="h-3 w-3" /> Traitement confidentiel, données chiffrées
            </p>
          </HubCard>

          <HubCard
            Icon={BookOpen}
            title="Bibliothèque de modèles"
            description="Modèles prêts à l'emploi et vos modèles personnalisés."
            actionLabel="Accéder"
            onClick={onLibrary}
          >
            <div className="flex flex-wrap gap-1.5">
              {LIBRARY_PREVIEW.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-chip bg-surface-subtle px-2 py-1 text-[11px] font-medium text-ink-secondary"
                >
                  <Icon className="h-3 w-3 text-brand" /> {label}
                </span>
              ))}
            </div>
          </HubCard>
        </div>
      </div>
    </div>
  );
}

/** Carte secondaire cliquable (importer, bibliothèque). */
function HubCard({
  Icon,
  title,
  description,
  actionLabel,
  onClick,
  children,
}: {
  Icon: typeof Upload;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-4 rounded-3xl border border-line bg-white p-6 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-card-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-brand-light text-brand">
          <Icon className="h-5 w-5 stroke-[1.5]" />
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-subtle transition-all group-hover:border-blue-primary group-hover:bg-blue-primary group-hover:text-white">
          <ArrowRight className="h-4 w-4 transition-transform group-hover:-rotate-45" />
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        <p className="text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>

      <div className="mt-auto space-y-3">
        {children}
        <span className="sr-only">{actionLabel}</span>
      </div>
    </button>
  );
}

/*
    Animation en bas de la carte "Créer de zéro" :
    les clauses du contrat apparaissent une à une et se cochent,
    comme si l'IA les générait.
*/
const GENERATED_CLAUSES = [
  "Objet du contrat",
  "Durée et résiliation",
  "Rémunération",
  "Confidentialité",
  "Protection des données (RGPD)",
];
const GENERATION_CYCLE_S = 9;
const CLAUSE_DELAY_S = 0.8;

function ClauseGenerationAnimation() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-ink-subtle">
        <Sparkles className="clause-sparkle h-3 w-3 text-brand" /> CLAUSES PERSONNALISEES
      </p>
      <div className="flex flex-wrap gap-2">
        {GENERATED_CLAUSES.map((clause, index) => (
          <span
            key={clause}
            className="clause-chip relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary shadow-card"
            style={{ animationDelay: `${index * CLAUSE_DELAY_S}s` }}
          >
            <CheckCircle2
              className="clause-check h-3.5 w-3.5 text-success"
              style={{ animationDelay: `${index * CLAUSE_DELAY_S}s` }}
            />
            {clause}
            {/* Reflet qui balaie la pastille pendant sa "génération" */}
            <span
              className="clause-shine pointer-events-none absolute inset-0"
              style={{ animationDelay: `${index * CLAUSE_DELAY_S}s` }}
            />
          </span>
        ))}
      </div>

      <style>{`
        .clause-chip {
          opacity: 0;
          transform: translateY(6px);
          animation: clause-appear ${GENERATION_CYCLE_S}s ease-out infinite both;
        }
        .clause-check {
          opacity: 0;
          transform: scale(0.4);
          animation: clause-check ${GENERATION_CYCLE_S}s ease-out infinite both;
        }
        .clause-shine {
          background: linear-gradient(100deg, transparent 30%, rgba(199, 208, 239, 0.8) 50%, transparent 70%);
          transform: translateX(-100%);
          animation: clause-shine ${GENERATION_CYCLE_S}s ease-in-out infinite both;
        }
        .clause-sparkle { animation: clause-sparkle 2s ease-in-out infinite; }

        @keyframes clause-appear {
          0% { opacity: 0; transform: translateY(6px); }
          6%, 85% { opacity: 1; transform: translateY(0); }
          95%, 100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes clause-check {
          0%, 9% { opacity: 0; transform: scale(0.4); }
          13%, 85% { opacity: 1; transform: scale(1); }
          95%, 100% { opacity: 0; transform: scale(1); }
        }
        @keyframes clause-shine {
          0%, 2% { transform: translateX(-100%); }
          12%, 100% { transform: translateX(100%); }
        }
        @keyframes clause-sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.25) rotate(15deg); opacity: 0.7; }
        }

        @media (prefers-reduced-motion: reduce) {
          .clause-chip, .clause-check { animation: none; opacity: 1; transform: none; }
          .clause-shine, .clause-sparkle { animation: none; display: none; }
        }
      `}</style>
    </div>
  );
}
