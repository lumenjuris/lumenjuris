import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useOnboardingTourStore } from "../../store/onboardingTourStore";
import { OnboardingTooltip, TOOLTIP_ARROW_OFFSET, type OnboardingTooltipKey } from "./OnboardingTooltip";

/** Écart entre l'entrée du menu et la pointe de la flèche. */
const ANCHOR_GAP = 14;

/**
 * Visite guidée du menu latéral : une bulle à la fois, posée à droite de
 * l'entrée concernée.
 *
 * Chaque entrée du menu porte un attribut `data-onboarding-anchor` ; la bulle
 * suit sa position à chaque image. Elle est rendue hors du menu (portail) :
 * le menu défile verticalement et couperait tout ce qui dépasse de sa largeur.
 * Elle reste donc en place pendant la navigation, le défilement du menu et son
 * ouverture / fermeture, et se masque quand l'entrée n'est pas visible.
 */
export function OnboardingTour({ steps }: { steps: OnboardingTooltipKey[] }) {
  const stepIndex = useOnboardingTourStore((state) => state.stepIndex);
  const nextStep = useOnboardingTourStore((state) => state.nextStep);
  const endTour = useOnboardingTourStore((state) => state.endTour);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const currentKey = stepIndex !== null ? steps[stepIndex] : undefined;

  // Étape au-delà de la liste (menu modifié entre-temps) : la visite s'arrête.
  useEffect(() => {
    if (stepIndex !== null && stepIndex >= steps.length) endTour();
  }, [stepIndex, steps.length, endTour]);

  // Échap arrête la visite.
  useEffect(() => {
    if (!currentKey) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") endTour();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [currentKey, endTour]);

  // Suivi de l'entrée du menu.
  useEffect(() => {
    if (!currentKey) {
      setPosition(null);
      return;
    }

    const selector = `[data-onboarding-anchor="${currentKey}"]`;
    // Entrée hors de la zone visible du menu : on la fait défiler une fois.
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: "nearest" });

    let frame = 0;
    const track = () => {
      const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      // Menu fermé (tiroir mobile, menu replié) : l'entrée est hors écran.
      const visible = rect !== undefined && rect.width > 0 && rect.right > 0;

      setPosition((previous) => {
        if (!visible) return null;
        const top = Math.max(8, Math.round(rect.top + rect.height / 2 - TOOLTIP_ARROW_OFFSET));
        const left = Math.round(rect.right + ANCHOR_GAP);
        return previous && previous.top === top && previous.left === left ? previous : { top, left };
      });
      frame = requestAnimationFrame(track);
    };
    track();

    return () => cancelAnimationFrame(frame);
  }, [currentKey]);

  if (!currentKey || stepIndex === null || !position) return null;

  const isLast = stepIndex === steps.length - 1;

  return createPortal(
    <OnboardingTooltip
      tooltipKey={currentKey}
      step={stepIndex + 1}
      total={steps.length}
      onNext={isLast ? endTour : nextStep}
      onClose={endTour}
      style={{ top: position.top, left: position.left }}
    />,
    document.body,
  );
}
