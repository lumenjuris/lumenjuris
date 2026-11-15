import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cn } from "../../../utils/shadcnUtils/cn";
import { FOCUS_RING } from "../animations";
import { EASE_OUT, INTENT_OPTIONS } from "../constants";

/** Écran de fin : confirme, puis emmène l'utilisateur vers l'outil qu'il a choisi en premier. */
export function StepDone({
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
