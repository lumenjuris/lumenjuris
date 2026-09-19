import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Scale } from "lucide-react";
import { guestApi } from "../components/DashboardComponents/negotiation/api";
import { NegotiationDoc } from "../components/DashboardComponents/negotiation/NegotiationDoc";
import type { AddAnnotationPayload } from "../components/DashboardComponents/negotiation/NegotiationDoc";
import { CompletionGuestForm } from "../components/DashboardComponents/negotiation/CompletionGuestForm";
import { LumenJurisLogo } from "../components/common/LumenJurisLogo";
import { ROLE_LABEL } from "../components/DashboardComponents/negotiation/types";
import type { GuestNegotiation } from "../components/DashboardComponents/negotiation/types";

/** Page publique pour un invité externe (accès par token, sans compte) :
 *  relecture/commentaires (mode négociation) ou formulaire guidé (mode complétion). */
export function NegotiationGuest() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GuestNegotiation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try { setData(await guestApi.get(token)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lien invalide ou expiré."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const latest = data?.versions?.[data.versions.length - 1];
  const completion = data?.mode === "COMPLETION" && data.guest.canFill;

  async function addAnnotation(p: AddAnnotationPayload) {
    if (!token) return;
    await guestApi.addComment(token, {
      body: p.body, anchorStart: p.anchorStart, anchorEnd: p.anchorEnd, quote: p.quote, proposedText: p.proposedText, clauseRef: null,
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="h-14 bg-blue-primary flex items-center px-6">
        <LumenJurisLogo variant="dark" height={36} />
        <span className="ml-3 text-xs text-white/40">
          · {completion ? "Complétion du document — espace invité" : "Négociation — espace invité"}
        </span>
        {data?.guest && (
          <span className="ml-auto text-xs text-white/60">
            {data.guest.name ? `${data.guest.name} · ` : ""}{ROLE_LABEL[data.guest.role]}
          </span>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-5 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-ink-subtle" /></div>
        ) : error || !data ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Scale className="w-10 h-10 text-ink-subtle" />
            <p className="text-sm font-semibold text-ink">{error || "Négociation indisponible"}</p>
            <p className="text-xs text-ink-muted">Le lien est peut-être expiré ou révoqué. Contactez votre interlocuteur.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col bg-blue-primary px-6 py-5 gap-2 rounded-2xl">
              <h1 className="text-2xl font-bold text-white tracking-tight">{data.title}</h1>

            </div>

            {completion && token ? (
              <CompletionGuestForm token={token} data={data} onChanged={load} />
            ) : (
              <NegotiationDoc
                text={latest?.contentText ?? ""}
                comments={data.comments}
                canAnnotate={data.guest.canComment}
                guest
                onAdd={addAnnotation}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
