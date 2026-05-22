import React, { useState, useCallback } from "react";
import { Upload, FileText, Type } from "lucide-react";

import InputFile from "../common/InputFile";

interface TextInputZoneProps {
  onTextSubmit: (text: string, fileName: string) => void;
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
  analyseCredit?: number | null;
}

export const TextInputZone: React.FC<TextInputZoneProps> = ({
  onTextSubmit,
  onFileUpload,
  isProcessing,
  analyseCredit,
}) => {
  const isBlocked =
    analyseCredit !== null &&
    analyseCredit !== undefined &&
    analyseCredit < 100;
  const [activeTab, setActiveTab] = useState<"text" | "file">("file");
  const [textContent, setTextContent] = useState("");

  const handleTextSubmit = () => {
    if (textContent.trim().length < 100) {
      alert(
        "Le texte doit contenir au moins 100 caractères pour une analyse pertinente.",
      );
      return;
    }

    // Génération automatique du nom sans demander à l'utilisateur
    const autoName = `Contrat_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`;
    onTextSubmit(textContent.trim(), autoName);
  };

  const ACCEPTED_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  // Fonction onDrop pour react-dropzone
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        if (!ACCEPTED_MIME_TYPES.has(file.type)) {
          alert("Seuls les fichiers PDF, DOC et DOCX (Word) sont acceptés.");
          return;
        }
        onFileUpload(file);
      }
    },
    [onFileUpload],
  );

  const isTextValid = textContent.trim().length >= 100;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Onglets */}
      <div className="flex bg-gray-100 rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab("file")}
          className={`flex-1 px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "file"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <Upload size={20} />
          Importer un PDF
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`flex-1 px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "text"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <Type size={20} />
          Saisir le texte directement
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white border border-gray-200 rounded-b-2xl shadow-lg">
        {activeTab === "text" ? (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="contractText"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  📄 Texte du contrat *
                </label>
                <textarea
                  id="contractText"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Collez ici le texte complet de votre contrat...

Exemple :
CONTRAT DE PRESTATION DE SERVICES

Entre les soussignés :
- Société ABC, représentée par M. X
- Société XYZ, représentée par Mme Y

Il a été convenu ce qui suit :

ARTICLE 1 - OBJET
La présente convention a pour objet...

ARTICLE 2 - OBLIGATIONS
Le prestataire s'engage à...

(continuez avec le texte complet de votre contrat)"
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={isProcessing}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">
                    {textContent.length} caractères
                    {textContent.length < 100 && (
                      <span className="text-orange-600 ml-2">
                        (minimum 100 requis)
                      </span>
                    )}
                  </p>
                  {isTextValid && (
                    <span className="text-green-600 text-sm font-medium">
                      ✅ Texte suffisant pour l'analyse
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleTextSubmit}
                disabled={!isTextValid || isProcessing || isBlocked}
                className={`w-full py-4 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-3 ${
                  isTextValid && !isProcessing && !isBlocked
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg transform hover:scale-[1.02]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Analyser ce texte avec l'IA
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Composant input file avec React-dropzone pour le drag & drop */}
            <InputFile
              onDrop={onDrop}
              accepted={{
                "application/pdf": [".pdf"],
                "application/msword": [".doc"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                  [".docx"],
              }}
              multiple={false}
              fieldTitle="Importez votre contrat"
              fieldDescription="Cliquez ici ou glissez-déposez votre fichier"
              supportedFileType="PDF, DOC, DOCX"
              disabled={isBlocked}
            />
          </div>
        )}
      </div>

      {/* Affiche l'alerte crédits insuffisants ou l'aide */}
      {isBlocked ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">
              Crédits d'analyse insuffisants
            </p>
            <p className="mt-0.5 text-sm text-red-600">
              Il vous reste <strong>{analyseCredit}</strong> crédit
              {analyseCredit !== 1 ? "s" : ""} d'analyse, mais 100 crédits sont
              nécessaires pour lancer une analyse. Rechargez vos crédits depuis
              votre espace abonnement.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Conseils pour une meilleure analyse
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>
              • <strong>Pour le texte :</strong> Copiez l'intégralité du contrat
              avec tous les articles
            </li>
            <li>
              • <strong>Pour le PDF :</strong> Assurez-vous que le texte est
              sélectionnable (pas d'image scannée)
            </li>
            <li>
              • <strong>Qualité :</strong> Plus le contrat est complet, plus
              l'analyse sera précise
            </li>
            <li>
              • <strong>Format :</strong> Les contrats structurés avec des
              articles numérotés donnent de meilleurs résultats
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
