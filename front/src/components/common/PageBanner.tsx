import type { ButtonHTMLAttributes, ReactNode } from "react";
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
  /** Bouton(s) CTA affichés à droite de la bannière (en dessous sur mobile) : utiliser `BannerAction`. */
  actions?: ReactNode;
  /** Contenu libre affiché sous le titre (ex : barre d'actions secondaire). */
  children?: ReactNode;
  className?: string;
};

/**
 * Bannière bleue en tête de TOUTES les pages de l'app. Même carte que
 * l'en-tête de l'accueil (dégradé, filet doré, titre en serif) et hauteur
 * réduite : titre, sous-titre et bouton tiennent sur une rangée.
 * Une page ne crée jamais son propre bandeau : elle utilise celui-ci, et
 * `BannerAction` pour ses boutons, afin que tout reste homogène.
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
        "relative overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#223b5b_0%,#1b3049_100%)] shadow-[0_18px_44px_-22px_rgba(20,34,54,0.55)]",
        className,
      )}
    >
      {/* Filet doré en haut de la carte, comme sur l'accueil */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(214,178,102,0.9)_0%,rgba(214,178,102,0.15)_34%,rgba(255,255,255,0)_70%)]" />

      <div className="relative space-y-3 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 space-y-1.5">
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
              <h1 className="break-words font-serif text-2xl font-normal leading-tight tracking-tight text-white sm:text-[28px]">
                {title}
              </h1>
              {badges}
            </div>

            {subtitle && (
              <div className="max-w-2xl text-sm leading-relaxed text-white/60">{subtitle}</div>
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

type BannerActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

/**
 * Style unique des boutons d'en-tête : blancs, même hauteur, même police,
 * sans couleur différente d'un bouton ou d'une page à l'autre. Exporté pour
 * les boutons qui ne peuvent pas utiliser `BannerAction` directement.
 */
export const BANNER_ACTION_CLASS =
  "inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-semibold text-blue-primary shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90 disabled:pointer-events-none disabled:opacity-60 lg:w-auto [&_svg]:h-4 [&_svg]:w-4";

/** Bouton d'en-tête, à placer dans `actions` de PageBanner (à droite du bandeau). */
export function BannerAction({ icon, className, children, ...rest }: BannerActionProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(BANNER_ACTION_CLASS, className)}
    >
      {icon}
      {children}
    </button>
  );
}
