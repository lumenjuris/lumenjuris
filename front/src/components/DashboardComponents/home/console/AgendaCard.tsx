import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import type { DeadlineCard } from "../types";

/** Couleur de la barre de gauche déduite de la tonalité de l'échéance. */
function barColor(tagClassName: string): string {
  if (tagClassName.includes("red")) return "var(--red)";
  if (tagClassName.includes("warning") || tagClassName.includes("amber")) return "var(--amber)";
  return "var(--info)";
}

/** Rail : les prochaines échéances, les plus proches d'abord. */
export function AgendaCard({ items }: { items: DeadlineCard[] }) {
  const navigate = useNavigate();

  return (
    <div className="card">
      <div className="card-h">
        <div className="lead"><span className="eyebrow">Agenda</span><h3>Échéances</h3></div>
        <Link to="/contratheque?vue=echeances" className="seeall">Voir <ArrowRight className="ic" style={{ width: 14, height: 14 }} /></Link>
      </div>

      {items.length === 0 ? (
        <div className="empty">Aucune échéance dans les 90 jours.</div>
      ) : (
        <div className="tl">
          {items.map((event) => (
            <div key={event.key} className="tlrow" style={{ cursor: "pointer" }} onClick={() => navigate(event.to)}>
              <div className="tldate"><b className="tnum">{event.day}</b><span>{event.month}</span></div>
              <div className="tlbar" style={{ background: barColor(event.tagClassName) }} />
              <div className="tlbody">
                <div className="t">{event.title}</div>
                <div className="m">{event.tag} · {event.party}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
