import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Scale, Loader2, AlertCircle, CheckCircle2, Send, Download, FileText, ShieldCheck } from "lucide-react";
import { PdfViewer } from "../components/DashboardComponents/signature/PdfViewer";
import { SignatureModal } from "../components/DashboardComponents/signature/SignatureModal";
import { SIGNERS_DEFAULT } from "../components/DashboardComponents/signature/types";
import type { Field, FieldType, CapturedSignature } from "../components/DashboardComponents/signature/types";
import { fetchProxy } from "../utils/fetchProxy";

/**
 * Page publique de signature pour le cocontractant.
 * Accessible via /signer/:token — ne nécessite aucune authentification.
 *
 * Workflow :
 *  1. Charge l'enveloppe via GET /api/signature-envelope/public/:token
 *  2. Affiche le PDF avec les champs assignés au cocontractant
 *  3. Le cocontractant signe ses champs via la SignatureModal — signature et
 *     paraphes sont deux saisies distinctes, chacune remplit toutes ses zones
 *  4. Soumet les champs signés via POST /api/signature-envelope/public/:token
 */
export function SignerPage() {
  const { token } = useParams<{ token: string }>();

  // ── Chargement initial ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [documentName, setDocumentName] = useState("");
  // Noms des deux parties : affichés dans le récapitulatif de confirmation.
  const [selfName, setSelfName] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Field[]>([]);

  // ── Signature ─────────────────────────────────────────────────────────────
  // Une saisie par type : la signature complète et le paraphe (initiales) sont
  // deux images différentes.
  const [capturedByType, setCapturedByType] = useState<Record<FieldType, CapturedSignature | null>>({
    signature: null, initial: null,
  });
  const [modalOpenFor, setModalOpenFor] = useState<Field | null>(null);

  // ── Soumission ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  // ── Téléchargement du contrat signé ───────────────────────────────────────
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

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
            meta: {
              documentName: string;
              numPages: number;
              selfName?: string;
              counterpartyName?: string;
            };
            fields: { fields: Field[] };
            fileBase64: string | null;
          };
        };
        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "Lien invalide ou expiré.");
        }
        setDocumentName(data.data.meta.documentName);
        setSelfName(data.data.meta.selfName ?? "");
        setCounterpartyName(data.data.meta.counterpartyName ?? "");

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

  const hasInitialFields = counterFields.some((f) => f.type === "initial");

  function handleFieldClick(field: Field) {
    if (field.signer !== "counterparty") return;
    const captured = capturedByType[field.type];
    if (captured) {
      applySignature(field, captured);
    } else {
      setModalOpenFor(field);
    }
  }

  /**
   * Applique la saisie au champ cliqué et à tous les champs vides du même type
   * (une seule saisie de paraphe remplit toutes les pages). Seule la signature
   * est datée : un paraphe ne porte pas de date.
   *
   * S'il reste ensuite des champs vides de l'autre type, la modale s'ouvre
   * aussitôt pour eux : le cocontractant n'a pas à les chercher page par page.
   */
  function applySignature(field: Field, sig: CapturedSignature) {
    const signedAt = field.type === "signature" ? new Date().toISOString() : undefined;
    const next = fields.map((f) => {
      const isTarget = f.id === field.id
        || (f.signer === "counterparty" && f.type === field.type && !f.value);
      if (!isTarget) return f;
      return { ...f, value: sig.dataUrl, ...(signedAt ? { signedAt } : {}) };
    });
    setFields(next);

    const nextToComplete = next.find((f) => f.signer === "counterparty" && !f.value);
    setModalOpenFor(nextToComplete ?? null);
  }

  function handleModalConfirm(sig: CapturedSignature) {
    if (!modalOpenFor) return;
    setCapturedByType((prev) => ({ ...prev, [modalOpenFor.type]: sig }));
    applySignature(modalOpenFor, sig);
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

  /**
   * Télécharge le contrat signé (PDF original + signatures incrustées) depuis
   * la route publique. Le token de signature sert d'autorisation : il donne
   * déjà accès au document.
   */
  async function handleDownload() {
    if (!token) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const res = await fetchProxy(`/api/signature-envelope/public/${token}/download`);
      if (!res.ok) throw new Error("Le téléchargement a échoué.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentName.replace(/\.pdf$/i, "")}_signe.pdf`;
      // Le lien doit être dans le document et l'URL libérée après coup :
      // certains navigateurs annulent le téléchargement sinon.
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Le téléchargement a échoué.");
    } finally {
      setDownloading(false);
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
      <SignedConfirmation
        documentName={documentName}
        selfName={selfName}
        counterpartyName={counterpartyName}
        downloading={downloading}
        downloadError={downloadError}
        onDownload={() => void handleDownload()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <PublicHeader documentName={documentName} />

      <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-4">
        {/* Barre de progression + bouton envoyer */}
        <div className="bg-blue-primary rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">
              Vos champs à signer
            </p>
            <p className="text-xs text-gray-primary">
              {counterFields.length - unsignedCounter.length}/{counterFields.length} complétés
              {counterFields.length === 0 && " — aucun champ à signer"}
            </p>
          </div>
          <button
            onClick={() => void handleSubmit()}
            disabled={!allSigned || submitting}
            className="flex w-full sm:w-auto justify-center items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
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
            {hasInitialFields ? (
              <>
                Cliquez sur les zones en <strong>vert</strong> pour apposer votre signature et
                vos paraphes. Une seule saisie remplit toutes les pages.
              </>
            ) : (
              <>Cliquez sur les zones en <strong>vert</strong> pour apposer votre signature.</>
            )}
          </p>
        )}

        {/* PDF viewer */}
        <div className="bg-white rounded-2xl border border-gray-200 p-2 sm:p-4">
          <PdfViewer
            file={pdfFile}
            fields={fields}
            signers={signers}
            mode="sign"
            onFieldClick={handleFieldClick}
          />
        </div>
      </main>

      {/* Modale de signature */}
      {modalOpenFor && (
        <SignatureModal
          open={true}
          // Une modale neuve par type : sans cela, le dessin de la signature
          // resterait sur le canevas du paraphe quand on enchaîne les deux.
          key={modalOpenFor.type}
          signerName={counterpartyName || "Cocontractant"}
          signerHex="#10b981"
          kind={modalOpenFor.type}
          initialSignature={capturedByType[modalOpenFor.type]}
          onClose={() => setModalOpenFor(null)}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}

/** Bandeau de marque des pages publiques de signature. */
function PublicHeader({ documentName }: { documentName: string }) {
  return (
    <header className="h-14 bg-blue-primary flex items-center px-4 sm:px-6 gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-panel bg-brand">
        <Scale className="h-4 w-4 text-white" />
      </div>
      <span className="text-sm font-bold text-white shrink-0">Lumen Juris</span>
      <span className="text-white/30 mx-1">·</span>
      <span className="text-sm text-white/70 truncate min-w-0 max-w-xs">
        Signature{documentName ? ` — ${documentName}` : ""}
      </span>
    </header>
  );
}

/**
 * Écran de fin de parcours du cocontractant : confirmation que le document est
 * signé par les deux parties, et remise immédiate du contrat signé.
 *
 * Le téléchargement est proposé ici parce que c'est le moment où le
 * cocontractant en a besoin : il vient de signer, il n'a pas de compte sur la
 * plateforme et l'e-mail de confirmation peut tarder ou finir en indésirables.
 */
function SignedConfirmation({
  documentName, selfName, counterpartyName,
  downloading, downloadError, onDownload,
}: {
  documentName: string;
  selfName: string;
  counterpartyName: string;
  downloading: boolean;
  downloadError: string;
  onDownload: () => void;
}) {
  const signedOn = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="min-h-screen bg-surface-subtle flex flex-col"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <PublicHeader documentName={documentName} />

      <main className="flex-1 flex items-start justify-center p-4 lg:p-8">
        <div className="w-full max-w-lg bg-white rounded-card border border-line shadow-card-md overflow-hidden">
          {/* Bandeau de réussite */}
          <div className="bg-success-light px-6 py-7 flex flex-col items-center text-center gap-3 border-b border-line-subtle">
            <div className="w-14 h-14 rounded-card bg-white flex items-center justify-center shadow-card">
              <CheckCircle2 className="w-7 h-7 text-success stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-ink tracking-tight">Document signé</h1>
              <p className="text-sm text-success-dark">
                Signature enregistrée le {signedOn}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Document concerné */}
            <div className="flex items-start gap-3 rounded-panel bg-surface-subtle border border-line-subtle px-4 py-3">
              <FileText className="w-4 h-4 text-ink-subtle shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">
                  Document
                </p>
                <p className="text-sm font-semibold text-ink break-words">{documentName}</p>
              </div>
            </div>

            {/* Récapitulatif des signataires */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">
                Signataires
              </p>
              <SignerLine label={selfName || "Émetteur"} role="Émetteur" />
              <SignerLine label={counterpartyName || "Vous"} role="Cocontractant" />
            </div>

            {/* Remise du contrat signé */}
            <div className="space-y-2">
              <button
                onClick={onDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand text-white text-sm font-semibold rounded-panel hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card"
              >
                {downloading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                {downloading ? "Préparation du PDF…" : "Télécharger le contrat signé"}
              </button>
              {downloadError && (
                <p className="flex items-center gap-1.5 text-xs text-danger-dark">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {downloadError}
                </p>
              )}
              <p className="text-xs text-ink-muted leading-relaxed text-center">
                Une copie du contrat signé vous est également envoyée par e-mail.
              </p>
            </div>

            {/* Valeur probante — rassure sur ce qui vient d'être fait */}
            <div className="flex items-start gap-2.5 rounded-panel bg-brand-light px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <p className="text-xs text-ink-secondary leading-relaxed">
                Les signatures et leur date sont incrustées dans le PDF. Conservez ce
                document : il fait preuve de votre accord.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-ink-subtle">
        Signature électronique propulsée par <span className="font-semibold text-ink-muted">Lumen Juris</span>
      </footer>
    </div>
  );
}

/** Une ligne « nom — rôle » du récapitulatif des signataires. */
function SignerLine({ label, role }: { label: string; role: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-panel border border-line-subtle px-3 py-2">
      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      <span className="text-sm font-medium text-ink truncate">{label}</span>
      <span className="ml-auto text-[10px] font-semibold text-ink-subtle uppercase tracking-wide shrink-0">
        {role}
      </span>
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
