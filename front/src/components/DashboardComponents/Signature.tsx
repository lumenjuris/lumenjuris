import { useRef, useState } from "react";
import { SignatureDashboard } from "./signature/SignatureDashboard";
import { SignatureWizard } from "./signature/SignatureWizard";

/**
 * Point d'entrée du module Signature (route `/signature`).
 *
 * "Nouveau contrat" ouvre directement le sélecteur de fichier OS.
 * Dès qu'un PDF est choisi, le wizard remplace le dashboard dans la page
 * (même comportement qu'avant, sans popup ni overlay).
 */
export function Signature() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) setSelectedFile(f);
    e.target.value = "";
  }

  function closeWizard() {
    setRefreshKey((k) => k + 1);
    setSelectedFile(null);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChosen}
      />

      {selectedFile ? (
        <SignatureWizard
          initialFile={selectedFile}
          onSent={closeWizard}
          onExit={closeWizard}
        />
      ) : (
        <SignatureDashboard
          refreshKey={refreshKey}
          onNewContract={() => fileInputRef.current?.click()}
        />
      )}
    </>
  );
}
