import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Info, RefreshCw, Sparkles, Wrench, X } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import {
  BannerApiResponse,
  BannerMessage,
  BannerMessageType,
  isBannerActive,
} from "../../../types/messageBanner";

/** Clé localStorage listant les identifiants des bandeaux déjà fermés. */
const CLOSED_BANNERS_STORAGE_KEY = "lumenjuris.bandeaux-fermes";

/** Habillage de chaque catégorie : couleurs, icône et libellé affiché. */
const TYPE_STYLE: Record<BannerMessageType, {
  kind: string;
  icon: React.ElementType;
  accent: string;
  background: string;
  border: string;
  iconBackground: string;
}> = {
  information: {
    kind: "Information", icon: Info, accent: "text-blue-primary",
    background: "bg-[#f2f5fc]", border: "border-[#d5dcf0]", iconBackground: "bg-[#e3e9f7]",
  },
  nouveaute: {
    kind: "Nouveauté", icon: Sparkles, accent: "text-cyan-600",
    background: "bg-[#f0fbfd]", border: "border-[#c5e9f0]", iconBackground: "bg-[#d9f4f9]",
  },
  update: {
    kind: "Mise à jour", icon: RefreshCw, accent: "text-indigo-600",
    background: "bg-[#f4f4fd]", border: "border-[#d7d7f2]", iconBackground: "bg-[#e6e6fa]",
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

/** Style de repli si le backend renvoie une catégorie inconnue. */
const DEFAULT_TYPE_STYLE = TYPE_STYLE.information;

/** Lit la liste des bandeaux fermés (le localStorage peut être indisponible). */
function readClosedBanners(): string[] {
  try {
    const stored = localStorage.getItem(CLOSED_BANNERS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClosedBanners(keys: string[]) {
  try {
    localStorage.setItem(CLOSED_BANNERS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Mode navigation privée ou stockage bloqué : on ignore, la fermeture ne
    // sera simplement pas mémorisée d'un rechargement à l'autre.
  }
}

/**
 * Bandeaux d'annonce refermables, affichés au-dessus du tableau de bord.
 *
 * Les messages viennent de `GET /api/admin/message-banner` ; seuls ceux dont la
 * période de diffusion couvre la date du jour et que l'utilisateur n'a pas déjà
 * fermés sont rendus.
 */
export function InfoBanner() {
  const [messages, setMessages] = useState<BannerMessage[]>([]);
  const [closedKeys, setClosedKeys] = useState<string[]>(readClosedBanners);

  useEffect(() => {
    fetchProxy("/api/admin/message-banner", { method: "GET" })
      .then((r) => r.json())
      .then((response: BannerApiResponse) => {
        setMessages(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error("Erreur lors de la récupération des messages du bandeau :\n", err);
      });
  }, []);

  const closeBanner = (id: string) => {
    const updated = [...closedKeys, id];
    setClosedKeys(updated);
    saveClosedBanners(updated);
  };

  const now = Date.now();
  const visibleMessages = messages.filter(
    (message) => isBannerActive(message, now) && !closedKeys.includes(message.id),
  );

  if (visibleMessages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visibleMessages.map((message) => {
        const style = TYPE_STYLE[message.messageType] ?? DEFAULT_TYPE_STYLE;
        const Icon = style.icon;

        return (
          <div
            key={message.id}
            className={`flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${style.background} ${style.border}`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md p-1.5 ${style.iconBackground} ${style.accent}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>

              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className={`text-2xs font-semibold uppercase tracking-[0.1em] ${style.accent}`}>
                  {style.kind}
                </span>
                <span className="text-[13px] font-semibold text-ink">{message.title}</span>
                <span className="text-[12.5px] leading-snug text-ink-muted">{message.content}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {message.link && (
                <BannerLink link={message.link} className={`${style.border} ${style.accent}`} />
              )}
              <button
                type="button"
                onClick={() => closeBanner(message.id)}
                aria-label="Masquer l'annonce"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md p-1 text-ink-subtle transition-colors hover:bg-black/5 hover:text-ink-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bouton « En savoir plus ». Une adresse commençant par `http` ouvre un onglet
 * externe, sinon on reste dans l'application via le routeur.
 */
function BannerLink({ link, className }: { link: string; className: string }) {
  const style = `flex h-7 items-center gap-1.5 rounded-md border bg-white px-3 text-[12.5px] font-semibold whitespace-nowrap ${className}`;
  const label = (
    <>
      En savoir plus
      <ArrowRight className="h-3.5 w-3.5" />
    </>
  );

  if (link.startsWith("http")) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={style}>
        {label}
      </a>
    );
  }

  return (
    <Link to={link} className={style}>
      {label}
    </Link>
  );
}
