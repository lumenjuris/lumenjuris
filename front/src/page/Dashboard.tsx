//import InputFile from "../components/common/InputFile";
import { Link} from "react-router-dom";
import {
  Library, FileText, ShieldCheck, ScrollText, PenTool, 
  ArrowRight, Newspaper, Tag, Handshake,
} from "lucide-react";

import { useUserStore } from "../store/userStore";
interface Tool {
  icon: React.ElementType;
  title: string;
  desc: string;
  to: string;
  accent: string; // couleur d'accent de l'icône
}

const TOOLS: Tool[] = [
  {
    icon: Library,
    title: "Contrathèque",
    desc: "Centralisez et suivez le cycle de vie de tous vos contrats au même endroit.",
    to: "/contratheque",
    accent: "#354F99",
  },
  {
    icon: FileText,
    title: "Générateur de modèles",
    desc: "Créez des contrats conformes à partir de vos modèles et clauses approuvées.",
    to: "/generateur",
    accent: "#059669",
  },
  {
    icon: Handshake,
    title: "Négociation",
    desc: "Annotez le contrat, échangez les redlines et validez la version finale.",
    to: "/contratheque",
    accent: "#7c3aed",
  },
  {
    icon: PenTool,
    title: "Signature électronique",
    desc: "Faites signer vos contrats en ligne, en toute sécurité.",
    to: "/signature",
    accent: "#2563eb",
  },
  {
    icon: ShieldCheck,
    title: "Analyse des risques",
    desc: "Vérifiez vos documents et détectez les clauses à risque.",
    to: "/conformite",
    accent: "#d97706",
  },
  {
    icon: ScrollText,
    title: "Bibliothèque de clauses",
    desc: "Réutilisez vos clauses validées juridiquement à chaque rédaction.",
    to: "/clauses",
    accent: "#0891b2",
  },
];

const VEILLE = [
  { tag: "Temps de travail", tagColor: "#059669", title: "Nouvelle obligation d'information des salariés en CDD", date: "28 fév. 2026" },
  { tag: "Rupture", tagColor: "#d97706", title: "Réforme des indemnités prud'homales : barème actualisé", date: "25 fév. 2026" },
  { tag: "Discipline", tagColor: "#7c3aed", title: "Procédure disciplinaire : nouveaux délais de prescription", date: "22 fév. 2026" },
];

export function Dashboard() {
  const userData = useUserStore((s) => s.userData);
  const firstName = userData?.profile?.prenom;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Bienvenue */}
      <div>
        <h1 className="text-3xl font-bold text-ink tracking-tight">
          Bienvenue{firstName ? ` ${firstName}` : ""} sur LumenJuris <span aria-hidden>👋</span>
        </h1>
        <p className="text-base text-ink-muted mt-2">
          Gérez le cycle de vie de vos contrats en toute simplicité.
        </p>
      </div>

      {/* Nos indispensables */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">Nos indispensables</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              className="group flex flex-col bg-white rounded-card border border-line shadow-card p-5 hover:shadow-card-md hover:border-line-emphasis transition-all"
            >
              <div
                className="w-11 h-11 rounded-panel flex items-center justify-center mb-4"
                style={{ backgroundColor: t.accent + "14" }}
              >
                <t.icon className="w-5 h-5" style={{ color: t.accent }} />
              </div>
              <p className="text-sm font-bold text-ink">{t.title}</p>
              <p className="text-sm text-ink-muted leading-relaxed mt-1.5 flex-1">{t.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand mt-4">
                Découvrir
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Veille juridique */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Veille juridique</h2>
          <Link to="/veille" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover transition-colors">
            Tout voir <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VEILLE.map((v, i) => (
            <Link
              key={i}
              to="/veille"
              className="group bg-white rounded-card border border-line shadow-card p-4 hover:border-line-emphasis transition-all"
            >
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-chip"
                style={{ backgroundColor: v.tagColor + "18", color: v.tagColor }}
              >
                <Tag className="w-3 h-3" /> {v.tag}
              </span>
              <p className="text-sm font-medium text-ink leading-snug mt-2.5 group-hover:text-brand transition-colors">{v.title}</p>
              <p className="text-xs text-ink-subtle mt-2 inline-flex items-center gap-1.5">
                <Newspaper className="w-3 h-3" /> {v.date}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
