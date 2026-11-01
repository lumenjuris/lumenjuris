import { useMemo, useState } from "react";
import { Download, FileText, Loader2, AlertCircle, Info } from "lucide-react";
import {
  buildContractDocx,
  buildContractPdf,
  documentFromPlainText,
  downloadBlob,
} from "../DashboardComponents/cdd/smart/contractExport";
import { loadPendingPurchase } from "./pendingPurchase";

interface Props {
  contractRef: string;
  /** Titre du contrat en contrathèque (sert de nom de fichier à défaut) */
  title: string | null;
  /** Texte du contrat enregistré en contrathèque, utilisé si l'éditeur n'est plus disponible */
  plainText: string | null;
}

/** Nom de fichier sûr à partir d'un titre libre. */
function toFileBase(title: string | null): string {
  const cleaned = (title ?? "").replace(/[\\/:*?"<>|]+/g, "").trim();
  return cleaned || "contrat";
}

type DownloadKind = "pdf" | "docx";

/**
 * Téléchargement des livrables d'un contrat acheté (PDF et Word sans filigrane).
 * À n'afficher qu'une fois le paiement confirmé par le backend.
 */
export function ContractPackDownloads({ contractRef, title, plainText }: Props) {
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Priorité au contenu de l'éditeur mémorisé avant le paiement (mise en forme
  // complète), sinon le texte de la contrathèque.
  const source = useMemo(() => {
    const pending = loadPendingPurchase(contractRef);
    if (pending) {
      return { document: pending.document, fileBase: pending.fileBase, simplified: false };
    }
    if (plainText?.trim()) {
      return { document: documentFromPlainText(plainText), fileBase: toFileBase(title), simplified: true };
    }
    return null;
  }, [contractRef, plainText, title]);

  if (!source) {
    return (
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        Le texte de ce contrat n'est pas disponible pour générer les documents.
        Votre achat est bien enregistré : contactez le support si le problème persiste.
      </p>
    );
  }

  const download = async (kind: DownloadKind) => {
    if (downloading) return;
    setDownloading(kind);
    setError(null);
    try {
      if (kind === "pdf") {
        buildContractPdf(source.document, false).save(`${source.fileBase}.pdf`);
      } else {
        const blob = await buildContractDocx(source.document, false);
        await downloadBlob(blob, `${source.fileBase}.docx`);
      }
    } catch (err) {
      console.error("Erreur de génération du document :", err);
      setError("Le document n'a pas pu être généré. Réessayez.");
    }
    setDownloading(null);
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface-subtle disabled:opacity-60";

  return (
    <div className="space-y-3">
      {/* Retour à la ligne plutôt que des libellés coupés dans une colonne étroite */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void download("pdf")} disabled={downloading !== null} className={buttonClass}>
          {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.75} />}
          Télécharger le PDF
        </button>
        <button type="button" onClick={() => void download("docx")} disabled={downloading !== null} className={buttonClass}>
          {downloading === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" strokeWidth={1.75} />}
          Télécharger le Word (.docx)
        </button>
      </div>

      {source.simplified && (
        <p className="text-xs text-ink-muted">
          Documents générés à partir du texte enregistré dans votre contrathèque : le contenu est complet,
          la mise en forme des titres est simplifiée.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
