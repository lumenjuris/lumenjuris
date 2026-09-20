import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import { SectionCard } from "./SectionCard";
import type { OnboardingStep } from "./types";

interface Props {
  steps: OnboardingStep[];
  loading: boolean;
}

/**
 * Bloc « Premiers pas » : les trois étapes qui font le tour de l'outil.
 *
 * Chaque étape se coche toute seule à partir des données déjà chargées ; le
 * bloc disparaît de la page dès que les trois sont franchies (voir `Dashboard`).
 */
export function OnboardingSteps({ steps, loading }: Props) {
  const doneCount = steps.filter((step) => step.done).length;
  // Une seule étape est mise en avant à la fois : la prochaine à faire.
  const nextStep = steps.find((step) => !step.done);
  // Largeur de la barre de progression de l'en-tête.
  const progressPercent = Math.round((doneCount / steps.length) * 100);

  return (
    <SectionCard
      eyebrow="Prise en main"
      title="Premiers pas"
      headerRight={
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eef1f6]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#2b4a76_0%,#4f82c6_100%)] transition-[width] duration-700"
              style={{ width: `${loading ? 0 : progressPercent}%` }}
            />
          </span>
          <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-blue-primary">
            {loading ? "…" : `${doneCount} / ${steps.length}`}
          </span>
        </div>
      }
    >
      <div className="flex flex-col border-t border-line-subtle">
        {steps.map((step, index) => {
          const isNext = step.key === nextStep?.key;

          return (
            <div
              key={step.key}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-5 py-3.5 last:border-b-0 ${
                isNext ? "bg-[#f8fafd]" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done
                    ? "bg-success text-white"
                    : isNext
                      ? "bg-blue-primary text-white"
                      : "border border-line-emphasis text-ink-subtle"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>

              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`text-[13.5px] font-semibold ${
                    step.done ? "text-ink-subtle line-through" : "text-ink"
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[12.5px] leading-snug text-ink-muted">{step.description}</span>
              </div>

              {isNext && (
                <Link
                  to={step.to}
                  className="group ml-auto flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-blue-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  {step.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
