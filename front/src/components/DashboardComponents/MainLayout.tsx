import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  ShieldCheck,
  MessageSquare,
  Newspaper,
  Lock,
  Scale,
  Settings,
  PanelLeft,
  ChevronDown,
  Droplets,
  BookOpen,
  Upload,
} from "lucide-react";



import HeaderNavigationBar from "../MainHeader/HeaderNavigationBar";
import { useUserStore } from "../../store/userStore";
import { FeedbackWidget } from "../common/FeedbackWidget";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";

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
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard" },
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
  { icon: ShieldCheck, label: "Analyse de conformité", path: "/conformite" },
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
            ? "text-white font-medium"
            : "text-gray-500 hover:bg-white/5 hover:text-white"
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
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
              isParentActive
                ? "bg-white/10 text-white font-medium"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <ul className="mt-0.5 ml-6 flex flex-col gap-0.5">
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
            `flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
              isActive
                ? "bg-white/10 text-white font-medium"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      )}
    </li>
  );
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      className="flex min-h-screen w-full bg-[#f8f9fb]"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-lumenjuris-sidebar z-20 transition-all duration-300`}
      >
        <div className="p-4 pb-2">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lumenjuris">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-tight">
                LumenJuris
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-auto pt-4 px-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </ul>
        </nav>


        <div className="px-2 pb-2">
          <NavLink
            to="/mon-compte"
            className={({ isActive }) =>
              `flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Paramètres</span>
          </NavLink>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-center gap-1.5 py-2 border-t border-white/5">
            <Lock className="h-3 w-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">
              Données sécurisées – Hébergement UE
            </span>
          </div>
        </div>
      </aside>
      

      {/* ── Main ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? "md:ml-64" : ""} transition-all duration-300`}
      >
        {/* Header */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            {/* <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                size={32}
                placeholder="Rechercher un document, une clause..."
                className="bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
              />
            </div> */}
          </div>

          <HeaderNavigationBar />
          {/* <div className="flex items-center gap-3">
            
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-400" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="h-8 w-8 rounded-full bg-lumenjuris flex items-center justify-center text-white text-xs font-medium">
                ML
              </div>
              <div className="hidden md:flex items-center gap-1 cursor-pointer">
                <span className="text-sm font-medium text-gray-800">
                  Marie L.
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
          </div> */}
        </header>

        {/* Page content via nested routes */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Feedback flottant */}
      <FeedbackWidget />

      {/* Keyframes pour l'animation du badge "+1" sur Contrat tech */}
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
