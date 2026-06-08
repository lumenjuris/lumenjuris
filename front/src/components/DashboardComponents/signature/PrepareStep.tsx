import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Lock } from "lucide-react";

interface Props {
  /**
   * Appelé quand un fichier PDF est déposé. Le parent passe automatiquement
   * à l'étape de placement — pas de bouton "Suivant" sur cette étape.
   */
  onFileChange: (file: File | null) => void;
}

/**
 * Étape 1 du wizard : dépôt du contrat PDF.
 *
 * Volontairement minimale : une seule zone de dépôt. Dès qu'un fichier est
 * déposé, le parent enchaîne directement sur l'étape 2 (placement). Aucune
 * saisie supplémentaire (pas de signataire, pas d'email, pas de bouton de
 * validation).
 */
export function PrepareStep({ onFileChange }: Props) {
  const handleDrop = useCallback((files: File[]) => {
    if (files[0]) onFileChange(files[0]);
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  return (
    <div className="max-w-3xl">
      <DropZone
        isDragActive={isDragActive}
        rootProps={getRootProps()}
        inputProps={getInputProps()}
      />
    </div>
  );
}

/** Zone de dépôt visuelle (drag & drop ou clic pour parcourir). */
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
