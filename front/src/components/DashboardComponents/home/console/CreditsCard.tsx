import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";

import type { QuotaBar, QuotaState } from "../types";

/** Classe de couleur de la barre selon l'état de consommation. */
function fillClass(state: QuotaState): string {
  if (state === "full") return "full";
  if (state === "warning") return "warn";
  return "";
}

/** Barre de jauge qui se remplit de 0 % jusqu'à sa valeur au montage. */
function QuotaFill({ percent, state }: { percent: number; state: QuotaState }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  return <div className="qbar"><i className={fillClass(state)} style={{ width: `${width}%` }} /></div>;
}

/** Découpe « 42 / 100 » en partie principale + reste atténué. */
function renderValue(text: string) {
  const slash = text.indexOf("/");
  if (slash === -1) return <span className="qv">{text}</span>;
  return (
    <span className="qv">
      {text.slice(0, slash).trim()}
      <em>&nbsp;/&nbsp;{text.slice(slash + 1).trim()}</em>
    </span>
  );
}

interface Props {
  quotas: QuotaBar[];
  planName: string;
}

/**
 * Rail : consommation de la formule. La première jauge (contrats suivis) est
 * mise en avant ; les autres passent en lignes secondaires. Le bouton renvoie
 * vers la page d'abonnement.
 */
export function CreditsCard({ quotas, planName }: Props) {
  if (quotas.length === 0) return null;
  const [main, ...rest] = quotas;

  return (
    <div className="card">
      <div className="card-h">
        <div className="lead"><span className="eyebrow">Abonnement</span><h3>Vos crédits</h3></div>
        <Link to="/souscription" className="seeall">Gérer</Link>
      </div>
      <div className="credits">
        <div className="qline">
          {renderValue(main.text)}
          <span className="qt">{main.label}</span>
        </div>
        <QuotaFill percent={main.percent} state={main.state} />
        <div className="qsub">Formule {planName}</div>

        {rest.map((quota) => (
          <div key={quota.label} className="qrow2">
            {quota.label}<span className="qn">{quota.text}</span>
          </div>
        ))}

        <Link to="/souscription" className="qbtn"><Crown className="ic" style={{ width: 14, height: 14 }} />Augmenter mes crédits</Link>
      </div>
    </div>
  );
}
