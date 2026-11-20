import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

import { cn } from "../../utils/shadcnUtils/cn";
import { EASE_OUT } from "./constants";

/** Entrées du menu présentées pendant la visite guidée. */
export type OnboardingTooltipKey =
  | "accueil"
  | "contratheque"
  | "generateurContractScratch"
  | "generateurContractModel"
  | "negociation"
  | "signature"
  | "bibliothequeClause"
  | "playbook"
  | "analyseClassique"
  | "analysePlaybook"
  | "chat";

/**
 * Contenu de chaque bulle.
 * ⚠ Les descriptions engagent la promesse produit (preuve de signature,
 * analyse des risques) : à faire relire avant toute modification.
 */
const TOOLTIP_CONTENT: Record<OnboardingTooltipKey, { title: string; text: string }> = {
  accueil: {
    title: "Accueil",
    text: "Votre point de départ : actions en attente, prochaines échéances et points de vigilance de vos contrats, en un coup d'œil.",
  },
  contratheque: {
    title: "Contrathèque",
    text: "Centralisez tous vos contrats et suivez leurs dates clés : échéances, préavis et renouvellements.",
  },
  generateurContractScratch: {
    title: "Créer un contrat de zéro",
    text: "Décrivez le contrat dont vous avez besoin et répondez à quelques questions : vous obtenez une première version structurée, à relire et ajuster.",
  },
  generateurContractModel: {
    title: "Importer un modèle",
    text: "Transformez un contrat existant en modèle réutilisable, avec ses champs à compléter à chaque nouvelle utilisation.",
  },
  negociation: {
    title: "Négociation",
    text: "Partagez un contrat avec l'autre partie, échangez commentaires et propositions de modification, et gardez l'historique de chaque version.",
  },
  signature: {
    title: "Signature électronique",
    text: "Envoyez vos contrats en signature et suivez leur avancement. Chaque étape est horodatée et consignée dans un journal de preuve.",
  },
  bibliothequeClause: {
    title: "Bibliothèque de clauses",
    text: "Constituez vos clauses de référence avec vos positions de négociation : idéale, acceptable et ligne rouge.",
  },
  playbook: {
    title: "Playbook",
    text: "Formalisez vos règles de négociation (durées maximales, clauses obligatoires ou interdites) pour les appliquer à chaque contrat reçu.",
  },
  analyseClassique: {
    title: "Analyse et revue",
    text: "Importez un contrat reçu : les clauses à risque et les points d'attention sont identifiés et expliqués, clause par clause.",
  },
  analysePlaybook: {
    title: "Analyse playbook",
    text: "Confrontez un contrat à votre playbook : chaque écart à vos règles internes est signalé, avec une proposition de reformulation.",
  },
  chat: {
    title: "Chat juridique",
    text: "Interrogez l'assistant sur un point de droit ou une clause et obtenez une première réponse argumentée, à vérifier avant usage.",
  },
};

/**
 * Distance entre le haut de la bulle et le centre de sa flèche : `OnboardingTour`
 * s'en sert pour aligner la flèche sur l'entrée du menu.
 * À garder cohérent avec la position `top` de la flèche ci-dessous (18 px + 6 px).
 */
export const TOOLTIP_ARROW_OFFSET = 24;

/** Fond de la bulle : bleu nuit de la marque (`--navy-deep` du tableau de bord). */
const SURFACE = "#213957";

interface Props {
  tooltipKey: OnboardingTooltipKey;
  /** Numéro de l'étape (à partir de 1) et nombre total d'étapes. */
  step: number;
  total: number;
  onNext: () => void;
  onClose: () => void;
  /** Position calculée par `OnboardingTour` (fixe, à droite de l'entrée du menu). */
  style: CSSProperties;
}

/**
 * Bulle de la visite guidée, posée à droite d'une entrée du menu latéral.
 *
 * Reprend l'habillage du formulaire d'accueil (bleu nuit, touche dorée, titre
 * en Newsreader) pour que la visite se lise comme sa suite directe. Purement
 * visuelle : l'étape en cours et la position viennent de `OnboardingTour`.
 */
export function OnboardingTooltip({ tooltipKey, step, total, onNext, onClose, style }: Props) {
  const reduceMotion = useReducedMotion();
  const { title, text } = TOOLTIP_CONTENT[tooltipKey];
  const isLast = step === total;
  const titleId = `onboarding-tooltip-${tooltipKey}`;

  return (
    <motion.div
      key={tooltipKey}
      role="dialog"
      aria-labelledby={titleId}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      style={{ ...style, backgroundColor: SURFACE }}
      className="fixed z-40 w-[320px] rounded-2xl border border-[#D6B266]/25 text-white shadow-[0_22px_48px_-18px_rgba(11,22,40,0.6)]"
    >
      {/* Flèche : carré pivoté de 45°, mêmes fond et bordure que la bulle. Après
          rotation, ce sont ses bords gauche et bas qui forment la pointe : seuls
          eux portent la bordure, l'autre moitié se fond dans la bulle. */}
      <span
        aria-hidden="true"
        style={{ backgroundColor: SURFACE }}
        className="absolute -left-[7px] top-[18px] h-3 w-3 rotate-45 border-b border-l border-[#D6B266]/25"
      />

      {/* Halo doré discret, coupé par les bords arrondis. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#D6B266] opacity-[0.12] blur-2xl" />
      </span>

      <div className="relative p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#D6B266]">
            Visite guidée
          </span>
          <div className="-mr-1.5 flex items-center gap-1.5">
            <span className="text-[11px] font-medium tabular-nums text-white/45">
              {step} / {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Quitter la visite guidée"
              title="Quitter la visite"
              className="rounded-md p-1 text-white/50 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#D6B266]/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <h2 id={titleId} className="mt-2 font-serif text-[19px] leading-tight tracking-[-0.01em]">
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{text}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Progression : étapes passées en or, étape en cours allongée. */}
          <div className="flex flex-wrap items-center gap-1" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index + 1 === step ? "w-4 bg-white" : "w-1.5",
                  index + 1 < step && "bg-[#D6B266]",
                  index + 1 > step && "bg-white/20",
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onNext}
            className="group flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-semibold text-[#16263a] outline-none transition-colors hover:bg-[#f3f6ff] focus-visible:ring-2 focus-visible:ring-[#D6B266]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B3049]"
          >
            {isLast ? "Terminer" : "Suivant"}
            {!isLast && (
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
