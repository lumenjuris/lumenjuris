import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  ChevronRight, CheckCircle2, UploadCloud, Lock,
} from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import type { Signer } from "./types";

interface Props {
  /** Fichier PDF chargé (null tant que rien n'est déposé). */
  file: File | null;
  /** Nombre de pages détecté à l'ouverture du PDF. */
  numPages: number;
  signers: Signer[];
  onFileChange: (file: File | null) => void;
  onNumPagesLoaded: (n: number) => void;
  onNext: () => void;
}

/**
 * Étape 1 du wizard de e-signature : charger le contrat PDF.
 *
 * Volontairement simple : aucune saisie supplémentaire (pas d'email, pas de
 * nom). L'utilisateur dépose son PDF et passe à l'étape suivante.
 */
export function PrepareStep({ file, numPages, signers, onFileChange, onNumPagesLoaded, onNext }: Props) {
  const handleDrop = useCallback((files: File[]) => {
    if (files[0]) onFileChange(files[0]);
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {!file ? (
        <DropZone isDragActive={isDragActive} rootProps={getRootProps()} inputProps={getInputProps()} />
      ) : (
        <LoadedFilePanel
          file={file}
          numPages={numPages}
          signers={signers}
          onClear={() => onFileChange(null)}
          onNumPagesLoaded={onNumPagesLoaded}
        />
      )}

      {file && (
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-3 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] transition-all shadow-sm"
          >
            Suivant — Placer les signatures <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Zone de dépôt + bouton de sélection de fichier. */
function DropZone({
  isDragActive, rootProps, inputProps,
}: {
  isDragActive: boolean;
  rootProps: ReturnType<ReturnType<typeof useDropzone>["getRootProps"]>;
  inputProps: ReturnType<ReturnType<typeof useDropzone>["getInputProps"]>;
}) {
  return (
    <div
      {...rootProps}
      className={`rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all ${
        isDragActive
          ? "border-[#354F99] bg-[#354F99]/5 scale-[1.01]"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40"
      }`}
    >
      <input {...inputProps} />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          <UploadCloud className="w-7 h-7 text-gray-400 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-700">Glissez-déposez votre contrat PDF</p>
          <p className="text-xs text-gray-400">ou cliquez pour parcourir</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
          <Lock className="h-3 w-3" /> Document confidentiel
        </div>
      </div>
    </div>
  );
}

/** Bandeau de confirmation + preview du PDF chargé. */
function LoadedFilePanel({
  file, numPages, signers, onClear, onNumPagesLoaded,
}: {
  file: File;
  numPages: number;
  signers: Signer[];
  onClear: () => void;
  onNumPagesLoaded: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{file.name}</p>
            <p className="text-[11px] text-gray-400">
              {(file.size / 1024).toFixed(0)} Ko {numPages > 0 && `· ${numPages} pages`}
            </p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2"
        >
          Changer
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <PdfViewer
          file={file}
          fields={[]}
          signers={signers}
          mode="preview"
          onLoaded={onNumPagesLoaded}
        />
      </div>
    </div>
  );
}
