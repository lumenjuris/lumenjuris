import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import type { RiskAlert } from "../types";

/**
 * Rail : les alertes de conformité déjà calculées (échéances dépassées,
 * négociations bloquées, tacite reconduction…). Quand il n'y en a aucune, on
 * l'affiche comme une bonne nouvelle plutôt qu'une carte vide.
 */
export function RisksCard({ alerts }: { alerts: RiskAlert[] }) {
  const navigate = useNavigate();

  return (
    <div className="card">
      <div className="card-h">
        <div className="lead"><span className="eyebrow">Conformité</span><h3>Points de vigilance</h3></div>
      </div>

      {alerts.length === 0 ? (
        <div className="allgood">
          <span className="gi"><ShieldCheck className="ic" style={{ width: 16, height: 16 }} /></span>
          Aucun point de vigilance : vos contrats sont à jour.
        </div>
      ) : (
        <div className="alerts">
          {alerts.map((alert) => (
            <div key={alert.key} className="arow" style={{ cursor: "pointer" }} onClick={() => navigate(alert.to)}>
              <span className={`adot ${alert.level}`}><AlertTriangle className="ic" style={{ width: 15, height: 15 }} /></span>
              <div>
                <div className="at">{alert.title}</div>
                <div className="am">{alert.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
