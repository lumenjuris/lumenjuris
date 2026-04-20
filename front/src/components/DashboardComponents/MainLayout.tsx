import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  ShieldCheck,
  MessageSquare,
  Calculator,
  Newspaper,
  Lock,
  Scale,
  Bell,
  Search,
  PanelLeft,
  ChevronDown,
} from "lucide-react";

import HeaderNavigationBar from "../MainHeader/HeaderNavigationBar";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard" },
  { icon: FileText, label: "Générateur de modèles", path: "/generateur" },
  { icon: PenTool, label: "Signature", path: "/signature" },
  { icon: ShieldCheck, label: "Analyse de conformité", path: "/conformite" },
  { icon: MessageSquare, label: "Chat juridique RH", path: "/chatjuridique" },
  { icon: Calculator, label: "Calculateur juridique", path: "/calculateur" },
  { icon: Newspaper, label: "Veille information", path: "/veille" },
];

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/user/get", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const dataResponse = await response.json();
        if (!dataResponse.success && !dataResponse.data.profile.isVerified) {
          navigate("/inscription");
        }
      } catch (error) {}
    };
    fetchData();
  }, []);

  return (
    <div
      className="flex min-h-screen w-full bg-[#f8f9fb]"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-lumenjuris-sidebar z-20">
          <div className="p-4 pb-2">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lumenjuris">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">
                  LumenJuris
                </span>
                <span className="text-[10px] text-gray-400 leading-none">
                  Conformité RH
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-auto pt-4 px-2">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.path}>
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
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4">
            <div className="flex items-center justify-center gap-1.5 py-2">
              <Lock className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] text-gray-500">
                Données sécurisées – Hébergement UE
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? "md:ml-64" : ""}`}
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
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                size={32}
                placeholder="Rechercher un document, une clause..."
                className="bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
              />
            </div>
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
    </div>
  );
}
