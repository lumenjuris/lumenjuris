import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Document arrivant directement d'un autre module (ex. générateur de CDD) :
  // un PDF est passé en data-URI dans l'état de navigation → ouvre le wizard.
  useEffect(() => {
    const state = location.state as
      | { incomingPdf?: string; incomingName?: string }
      | null;
    if (!state?.incomingPdf) return;
    let cancelled = false;
    fetch(state.incomingPdf)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        setSelectedFile(
          new File([blob], state.incomingName || "contrat.pdf", {
            type: "application/pdf",
          }),
        );
      })
      .catch(() => {});
    // Nettoie l'état pour éviter de rouvrir le wizard au prochain rendu.
    navigate(location.pathname, { replace: true, state: null });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
