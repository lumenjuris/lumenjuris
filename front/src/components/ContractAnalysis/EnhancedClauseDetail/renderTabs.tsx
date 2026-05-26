import { Dispatch, SetStateAction } from "react";
import { Tab } from "./EnhancedClauseDetail";
import { FileText, Gavel, HelpCircle } from "lucide-react";

export function renderTabs(tab: string, setTab: Dispatch<SetStateAction<Tab>>) {
  // TABS static outside component to avoid re-creation each render
  const TABS_CONFIG: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Aperçu", icon: FileText },
    { id: "cases", label: "Jurisprudence", icon: Gavel },
    { id: "chat", label: "Questions", icon: HelpCircle },
  ];

  return (
    <nav className="flex gap-4 border-b px-4 pt-3 pb-2 text-sm font-medium overflow-x-auto bg-white">
      {TABS_CONFIG.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id as Tab)}
          className={`flex items-center gap-1 pb-2 whitespace-nowrap ${
            tab === id
              ? "border-b-2 border-slate-800 text-slate-800"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon size={12} /> {label}
        </button>
      ))}
    </nav>
  );
}
