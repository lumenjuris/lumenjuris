import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Scale, Loader2, AlertCircle, CheckCircle2, Send } from "lucide-react";
import { PdfViewer } from "../components/DashboardComponents/signature/PdfViewer";
import { SignatureModal } from "../components/DashboardComponents/signature/SignatureModal";
import { SIGNERS_DEFAULT } from "../components/DashboardComponents/signature/types";
import type { Field, CapturedSignature } from "../components/DashboardComponents/signature/types";
import { fetchProxy } from "../utils/fetchProxy";

/**
 * Page publique de signature pour le cocontractant.
 * Accessible via /signer/:token — ne nécessite aucune authentification.
 *
 * Workflow :
 *  1. Charge l'enveloppe via GET /api/signature-envelope/public/:token
 *  2. Affiche le PDF avec les champs assignés au cocontractant
 *  3. Le cocontractant signe ses champs via la SignatureModal
 *  4. Soumet les champs signés via POST /api/signature-envelope/public/:token
 */
export function SignerPage() {
  const { token } = useParams<{ token: string }>();

  // ── Chargement initial ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [numPages, setNumPages] = useState(0);

  // ── Signature ─────────────────────────────────────────────────────────────
  const [capturedSig, setCapturedSig] = useState<CapturedSignature | null>(null);
  const [modalOpenFor, setModalOpenFor] = useState<Field | null>(null);

  // ── Soumission ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  // Signataires (on réutilise SIGNERS_DEFAULT pour les couleurs)
  const signers = SIGNERS_DEFAULT;

  useEffect(() => {
    if (!token) { setLoadError("Lien invalide."); setLoading(false); return; }

    void (async () => {
      try {
        const res = await fetchProxy(`/api/signature-envelope/public/${token}`);
        const data = await res.json() as {
          success: boolean;
          message?: string;
          data?: {
            meta: { documentName: string; numPages: number };
            fields: { fields: Field[] };
            fileBase64: string | null;
          };
        };
        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "Lien invalide ou expiré.");
        }
        setDocumentName(data.data.meta.documentName);
        setNumPages(data.data.meta.numPages);

        // Convertit base64 → File
        if (data.data.fileBase64) {
          const bytes = Uint8Array.from(atob(data.data.fileBase64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: "application/pdf" });
          setPdfFile(new File([blob], data.data.meta.documentName, { type: "application/pdf" }));
        }

        // Garde uniquement les champs du cocontractant
        const all: Field[] = data.data.fields.fields ?? [];
        setFields(all);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Erreur réseau.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Champs cocontractant non encore signés ────────────────────────────────
  const counterFields = fields.filter((f) => f.signer === "counterparty");
  const unsignedCounter = counterFields.filter((f) => !f.value);
  const allSigned = counterFields.length > 0 && unsignedCounter.length === 0;

  function handleFieldClick(field: Field) {
    if (field.signer !== "counterparty") return;
    if (capturedSig) {
      applySignature(field, capturedSig);
    } else {
      setModalOpenFor(field);
    }
  }

  function applySignature(field: Field, sig: CapturedSignature) {
    const signedAt = new Date().toISOString();
    setFields((prev) => prev.map((f) => {
      if (f.id === field.id) return { ...f, value: sig.dataUrl, signedAt };
      if (f.signer === "counterparty" && !f.value) return { ...f, value: sig.dataUrl, signedAt };
      return f;
    }));
  }

  function handleModalConfirm(sig: CapturedSignature) {
    if (!modalOpenFor) return;
    setCapturedSig(sig);
    applySignature(modalOpenFor, sig);
    setModalOpenFor(null);
  }

  async function handleSubmit() {
    if (!allSigned || !token) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetchProxy(`/api/signature-envelope/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { fields } }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Échec de la soumission.");
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Screen>
        <Loader2 className="w-8 h-8 animate-spin text-[#354F99]" />
        <p className="text-sm text-gray-500 mt-3">Chargement du document…</p>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-base font-bold text-gray-800">Lien invalide</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-sm text-center">{loadError}</p>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 stroke-[1.5]" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Document signé ✓</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm text-center">
          Votre signature a bien été enregistrée sur «&nbsp;{documentName}&nbsp;».
          Les deux parties ont maintenant signé ce document.
        </p>
      </Screen>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header public */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#354F99]">
          <Scale className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900">LumenJuris</span>
        <span className="text-gray-300 mx-1">·</span>
        <span className="text-sm text-gray-500 truncate max-w-xs">Signature — {documentName}</span>
      </header>

      <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-4">
        {/* Barre de progression + bouton envoyer */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-gray-800">
              Vos champs à signer
            </p>
            <p className="text-xs text-gray-500">
              {counterFields.length - unsignedCounter.length}/{counterFields.length} signés
              {counterFields.length === 0 && " — aucun champ à signer"}
            </p>
          </div>
          <button
            onClick={() => void handleSubmit()}
            disabled={!allSigned || submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Envoi…" : "Valider ma signature"}
          </button>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Instruction */}
        {!allSigned && counterFields.length > 0 && (
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
            Cliquez sur les zones en <strong>vert</strong> pour apposer votre signature.
          </p>
        )}

        {/* PDF viewer */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <PdfViewer
            file={pdfFile}
            fields={fields}
            signers={signers}
            mode="sign"
            onFieldClick={handleFieldClick}
            onLoaded={setNumPages}
          />
        </div>
      </main>

      {/* Modale de signature */}
      {modalOpenFor && (
        <SignatureModal
          open={true}
          signerName="Cocontractant"
          signerHex="#10b981"
          initialSignature={capturedSig}
          onClose={() => setModalOpenFor(null)}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}

/** Centrage vertical pour les états loading/error/done. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fb]"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#354F99] mb-6">
        <Scale className="h-5 w-5 text-white" />
      </div>
      {children}
    </div>
  );
}
