import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import type { ToolCard } from "./toolCatalog";

interface Props {
  cards: ToolCard[];
  /** Vrai quand les cartes viennent des choix de l'onboarding, faux pour les cartes par défaut. */
  isPersonalized: boolean;
}

/**
 * Colonne principale : une carte par outil. Les outils sont ceux que
 * l'utilisateur a choisis à l'onboarding, ou trois cartes par défaut.
 *
 * Tant que l'outil n'a pas servi, la carte invite à commencer ; ensuite elle
 * affiche son volume (« 3 contrats suivis ») et un simple lien d'ouverture.
 */
export function ToolCards({ cards, isPersonalized }: Props) {
  if (cards.length === 0) return null;

  return (
    <section>
      <div className="tools-h">
        <span className="eyebrow">Vos outils</span>
        <h3>{isPersonalized ? "Votre sélection" : "Pour bien démarrer"}</h3>
      </div>

      <div className="tools">
        {cards.map((card) => (
          <Link key={card.key} to={card.to} className="tool">
            <span className="tic"><card.icon className="ic" /></span>
            <span className="tt">{card.title}</span>
            <span className="td">{card.description}</span>
            {card.status && <span className="ts">{card.status}</span>}
            <span className="tgo">
              {card.status ? "Ouvrir" : "Commencer"}
              <ArrowRight className="ic arrow" style={{ width: 14, height: 14 }} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
