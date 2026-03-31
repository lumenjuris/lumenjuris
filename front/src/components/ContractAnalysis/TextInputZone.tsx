import React, { useState } from 'react';
import { Upload, FileText, Type } from 'lucide-react';

interface TextInputZoneProps {
  onTextSubmit: (text: string, fileName: string) => void;
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

export const TextInputZone: React.FC<TextInputZoneProps> = ({
  onTextSubmit,
  onFileUpload,
  isProcessing
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('file');
  const [textContent, setTextContent] = useState('');

  const handleTextSubmit = () => {
    if (textContent.trim().length < 100) {
      alert('Le texte doit contenir au moins 100 caractères pour une analyse pertinente.');
      return;
    }

    // Génération automatique du nom sans demander à l'utilisateur
    const autoName = `Contrat_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`;
    onTextSubmit(textContent.trim(), autoName);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier que c'est un PDF
      if (file.type !== 'application/pdf') {
        alert('Seuls les fichiers PDF sont acceptés.');
        return;
      }
      onFileUpload(file);
    }
  };

  const isTextValid = textContent.trim().length >= 100;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Onglets */}
      <div className="flex bg-gray-100 rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab('file')}
          className={`flex-1 px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'file'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          <Upload size={20} />
          Importer un PDF
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 px-6 py-4 font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'text'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
            }`}
        >

          <Type size={20} />
          Saisir le texte directement
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white border border-gray-200 rounded-b-2xl shadow-lg">
        {activeTab === 'text' ? (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="contractText" className="block text-sm font-medium text-gray-700 mb-2">
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
                disabled={!isTextValid || isProcessing}
                className={`w-full py-4 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-3 ${isTextValid && !isProcessing
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg transform hover:scale-[1.02]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Importez votre contrat PDF
                </h3>
                <p className="text-gray-500 mb-4">
                  Cliquez ici ou glissez-déposez votre fichier PDF
                </p>
                <div className="text-sm text-gray-400">
                  <span className="bg-gray-100 px-3 py-1 rounded-full">
                    📄 Format supporté : PDF uniquement
                  </span>
                </div>
              </label>
            </div>

            {/* Message supprimé pour éviter duplication avec App.tsx */}
          </div>
        )}
      </div>

      {/* Aide */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">💡 Conseils pour une meilleure analyse</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Pour le texte :</strong> Copiez l'intégralité du contrat avec tous les articles</li>
          <li>• <strong>Pour le PDF :</strong> Assurez-vous que le texte est sélectionnable (pas d'image scannée)</li>
          <li>• <strong>Qualité :</strong> Plus le contrat est complet, plus l'analyse sera précise</li>
          <li>• <strong>Format :</strong> Les contrats structurés avec des articles numérotés donnent de meilleurs résultats</li>
        </ul>
      </div>
    </div>
  );
};
