import { Link } from "react-router-dom";

import type { KpiCard } from "../types";
import { useCountUp } from "../useCountUp";

/** Tuile KPI : grand chiffre animé + libellé, cliquable vers le module concerné. */
function KpiTile({ kpi }: { kpi: KpiCard }) {
  const value = useCountUp(kpi.value);
  // Le `hint` (« · 2 en retard », « · 3 propositions ») porte l'alerte : rouge
  // pour un retard, orange sinon.
  const tone = kpi.hint.includes("retard") ? "red" : kpi.hint ? "amber" : "";

  return (
    <Link to={kpi.to} className="kpi">
      <div className="lab">{kpi.label}</div>
      <div className="row">
        <span className="val tnum">{value}</span>
        {kpi.hint && <span className={`hint ${tone}`}>{kpi.hint.replace(/^·\s*/, "")}</span>}
      </div>
    </Link>
  );
}

/**
 * Bande de repères du portefeuille. Les compteurs marqués `hideWhenZero` qui
 * valent 0 sont retirés : une ligne à zéro n'apprend rien.
 */
export function ConsoleKpis({ kpis }: { kpis: KpiCard[] }) {
  const visible = kpis.filter((kpi) => !kpi.hideWhenZero || kpi.value > 0);
  if (visible.length === 0) return null;

  return (
    <div className="kpis">
      {visible.map((kpi) => <KpiTile key={kpi.label} kpi={kpi} />)}
    </div>
  );
}
