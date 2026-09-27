import { useEffect, useRef, useState } from "react";

/**
 * Anime un entier de 0 jusqu'à `target` en `duration` ms (courbe d'atténuation
 * douce). Respecte `prefers-reduced-motion` : dans ce cas la valeur finale est
 * affichée immédiatement, sans animation.
 *
 * Renvoie la valeur courante à afficher.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce || target <= 0) {
      setValue(target);
      return;
    }

    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else setValue(target);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}
