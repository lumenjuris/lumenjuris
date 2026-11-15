import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";

import { cn } from "../../utils/shadcnUtils/cn";
import { EASE_OUT, type StepId } from "./constants";

/** Panneau latéral (écrans larges) : accueil et progression étape par étape. */
export function OnboardingAside({
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
