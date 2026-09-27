import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Eye, FileText, Library, Lock, MessageSquare, MessagesSquare,
  PenTool, ScrollText, ShieldCheck, Sparkles, Upload,
} from "lucide-react";

import { Seal } from "./Seal";
/* import { ThemeToggle } from "./ThemeToggle";*/
import { useDemandeConnexion } from "../../../auth/useDemandeConnexion";

/** Suggestions qui remplissent le champ de génération au clic. */
const CHIPS: { label: string; fill: string }[] = [
  { label: "Prestation de service", fill: "un contrat de prestation de service pour une mission de 3 mois" },
  { label: "Confidentialité (NDA)", fill: "un accord de confidentialité (NDA) mutuel entre deux sociétés" },
  { label: "Bail commercial", fill: "un bail commercial 3/6/9 pour un local de 80 m²" },
  { label: "CDD", fill: "un CDD de 6 mois pour un poste de développeur" },
  { label: "Cession de droits", fill: "une cession de droits d'auteur pour un logo et une identité visuelle" },
];

type Demo = "doc" | "risk" | "chat" | "sign";

const MODULES: { icon: React.ElementType; label: string; description: string; path: string; demo: Demo }[] = [
  { icon: Library, label: "Contrathèque", description: "Tous vos contrats classés, avec dates clés et statuts.", path: "/contratheque", demo: "doc" },
  { icon: FileText, label: "Génération de contrat", description: "Rédige structure et clauses depuis une simple description.", path: "/generateur", demo: "doc" },
  { icon: MessagesSquare, label: "Négociation", description: "Échangez les versions et suivez chaque modification.", path: "/negociations", demo: "chat" },
  { icon: ShieldCheck, label: "Analyse des risques", description: "Clauses sensibles surlignées et notées par niveau.", path: "/conformite", demo: "risk" },
  { icon: PenTool, label: "Signature", description: "Envoyez à signer et suivez chaque signataire.", path: "/signature", demo: "sign" },
  { icon: ScrollText, label: "Bibliothèque de clauses", description: "Vos clauses types, prêtes à réutiliser d'un contrat à l'autre.", path: "/clauses", demo: "doc" },
  { icon: Eye, label: "Comprendre ses contrats", description: "Résumé et obligations d'un contrat en langage clair.", path: "/comprendre-contrat", demo: "doc" },
  { icon: MessageSquare, label: "Chat juridique", description: "Posez vos questions juridiques au fil du travail.", path: "/chatjuridique", demo: "chat" },
];

/** Rend le mini-aperçu animé au survol propre à chaque famille d'outil. */
function DemoStrip({ type }: { type: Demo }) {
  if (type === "risk") {
    return (
      <span className="demo risk">
        <i style={{ background: "var(--green)" }} /><i style={{ background: "var(--amber)" }} /><i style={{ background: "var(--red)" }} />
      </span>
    );
  }
  if (type === "chat") return <span className="demo chat"><i className="a" /><i className="b" /></span>;
  if (type === "sign") {
    return (
      <span className="demo sign">
        <svg viewBox="0 0 120 38" preserveAspectRatio="none"><path d="M8 26 C20 6 30 6 34 20 S48 34 56 20 S72 4 84 22 C90 30 100 30 112 15" /></svg>
      </span>
    );
  }
  return <span className="demo doc"><i /><i /><i /></span>;
}

/**
 * Accueil visiteur : un lanceur d'outils, pas une page vitrine (la vitrine SEO
 * existe déjà). Le visiteur arrive avec une intention — on l'amène à agir tout
 * de suite. Chaque action ouvre le panneau de connexion en retenant la
 * destination (« connexion à la demande »).
 */
export function VisitorLauncher() {
  const [brief, setBrief] = useState("");
  const demanderConnexion = useDemandeConnexion();

  return (
    <>
      <div className="hero">
        <div className="filet" />
        <div className="halo a" />
        <div className="halo b" />
        {/* <ThemeToggle /> ACTIVATION DU SWITCH MODE SOMBRE/CLAIR DESACTIVE LE TEMPS D AVOIR PASSER TOUTE L APP AU MODE SOMBRE*/}
        <div className="hero-in">
          <div className="">
            <div className="hero-eye"><Seal size={16} />Espace de travail</div>
            <h1>Vos contrats méritent mieux que des heures de gestion.</h1>
            <p className="sub">Analysez, rédigez, signez et pilotez vos contrats depuis un seul espace.</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <Seal size={150} className="bigseal" />
            <div className="fcard"><span className="fi"><Check className="ic" style={{ width: 17, height: 17 }} /></span><span><b>Lumen Juris</b><span>Mettez en lumière le juridique</span></span></div>
          </div>
        </div>
      </div>

      <div className="launch">
        <div className="gen">
          <div className="genhead">
            <span className="gi"><Sparkles className="ic" /></span>
            <div><h3>Générer un contrat</h3><div className="gs">Décrivez votre besoin en une phrase.</div></div>
          </div>
          <div className="genbox">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ex. : un contrat de prestation de service pour une mission de design de 3 mois, paiement en deux fois…"
            />
          </div>
          <div className="chips">
            {CHIPS.map((chip) => (
              <button key={chip.label} type="button" className="chipx" onClick={() => setBrief(chip.fill)}>{chip.label}</button>
            ))}
          </div>
          <div className="genrun">
            <span className="free"><Check className="ic" style={{ width: 14, height: 14 }} />Connexion demandée pour enregistrer</span>
            <Link
              to="/contrat-generation?section=scratch"
              className="btn-gen"
              onClick={(e) => demanderConnexion(e, "/contrat-generation?section=scratch")}
            >
              Rédiger le contrat <ArrowRight className="ic" style={{ width: 15, height: 15 }} />
            </Link>
          </div>
        </div>

        <div className="drops">
          <Link to="/contrat-generation?section=import" className="drop" onClick={(e) => demanderConnexion(e, "/contrat-generation?section=import")}>
            <div className="dh"><span className="di"><Upload className="ic" /></span><b>Importer un contrat</b></div>
            <p>Déposez un PDF ou un Word — dates clés, échéances et risques extraits automatiquement.</p>
            <span className="dgo">Déposer un fichier <ArrowRight className="ic" style={{ width: 14, height: 14 }} /></span>
          </Link>
          <Link to="/conformite" className="drop" onClick={(e) => demanderConnexion(e, "/conformite")}>
            <div className="dh"><span className="di"><ShieldCheck className="ic" /></span><b>Analyser les risques</b></div>
            <p>Les clauses sensibles surlignées et notées, avec une reformulation proposée.</p>
            <span className="dgo">Analyser un document <ArrowRight className="ic" style={{ width: 14, height: 14 }} /></span>
          </Link>
        </div>
      </div>

      <div className="allhead">
        <span className="eyebrow">Tous les outils</span>
      </div>

      <div className="mods">
        {MODULES.map((mod) => (
          <Link key={mod.path} to={mod.path} className="mcard" onClick={(e) => demanderConnexion(e, mod.path)}>
            <span className="top"><span className="mi"><mod.icon className="ic" /></span><b>{mod.label}</b></span>
            <DemoStrip type={mod.demo} />
            <p>{mod.description}</p>
            <span className="open">Ouvrir l'outil <ArrowRight className="ic" style={{ width: 14, height: 14 }} /></span>
          </Link>
        ))}
      </div>

      <div className="reassure">
        <span className="r"><Check className="ic" />Conforme RGPD</span>
        <span className="r"><Lock className="ic" />Données chiffrées</span>
        <span className="r"><Check className="ic" />Hébergé en France</span>
        {/* <span className="r"><Check className="ic" />Signature conforme eIDAS</span> */}
      </div>
    </>
  );
}
