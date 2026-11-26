import * as React from "react";

/** Vues accessibles depuis le menu ("" = accueil : tuiles). */
export type Page = "" | "analyzer" | "generateurContract";

interface MenusProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const ITEMS: { page: Exclude<Page, "">; label: string; description: string; icon: string }[] = [
  {
    page: "analyzer",
    label: "Analyser un contrat",
    description: "Détecter et surligner les clauses à risque du document ouvert.",
    icon: "🔍",
  },
  {
    page: "generateurContract",
    label: "Créer un contrat",
    description: "Générer un contrat à partir de vos modèles.",
    icon: "📝",
  },
];

/**
 * Menu principal : grandes tuiles sur l'accueil, puis barre d'onglets
 * compacte une fois une vue ouverte.
 */
export const Menus = ({ currentPage, setCurrentPage }: MenusProps) => {
  if (currentPage === "") {
    return (
      <nav className="lj-menu-tiles" aria-label="Outils Lumen Juris">
        {ITEMS.map((item) => (
          <button key={item.page} type="button" className="lj-menu-tile" onClick={() => setCurrentPage(item.page)}>
            <span className="lj-menu-tile-icon" aria-hidden="true">{item.icon}</span>
            <div>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </div>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav className="lj-menu-tabs" role="tablist" aria-label="Outils Lumen Juris">
        <button
          type="button"
          role="tab"
          className={`lj-menu-tab`}
          onClick={() => setCurrentPage("")}
        >
          Retour
        </button>
    </nav>
  );
};
