import { useMemo, useState } from "react";
import { /* Link, */ useNavigate } from "react-router-dom";
import { /* ArrowRight, */ ChevronRight } from "lucide-react";

import type { QueueGroup, QueueItem } from "../types";

/** Couleur de la pastille de type selon la famille de travail. */
const GROUP_CHIP: Record<QueueGroup, string> = {
  "Rédaction": "grey",
  "Négociation": "blue",
  "Signature": "gold",
};

type Filter = "Tous" | QueueGroup;
const FILTERS: Filter[] = ["Tous", "Rédaction", "Signature", "Négociation"];

/**
 * Colonne principale : la file « À traiter », présentée en tableau avec des
 * onglets de filtre par famille. Chaque ligne mène vers l'élément concerné.
 */
export function WorkQueue({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState<Filter>("Tous");
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { "Tous": items.length, "Rédaction": 0, "Signature": 0, "Négociation": 0 };
    for (const item of items) base[item.group] += 1;
    return base;
  }, [items]);

  const rows = filter === "Tous" ? items : items.filter((item) => item.group === filter);

  return (
    <div className="card">
      <div className="card-h">
        <div className="lead">
          <span className="eyebrow">Priorité</span>
          <h3>À traiter</h3>
        </div>
        {/* <Link to="/contratheque" className="seeall">Contrathèque <ArrowRight className="ic" style={{ width: 14, height: 14 }} /></Link> */}
      </div>

      <div className="ftabs">
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`ftab ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f} <span className="n">{counts[f]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">Rien à traiter ici pour le moment.</div>
      ) : (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr><th>Élément</th><th className="hide2">Type</th><th>État</th><th aria-label="Ouvrir" /></tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.key} onClick={() => navigate(item.to)}>
                  <td>
                    <div className="cname">{item.title}</div>
                    <div className="ctype">{item.meta}</div>
                  </td>
                  <td className="hide2"><span className={`st ${GROUP_CHIP[item.group]}`}>{item.group}</span></td>
                  <td>
                    <span className={`due ${item.isUrgent ? "urgent" : ""}`}>
                      {item.due}
                      <span className="rel">{item.action}</span>
                    </span>
                  </td>
                  <td><span className="rowgo"><ChevronRight className="ic" style={{ width: 16, height: 16 }} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
