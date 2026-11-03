import { useCallback, useEffect, useState } from "react";
import { Download, FileText, ClipboardList, Loader2, AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import {
  downloadContractPackFile,
  listContractPackPurchases,
  resendContractPackEmail,
  type ContractPackFileKind,
  type ContractPackPurchase,
} from "./contractPackApi";

interface Props {
  contractRef: string;
  /** Titre du contrat (nom des fichiers téléchargés) */
  title: string | null;
}

/** Délai entre deux relectures de l'achat tant que l'e-mail n'est pas parti. */
const REFRESH_INTERVAL_MS = 3000;
/** Nombre maximum de relectures (10 × 3 s = 30 s). */
const MAX_REFRESH_ATTEMPTS = 10;

// Libellés courts : le bloc tient aussi dans la colonne étroite de la fiche contrat
const FILE_BUTTONS: { kind: ContractPackFileKind; label: string; title: string; icon: React.ElementType; suffix: string }[] = [
  { kind: "PDF", label: "Contrat PDF", title: "Télécharger le contrat en PDF, sans filigrane", icon: Download, suffix: ".pdf" },
  { kind: "DOCX", label: "Contrat Word", title: "Télécharger le contrat en Word (.docx) modifiable", icon: FileText, suffix: ".docx" },
  { kind: "FICHE", label: "Fiche de synthèse", title: "Télécharger la fiche de synthèse en PDF", icon: ClipboardList, suffix: "-fiche-synthese.pdf" },
];

/** Nom de fichier sûr à partir d'un titre libre. */
function toFileBase(title: string | null): string {
  const cleaned = (title ?? "").replace(/[\\/:*?"<>|]+/g, "").trim();
  return cleaned || "contrat";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

/**
 * Livrables d'un contrat acheté (PDF, Word, fiche de synthèse), servis par le
 * backend. À n'afficher qu'une fois le paiement confirmé.
 */
export function ContractPackDownloads({ contractRef, title }: Props) {
  const [purchase, setPurchase] = useState<ContractPackPurchase | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState<ContractPackFileKind | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ success: boolean; text: string } | null>(null);

  const loadPurchase = useCallback(async () => {
    const purchases = await listContractPackPurchases();
    return purchases.find((candidate) => candidate.contractRef === contractRef) ?? null;
  }, [contractRef]);

  // Juste après le paiement, les documents et l'e-mail sont encore en préparation
  // côté serveur : on relit l'achat jusqu'à ce que l'e-mail soit parti.
  useEffect(() => {
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const refresh = async () => {
      attempts += 1;
      try {
        const found = await loadPurchase();
        if (isUnmounted) return;
        setPurchase(found);
        setLoadError(false);
        if (found?.emailSentAt) return;
      } catch (err) {
        console.error("Achat illisible :", err);
        if (!isUnmounted) setLoadError(true);
      }
      if (!isUnmounted && attempts < MAX_REFRESH_ATTEMPTS) {
        timeoutId = setTimeout(refresh, REFRESH_INTERVAL_MS);
      }
    };

    void refresh();
    return () => {
      isUnmounted = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadPurchase]);

  if (!purchase) {
    return loadError ? (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Vos documents sont momentanément indisponibles. Réessayez dans quelques instants.
      </p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de vos documents…
      </p>
    );
  }

  const download = async (kind: ContractPackFileKind, suffix: string) => {
    if (downloading) return;
    setDownloading(kind);
    setDownloadError(null);
    try {
      await downloadContractPackFile(purchase.idBilling, kind, `${toFileBase(title)}${suffix}`);
    } catch (err) {
      console.error("Téléchargement impossible :", err);
      setDownloadError("Le document n'a pas pu être téléchargé. Réessayez dans quelques instants.");
    }
    setDownloading(null);
  };

  const resendEmail = async () => {
    if (resending) return;
    setResending(true);
    setResendMessage(null);
    const result = await resendContractPackEmail(purchase.idBilling);
    setResendMessage({ success: result.success, text: result.message });
    if (result.success) {
      try {
        setPurchase(await loadPurchase());
      } catch {
        // La date d'envoi sera simplement rafraîchie au prochain affichage
      }
    }
    setResending(false);
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface-subtle disabled:opacity-60";

  return (
    <div className="space-y-3">
      {/* Retour à la ligne plutôt que des libellés coupés dans une colonne étroite */}
      <div className="flex flex-wrap gap-2">
        {FILE_BUTTONS.map(({ kind, label, title: buttonTitle, icon: Icon, suffix }) => (
          <button
            key={kind}
            type="button"
            title={buttonTitle}
            onClick={() => void download(kind, suffix)}
            disabled={downloading !== null}
            className={buttonClass}
          >
            {downloading === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
            {label}
          </button>
        ))}
      </div>

      {downloadError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {downloadError}
        </p>
      )}

      {/* Livraison par e-mail */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {purchase.emailSentAt ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
            Envoyés par e-mail le {formatDateTime(purchase.emailSentAt)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
            Envoi par e-mail en préparation
          </span>
        )}
        <button
          type="button"
          onClick={() => void resendEmail()}
          disabled={resending}
          className="font-medium text-brand underline underline-offset-2 hover:text-brand-hover disabled:opacity-60"
        >
          {resending ? "Envoi…" : "Renvoyer par e-mail"}
        </button>
      </div>

      {resendMessage && (
        <p role="status" className={`text-xs ${resendMessage.success ? "text-success-dark" : "text-danger"}`}>
          {resendMessage.text}
        </p>
      )}
    </div>
  );
}
