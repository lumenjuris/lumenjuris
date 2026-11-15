import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Upload } from "lucide-react";

import { Seal } from "./Seal";
/* import { ThemeToggle } from "./ThemeToggle";
 */
interface Props {
  firstName: string;
  /** Vrai tant que l'utilisateur n'a rien créé : le message d'accueil change. */
  isEmpty: boolean;
  /** Nombre d'éléments en attente, repris dans l'accroche. */
  pendingActions: number;
  /** Vrai quand l'utilisateur a choisi ses outils à l'onboarding : l'accroche d'accueil y renvoie. */
  isPersonalized: boolean;
}

/** Date du jour formatée « Mardi 26 septembre », première lettre en capitale. */
function todayLabel(): string {
  const raw = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * En-tête de la console connectée : salutation éditoriale, accroche du jour et
 * les deux points d'entrée principaux (générer / importer). Pour un compte
 * encore vide, ces deux actions laissent la place aux cartes d'outils affichées
 * juste en dessous (voir `ToolCards`). L'interrupteur de thème est posé en haut
 * à droite.
 */
export function ConsoleHero({ firstName, isEmpty, pendingActions, isPersonalized }: Props) {
  const greeting = isEmpty
    ? `Bienvenue${firstName ? `, ${firstName}` : ""}.`
    : `Bonjour${firstName ? ` ${firstName}` : ""}.`;

  let subline = isPersonalized
    ? "Votre espace est prêt : les outils que vous avez choisis vous attendent juste en dessous."
    : "Commencez par un contrat : le suivi des échéances, des signatures et des risques se met en place ensuite.";
  if (!isEmpty) {
    subline = pendingActions > 0
      ? `<b>${pendingActions} action${pendingActions > 1 ? "s" : ""}</b> vous attend${pendingActions > 1 ? "ent" : ""}. Reprenez où vous vous êtes arrêté.`
      : "Rien d'urgent aujourd'hui : tous vos contrats sont à jour.";
  }

  return (
    <div className="hero">
      <div className="filet" />
      <div className="halo a" />
      <div className="halo b" />
      {/*       <ThemeToggle /> */}
      <div className="hero-in">
        <div className="hero-left">
          <div className="hero-eye"><Seal size={16} />{todayLabel()}</div>
          <h1>{greeting}</h1>
          {/* La sous-ligne peut contenir une mise en gras du nombre d'actions. */}
          <p className="sub" dangerouslySetInnerHTML={{ __html: subline }} />
        </div>

        {isEmpty ? (
          <div className="hero-visual" aria-hidden="true">
            <Seal size={150} className="bigseal" />
            <div className="fcard"><span className="fi"><Check className="ic" style={{ width: 17, height: 17 }} /></span><span><b>Lumen Juris</b><span>Mettez en lumière le juridique</span></span></div>
          </div>
        ) : (
        <div className="actions">
          <Link to="/contrat-generation?section=scratch" className="pa primary">
            <span className="paic"><Sparkles className="ic" /></span>
            <span>
              <span className="pt">Générer un contrat <ArrowRight className="ic arrow" style={{ width: 15, height: 15 }} /></span>
              <span className="pd">Rédige structure et clauses depuis votre description.</span>
            </span>
          </Link>
          <Link to="/contrat-generation?section=import" className="pa sec">
            <span className="paic"><Upload className="ic" /></span>
            <span>
              <span className="pt">Importer un contrat <ArrowRight className="ic arrow" style={{ width: 15, height: 15 }} /></span>
              <span className="pd">Dates clés et risques extraits d'un document.</span>
            </span>
          </Link>
        </div>
        )}
      </div>
    </div>
  );
}
