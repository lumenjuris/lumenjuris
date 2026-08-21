import { useEffect, useState, useCallback } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  ShieldCheck,
  MessageSquare,
  Newspaper,
  Library,
  ChevronDown,
  Droplets,
  BookOpen,
  Upload,
  ScrollText,
  PanelLeft,
  X,
  Sparkles,
  ShieldHalf,
  MessagesSquare
} from "lucide-react";

import HeaderNavigationBar from "../MainHeader/HeaderNavigationBar";
import { FeedbackWidget } from "../common/FeedbackWidget";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";
import { useLegalWatchStore } from "../../store/legalWatchStore";
import { LumenJurisLogo } from "../common/LumenJurisLogo";
import { useUserStore } from "../../store/userStore";

import { ErrorBoundary } from "../ContractAnalysis/ErrorBoundary";

interface NavSubItem {
  icon: React.ElementType;
  label: string;
  path: string;
  notificationKey?: "templateAdded";
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  notificationKey?: string;
  children?: NavSubItem[];
}

interface NavSection {
  category?: string; // Ex: "CONTRATS", "PILOTAGE" (facultatif pour la section Accueil)
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    // Pas de catégorie pour l'accueil
    items: [
      { icon: LayoutDashboard, label: "Accueil", path: "/dashboard" }
    ],
  },
  {
    category: "CONTRATS",
    items: [
      { icon: Library, label: "Contrathèque", path: "/contratheque" },
      {
        icon: FileText,
        label: "Générateur de contrat",
        path: "/generateur",
        children: [
          { icon: Sparkles, label: "Créer de zéro", path: "/contrat-generation?section=scratch" },
          { icon: Upload, label: "Importer un modèle", path: "/contrat-generation?section=import" },
          { icon: BookOpen, label: "Bibliothèque de modèles", path: "/contrat-generation?section=library", notificationKey: "templateAdded" },
          { icon: Droplets, label: "Mes images", path: "/generateur/filigranes" },
        ],
      },
      { icon: MessagesSquare, label: "Négociation", path: "/negociations" },
      { icon: PenTool, label: "Signature", path: "/signature" },
    ],
  },
  {
    category: "PILOTAGE",
    items: [
      { icon: ScrollText, label: "Bibliothèque de clauses", path: "/clauses" },
      { icon: ShieldCheck, label: "Analyse des risques", path: "/conformite" },
      { icon: ShieldCheck, label: "Comprendre ses contrats", path: "/comprendre-contrat" },
      { icon: MessageSquare, label: "Chat juridique", path: "/chatjuridique" },
      { icon: Newspaper, label: "Actualité juridique", path: "/veille", notificationKey: "legalWatchUnread" },
    ],
  },
];

// Breakpoint Tailwind `md` = 768px. On garde la même valeur en JS pour rester cohérent.
const MOBILE_BREAKPOINT = 768;

function NavChildLink({ child, onNavigate }: { child: NavSubItem; onNavigate: () => void }) {
  const location = useLocation();
  const pulse = useTemplateNotificationStore((s) => s.pulse);
  const pendingCount = useTemplateNotificationStore((s) => s.pendingCount);

  const fullPath = location.pathname + (location.search || "");
  const isActive = fullPath === child.path;
  const showBadge = child.notificationKey === "templateAdded" && pulse;

  return (
    <li>
      <NavLink
        to={child.path}
        onClick={onNavigate}
        className={`relative flex w-full items-center gap-2 rounded-md px-2 py-2 sm:py-1.5 text-sm transition-colors ${
          isActive
            ? "bg-white/15 text-white font-medium"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <child.icon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{child.label}</span>
        {showBadge && (
          <span
            className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full shadow"
            style={{ animation: "templateAddedPulse 0.6s ease-out, templateAddedFade 3s ease-in-out" }}
          >
            +{pendingCount}
          </span>
        )}
      </NavLink>
    </li>
  );
}

function NavItemRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const location = useLocation();
  const legalWatchUnread = useLegalWatchStore((s) => s.unreadCount);
  const badgeCount = item.notificationKey === "legalWatchUnread" ? legalWatchUnread : 0;
  const hasChildren = !!item.children?.length;
  const isParentActive = location.pathname.startsWith(item.path);
  const [hovered, setHovered] = useState(false);
  const open = hovered || isParentActive;

  return (
    <li
      onMouseEnter={hasChildren ? () => setHovered(true) : undefined}
      onMouseLeave={hasChildren ? () => setHovered(false) : undefined}
    >
      {hasChildren ? (
        <>
          <NavLink
            to={item.path}
            onClick={onNavigate}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 sm:py-2.5 text-sm transition-all ${
              isParentActive
                ? "bg-white/15 text-white font-medium"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isParentActive ? "text-white" : "text-white/70"}`} />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-white/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </NavLink>
          {open && (
            <ul className="mt-0.5 ml-5 border-l border-white/20 pl-3 flex flex-col gap-0.5">
              {item.children!.map((child) => (
                <NavChildLink key={child.path} child={child} onNavigate={onNavigate} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <NavLink
          to={item.path}
          end={item.path === "/dashboard"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex w-full items-center gap-3 rounded-lg px-3 py-3 sm:py-2.5 text-sm transition-all ${
              isActive
                ? "bg-white/15 text-white font-medium"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-white/70"}`} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </>
          )}
        </NavLink>
      )}
    </li>
  );
}

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const userData = useUserStore((s) => s.userData);
  const isAdmin = userData?.profile?.role === "ADMIN";
  const location = useLocation();
  const refreshUnreadCount = useLegalWatchStore((s) => s.refreshUnreadCount);

  // Pastille veille juridique : chargée à l'ouverture, rafraîchie toutes les 5 min.
  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  // sidebarOpen pilote à la fois :
  // - le drawer mobile/tablette (overlay)
  // - le collapse desktop (sidebar rétractable)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= MOBILE_BREAKPOINT
  );

  // Ajuste automatiquement l'état lors d'un resize (ex: rotation tablette, redimensionnement fenêtre)
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    const handleChange = (e: MediaQueryListEvent) => {
      setSidebarOpen(e.matches);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Bloque le scroll du body quand le drawer mobile est ouvert
  useEffect(() => {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Ferme le drawer uniquement sur mobile/tablette après un clic sur un lien
  const handleNavigate = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ── Overlay mobile/tablette ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-72 sm:w-64 bg-blue-primary z-30 flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + bouton fermeture (mobile only) */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <Link to="/dashboard" className="flex items-center" onClick={handleNavigate}>
            <LumenJurisLogo variant="dark" height={30} />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="md:hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 bg-blue-primary">
          <div className="flex flex-col gap-6">
            {navSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="flex flex-col gap-1">
                {/* Titre de catégorie (ex: CONTRATS, PILOTAGE) */}
                {section.category && (
                  <h3 className="px-3 text-[11px] font-semibold tracking-wider text-sky-300 uppercase mb-1">
                    {section.category}
                  </h3>
                )}

                {/* Liste d'éléments */}
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <NavItemRow key={item.path} item={item} onNavigate={handleNavigate} />
                  ))}

                  {/* Menu Admin dans Pilotage si administrateur */}
                  {section.category === "PILOTAGE" && isAdmin && (
                    <NavItemRow
                      item={{ icon: ShieldHalf, label: "Monitoring", path: "/monitoring" }}
                      onNavigate={handleNavigate}
                    />
                  )}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* ── Zone principale ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-0"}`}>
        <header className="h-16 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10 border-b border-line">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
            aria-label={sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
            aria-expanded={sidebarOpen}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-surface-muted hover:text-ink active:scale-95"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <HeaderNavigationBar />
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-7">
          <ErrorBoundary key={location.pathname}>
            {children ?? <Outlet />}
          </ErrorBoundary>
        </main>
      </div>

      <FeedbackWidget />

      <style>{`
        @keyframes templateAddedPulse {
          0%   { transform: scale(0.3); opacity: 0; }
          50%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes templateAddedFade {
          0%   { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
