// Page « Mes négociations » : toutes les sessions (négociation et complétion
// guidée) de l'utilisateur, avec statut, progression et accès direct.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2, AlertCircle, MessagesSquare, ArrowRight, Users, FileText, Sparkles,
} from "lucide-react";
import { negotiationApi } from "./api";
import {
  STATUS_LABEL, STATUS_STYLE, MODE_LABEL, MODE_STYLE,
} from "./types";
import type { NegotiationListItem } from "./types";

function fmtRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return new Date(d).toLocaleDateString("fr-FR");
}

export function NegotiationsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NegotiationListItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    negotiationApi.list()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur réseau"));
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    );
  }
  if (!items) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-ink-subtle" /></div>;
  }

return (
  <div className="w-full max-w-8xl mx-auto">
    <div className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden">
      <div className="bg-blue-primary px-8 py-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Négociation</h1>
        <p className="text-sm text-gray-200 mt-1">
          Suivez les contrats partagés à l’autre partie : relecture, propositions de
          modification ou complétion des champs avant signature.
        </p>
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-4 text-center">
            <MessagesSquare className="w-10 h-10 text-ink-subtle" />
            <div>
              <p className="text-sm font-semibold text-ink">Aucune négociation en cours</p>
              <p className="text-xs text-ink-muted mt-1 max-w-md">
                Depuis l’éditeur de contrat, choisissez « Partager à l’autre partie » pour
                faire compléter ou relire un document. Vous pouvez aussi ouvrir une
                négociation depuis la fiche d’un contrat de la contrathèque.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/contrat-generation?section=scratch" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all">
                <Sparkles className="w-3.5 h-3.5" /> Créer un contrat
              </Link>
              <Link to="/contratheque" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-ink-secondary bg-white border border-line rounded-lg hover:bg-surface-subtle transition-all">
                <FileText className="w-3.5 h-3.5" /> Ouvrir la contrathèque
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const st = STATUS_STYLE[n.status];
              const md = MODE_STYLE[n.mode];
              const activeGuests = n.guests.filter((g) => g.active);
              return (
                <button
                  key={n.id}
                  onClick={() => navigate(`/negociation/${n.id}`)}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-brand/40 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-ink truncate max-w-[40%]">{n.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-chip" style={{ backgroundColor: md.bg, color: md.fg }}>
                      {MODE_LABEL[n.mode]}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-chip" style={{ backgroundColor: st.bg, color: st.fg }}>
                      {n.status === "VALIDATED" ? "Prêt à signer" : STATUS_LABEL[n.status]}
                    </span>
                    {n.completion && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                        <span className="w-24 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-brand transition-all"
                            style={{ width: `${n.completion.total ? Math.round((n.completion.filled / n.completion.total) * 100) : 0}%` }}
                          />
                        </span>
                        {n.completion.filled}/{n.completion.total} champs remplis
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-ink-subtle ml-auto shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-ink-muted">
                    <span>Dernière activité {fmtRelative(n.updatedAt)}</span>
                    {activeGuests.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activeGuests.map((g) => g.name || g.email || "invité").join(", ")}
                      </span>
                    )}
                    {n.mode === "NEGOTIATION" && (
                      <span>{n.counts.versions} version{n.counts.versions > 1 ? "s" : ""} · {n.counts.comments} commentaire{n.counts.comments > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  </div>
)};
