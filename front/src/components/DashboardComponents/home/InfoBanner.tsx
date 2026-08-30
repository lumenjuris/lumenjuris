import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Info, Sparkles, Wrench, X } from "lucide-react";

/** Les quatre tonalités possibles du bandeau. */
type BannerTone = "info" | "nouveau" | "alerte" | "maintenance";

interface BannerContent {
  tone: BannerTone;
  title: string;
  message: string;
  /** Lien optionnel « En savoir plus ». */
  ctaLabel?: string;
  ctaTo?: string;
}

/**
 * Contenu du bandeau d'annonce affiché en haut de l'accueil.
 * Mettre `null` pour ne rien afficher.
 */
const BANNER: BannerContent | null = {
  tone: "nouveau",
  title: "Négociation collaborative disponible",
  message: "Invitez la partie adverse à commenter vos clauses directement dans Lumen Juris.",
  ctaLabel: "Découvrir",
  ctaTo: "/negociations",
};

/** Habillage de chaque tonalité : couleurs, icône et libellé de catégorie. */
const TONE_STYLE: Record<BannerTone, {
  kind: string;
  icon: React.ElementType;
  accent: string;
  background: string;
  border: string;
  iconBackground: string;
}> = {
  info: {
    kind: "Information", icon: Info, accent: "text-blue-primary",
    background: "bg-[#f2f5fc]", border: "border-[#d5dcf0]", iconBackground: "bg-[#e3e9f7]",
  },
  nouveau: {
    kind: "Nouveauté", icon: Sparkles, accent: "text-cyan-600",
    background: "bg-[#f0fbfd]", border: "border-[#c5e9f0]", iconBackground: "bg-[#d9f4f9]",
  },
  alerte: {
    kind: "Important", icon: AlertTriangle, accent: "text-red-primary",
    background: "bg-[#fef4f4]", border: "border-[#f6cdd0]", iconBackground: "bg-[#fde0e2]",
  },
  maintenance: {
    kind: "Maintenance", icon: Wrench, accent: "text-warning",
    background: "bg-[#fffaf0]", border: "border-[#f4e0bb]", iconBackground: "bg-[#fdf0d5]",
  },
};

/** Bandeau d'annonce refermable, affiché au-dessus du tableau de bord. */
export function InfoBanner() {
  const [visible, setVisible] = useState(true);

  if (!BANNER || !visible) return null;

  const style = TONE_STYLE[BANNER.tone];
  const Icon = style.icon;

  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${style.background} ${style.border}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md p-1.5 ${style.iconBackground} ${style.accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className={`text-2xs font-semibold uppercase tracking-[0.1em] ${style.accent}`}>
            {style.kind}
          </span>
          <span className="text-[13px] font-semibold text-ink">{BANNER.title}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">{BANNER.message}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {BANNER.ctaLabel && BANNER.ctaTo && (
          <Link
            to={BANNER.ctaTo}
            className={`flex h-7 items-center gap-1.5 rounded-md border bg-white px-3 text-[12.5px] font-semibold whitespace-nowrap ${style.border} ${style.accent}`}
          >
            {BANNER.ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Masquer l'annonce"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-md p-1 text-ink-subtle transition-colors hover:bg-black/5 hover:text-ink-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
