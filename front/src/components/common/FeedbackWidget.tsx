import React, { useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, X, Send, CheckCircle2, ChevronDown } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";
import { useDraggablePosition } from "../../hooks/useDragablePosition";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/conformite": "Analyse de conformité",
  "/analyzer": "Analyse de contrat",
  "/generateur": "Générateur de modèles",
  "/generateur/filigranes": "Mes filigranes",
  "/signature": "Signature",
  "/chatjuridique": "Chat juridique",
  "/calculateur": "Calculateur juridique",
  "/veille": "Veille juridique",
  "/mon-compte": "Mon compte",
  "/monitoring": "Monitoring",
  "/souscription": "Abonnement",
};

function getContext(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  let best = "";
  let bestLabel = "Application";
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname.startsWith(route) && route.length > best.length) {
      best = route;
      bestLabel = label;
    }
  }
  return bestLabel;
}



type Status = "idle" | "loading" | "success" | "error";

export const FeedbackWidget: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const context = getContext(location.pathname);
  const { btnRef, onMouseDown, didDrag, initialRight, initialBottom } = useDraggablePosition();

  // Focus textarea when panel opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  // Reset après success
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => {
        setStatus("idle");
        setComment("");
        setOpen(false);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetchProxy("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          comment: comment.trim(),
          context,
          page: location.pathname,
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json.message || "Erreur lors de l'envoi.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Impossible de joindre le serveur.");
      setStatus("error");
    }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-xs sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: "feedbackSlideUp 0.18s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-lumenjuris-sidebar">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-white/80" />
              <span className="text-sm font-semibold text-white">Laisser un commentaire</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-medium text-gray-700">Merci pour votre retour !</p>
              <p className="text-xs text-gray-400">Votre commentaire a bien été enregistré.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Context badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Rubrique</span>
                <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {context}
                </span>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Décrivez votre retour, une idée, un bug…"
                  maxLength={2000}
                  rows={4}
                  disabled={status === "loading"}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all disabled:opacity-60"
                />
                <div className="flex justify-between items-center mt-1 px-0.5">
                  {status === "error" ? (
                    <span className="text-xs text-red-500">{errorMsg}</span>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] text-gray-300 ml-auto">
                    {comment.length}/2000
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!comment.trim() || status === "loading"}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-lumenjuris
                 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all 
                 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {status === "loading" ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {status === "loading" ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* FAB trigger */}
      {import.meta.env.VITE_FEEDBACK_ENABLE == "true" &&(
        <button
          ref={btnRef}
          onMouseDown={onMouseDown}
          onClick={() => {
            if (didDrag.current) return;
            setOpen((v) => !v);
          }}
          title="Laisser un commentaire"
          className="fixed z-50 flex items-center gap-2 bg-lumenjuris text-white p-3 sm:pl-3 sm:pr-4 sm:py-2.5 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm font-medium cursor-grab active:cursor-grabbing"
          style={{ right: initialRight, bottom: initialBottom }}
        >
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <MessageSquarePlus className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      <style>{`
        @keyframes feedbackSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};