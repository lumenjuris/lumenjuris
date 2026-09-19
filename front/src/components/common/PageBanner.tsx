import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../utils/shadcnUtils/cn";

/** Lien « retour » vers la page principale, affiché au-dessus du titre (fil d'Ariane). */
export type PageBannerBackLink = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type PageBannerProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** À renseigner quand on est dans une sous-section : affiche « < label » au-dessus du titre. */
  backLink?: PageBannerBackLink;
  /** Badges affichés à côté du titre (statut, échéance…). */
  badges?: ReactNode;
  /** Bouton(s) CTA affichés à droite de la bannière (en dessous sur mobile). */
  actions?: ReactNode;
  /** Contenu libre affiché sous le titre (ex : barre d'actions secondaire). */
  children?: ReactNode;
  className?: string;
};

/**
 * Bannière bleue en tête des pages de l'app (sauf le Dashboard, qui a son HeroHeader).
 */
export function PageBanner({
  title,
  subtitle,
  backLink,
  badges,
  actions,
  children,
  className,
}: PageBannerProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl bg-blue-primary px-6 py-6 sm:px-10",
        className,
      )}
    >
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-title-card-sub/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-card-sub/10 blur-3xl" />

      <div className="relative space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            {backLink && (
              <button
                type="button"
                onClick={backLink.onClick}
                disabled={backLink.disabled}
                className="inline-flex items-center gap-1 text-xs font-medium text-white/60 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {backLink.label}
              </button>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="break-words font-serif text-3xl leading-tight text-white sm:text-4xl">
                {title}
              </h1>
              {badges}
            </div>

            {subtitle && (
              <div className="text-sm leading-relaxed text-gray-primary">{subtitle}</div>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
          )}
        </div>

        {children}
      </div>
    </header>
  );
}
