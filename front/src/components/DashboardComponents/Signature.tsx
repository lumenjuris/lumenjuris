import { useRef, useState } from "react";
import { X } from "lucide-react";
import { SignatureDashboard } from "./signature/SignatureDashboard";
import { SignatureWizard } from "./signature/SignatureWizard";

/**
 * Point d'entrée du module Signature (route `/signature`).
 *
 * "Nouveau contrat" ouvre directement le sélecteur de fichier OS.
 * Dès qu'un PDF est choisi, le wizard s'ouvre en overlay à l'étape 2
 * (placement des champs) — sans vue intermédiaire.
 */
export function Signature() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleNewContract() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) setSelectedFile(f);
    // Reset l'input pour permettre de choisir le même fichier une 2e fois
    e.target.value = "";
  }

  function closeWizard() {
    setRefreshKey((k) => k + 1);
    setSelectedFile(null);
  }

  return (
    <>
      {/* Input fichier caché — déclenché par le bouton "Nouveau contrat" */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChosen}
      />

      <SignatureDashboard
        refreshKey={refreshKey}
        onNewContract={handleNewContract}
      />

      {/* Wizard en overlay — apparaît uniquement quand un fichier est choisi */}
      {selectedFile && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 backdrop-blur-[2px] overflow-y-auto py-6 px-4">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <button
              onClick={closeWizard}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>

            <SignatureWizard
              initialFile={selectedFile}
              onSent={closeWizard}
              onExit={closeWizard}
            />
          </div>
        </div>
      )}
    </>
  );
}
