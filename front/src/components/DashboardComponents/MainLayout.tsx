import { useState } from "react";
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
  Users,
} from "lucide-react";

import HeaderNavigationBar from "../MainHeader/HeaderNavigationBar";
import { FeedbackWidget } from "../common/FeedbackWidget";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";
import { LumenJurisLogo } from "../common/LumenJurisLogo";
import { useUserStore } from "../../store/userStore";


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
  children?: NavSubItem[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Accueil", path: "/dashboard" },
  { icon: Library, label: "Contrathèque", path: "/contratheque" },
  {
    icon: FileText,
    label: "Générateur de modèles",
    path: "/generateur",
    children: [
      { icon: Upload, label: "Importer un modèle", path: "/contrat-generation?section=import" },
      { icon: BookOpen, label: "Bibliothèque de modèles", path: "/contrat-generation?section=library", notificationKey: "templateAdded" },
      { icon: Droplets, label: "Mes filigranes", path: "/generateur/filigranes" },
    ],
  },
  { icon: PenTool, label: "Signature", path: "/signature" },
  { icon: ScrollText, label: "Bibliothèque de clauses", path: "/clauses" },
  { icon: ShieldCheck, label: "Analyse des risques", path: "/conformite" },
  { icon: MessageSquare, label: "Chat juridique", path: "/chatjuridique" },
  { icon: Newspaper, label: "Veille information", path: "/veille" },
];

function NavChildLink({ child }: { child: NavSubItem }) {
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
        className={`relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? "text-brand font-medium"
            : "text-ink-muted hover:bg-surface-muted hover:text-ink-secondary"
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

function NavItemRow({ item }: { item: NavItem }) {
  const location = useLocation();
  const hasChildren = !!item.children?.length;
  const isParentActive = location.pathname.startsWith(item.path);
  const [open, setOpen] = useState(isParentActive);

  return (
    <li>
      {hasChildren ? (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
              isParentActive
                ? "bg-brand-light text-brand font-medium"
                : "text-ink-secondary hover:bg-surface-muted"
            }`}
          >
            <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isParentActive ? "text-brand" : "text-ink-subtle"}`} />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <ul className="mt-0.5 ml-5 border-l border-line pl-3 flex flex-col gap-0.5">
              {item.children!.map((child) => (
                <NavChildLink key={child.path} child={child} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <NavLink
          to={item.path}
          end={item.path === "/dashboard"}
          className={({ isActive }) =>
            `group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
              isActive
                ? "bg-brand-light text-brand font-medium"
                : "text-ink-secondary hover:bg-surface-muted"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-brand" : "text-ink-subtle"}`} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      )}
    </li>
  );
}

export function MainLayout() {
  const userData = useUserStore((s) => s.userData);
  const isAdmin = userData?.profile?.role === "ADMIN";

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ── Sidebar (fond blanc — seul le bloc nav porte le fond teinté arrondi) ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-white z-20">
        {/* Logo — séparé du menu par une ligne fine (alignée avec le header) */}
        <div className="h-16 px-4 flex items-center border-b border-line">
          <Link to="/dashboard" className="flex items-center">
            <LumenJurisLogo variant="light" height={30} />
          </Link>
        </div>

        {/* Navigation — sidebar blanche, seul le lien actif porte un fond */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
            {isAdmin && (
              <NavItemRow item={{ icon: Users, label: "Utilisateurs", path: "/utilisateurs" }} />
            )}
          </ul>
        </nav>
      </aside>

      {/* ── Zone principale ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Header — ligne fine en bas pour séparer du contenu, alignée avec la sidebar */}
        <header className="h-16 bg-white flex items-center justify-end px-4 lg:px-6 sticky top-0 z-10 border-b border-line">
          <HeaderNavigationBar />
        </header>

        {/* Contenu des pages */}
        <main className="flex-1 overflow-auto p-5 lg:p-7">
          <Outlet />
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
