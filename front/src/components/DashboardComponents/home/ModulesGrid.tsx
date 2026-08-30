import { Link } from "react-router-dom";
import {
  FileText, Handshake, Library, PenTool, ScrollText, ShieldCheck,
} from "lucide-react";

interface Props {
  /** Compteurs affichés en indice sur chaque carte. */
  counts: { contracts: number; negotiations: number; signatures: number; alerts: number };
}

/**
 * Grille « Vos modules » : raccourci vers les six outils de l'application, avec
 * un indice chiffré quand la donnée est disponible.
 */
export function ModulesGrid({ counts }: Props) {
  const modules = [
    {
      name: "Contrathèque",
      description: "Centralisez et suivez le cycle de vie de tous vos contrats.",
      icon: Library,
      iconClassName: "text-success",
      hint: counts.contracts > 0 ? `${counts.contracts} contrats` : "Vide",
      to: "/contratheque",
    },
    {
      name: "Générateur",
      description: "Créez des contrats conformes depuis vos modèles et clauses.",
      icon: FileText,
      iconClassName: "text-[#354F99]",
      hint: "",
      to: "/generateur",
    },
    {
      name: "Négociation",
      description: "Annotez, échangez les redlines et validez la version finale.",
      icon: Handshake,
      iconClassName: "text-[#7c3aed]",
      hint: counts.negotiations > 0 ? `${counts.negotiations} en cours` : "Aucune",
      to: "/negociations",
    },
    {
      name: "Analyse des risques",
      description: "Détectez les clauses déséquilibrées avant de signer.",
      icon: ShieldCheck,
      iconClassName: "text-warning",
      hint: counts.alerts > 0 ? `${counts.alerts} alertes` : "Prêt",
      to: "/conformite",
    },
    {
      name: "Bibliothèque de clauses",
      description: "Réutilisez vos clauses validées juridiquement.",
      icon: ScrollText,
      iconClassName: "text-cyan-600",
      hint: "",
      to: "/clauses",
    },
    {
      name: "Signature électronique",
      description: "Faites signer en ligne, avec valeur probante.",
      icon: PenTool,
      iconClassName: "text-info",
      hint: counts.signatures > 0 ? `${counts.signatures} en attente` : "Prêt",
      to: "/signature",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-[19px] font-normal text-ink">Vos modules</h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-subtle">
          {modules.length} outils
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#e8eaf0] bg-[#e8eaf0] sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.name}
              to={module.to}
              className="flex flex-col gap-2 bg-white px-4 pb-4 pt-4 transition-colors hover:bg-[#fafbfd]"
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-[17px] w-[17px] ${module.iconClassName}`} />
                {module.hint && (
                  <span className="whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    {module.hint}
                  </span>
                )}
              </div>
              <span className="mt-0.5 text-[13.5px] font-semibold text-ink">{module.name}</span>
              <span className="text-[12.5px] leading-snug text-ink-muted">{module.description}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
