import { create } from 'zustand';
import { ClauseRecommendation, ClauseRisk } from '../types';

export interface AppliedRecommendation {
  clauseId: string;
  recommendationIndex: number;
  recommendation: ClauseRecommendation;
  appliedAt: Date;
  originalClause: ClauseRisk;
}

interface AppliedRecommendationsState {
  appliedRecommendations: AppliedRecommendation[];

  getAllRecommendation:()=>AppliedRecommendation[];
  setAppliedRecommendations: (items: AppliedRecommendation[]) => void;
  
  applyRecommendation: (
    clauseId: string,
    recommendationIndex: number,
    recommendation: ClauseRecommendation,
    originalClause: ClauseRisk,
  ) => void;
  removeAppliedRecommendation: (clauseId: string, recommendationIndex: number) => void;
  isRecommendationApplied: (clauseId: string, recommendationIndex: number) => boolean;
  clearAllAppliedRecommendations: () => void;
  hasAnyAppliedRecommendations: () => boolean;
  generateWordDocument: (originalContent?: string, fileName?: string) => void;
  generatePDFDocument: (originalContent?: string, fileName?: string) => void;
}

export const useAppliedRecommendationsStore = create<AppliedRecommendationsState>()(
  (set, get) => ({
      appliedRecommendations: [],


      getAllRecommendation: () => {
        return get().appliedRecommendations
      },

      setAppliedRecommendations: (items) => {
        set({
          appliedRecommendations: items.map((item) => ({
            ...item,
            appliedAt: new Date(item.appliedAt),
          })),
        });
      },

      /**
       * Ajout dans la collection des appliedRecommendations.
       * @param clauseId - L'id de la clause sur laquelle on applique la modification 
       * @param recommendationIndex -Index de la nouvelle recommendation
       * @param recommendation - Le nouveau texte de la clause
       * @param originalClause - Le text d'origine de la clause
       */
      applyRecommendation: (clauseId, recommendationIndex, recommendation, originalClause) => {
        set((state) => ({
          appliedRecommendations: [
            ...state.appliedRecommendations,
            {
              clauseId,
              recommendationIndex,
              recommendation,
              appliedAt: new Date(),
              originalClause,
            },
          ],
        }));

      },


      
      removeAppliedRecommendation: (clauseId, recommendationIndex) => {
        set((state) => ({
          appliedRecommendations: state.appliedRecommendations.filter(
            (applied) =>
              !(applied.clauseId === clauseId && applied.recommendationIndex === recommendationIndex),
          ),
        }));
      },



      isRecommendationApplied: (clauseId, recommendationIndex) => {
        return get().appliedRecommendations.some(
          (applied) =>
            applied.clauseId === clauseId && applied.recommendationIndex === recommendationIndex,
        );
      },



      clearAllAppliedRecommendations: () => {
        set({ appliedRecommendations: [] });
      },



      hasAnyAppliedRecommendations: () => {
        return get().appliedRecommendations.length > 0;
      },


      
      generateWordDocument: async (originalContent?: string, fileName?: string) => {
        const appliedRecommendations = get().appliedRecommendations;

        try {
          // Importer dynamiquement docx et file-saver
          const docx = await import('docx');
          const { saveAs } = await import('file-saver');
          const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

          if (originalContent && appliedRecommendations.length > 0) {
            // Générer le document modifié avec les recommandations appliquées
            let modifiedContent = originalContent;

            // Appliquer chaque recommandation (remplacements robustes)
            appliedRecommendations.forEach((applied) => {
              const originalClauseText = applied.originalClause.content;
              const newClauseText = applied.recommendation.clauseText;
              if (!originalClauseText) return;
              // Créer une regex tolérante aux espaces multiples et retours ligne
              const escaped = originalClauseText
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
              const re = new RegExp(escaped, 'g');
              if (re.test(modifiedContent)) {
                modifiedContent = modifiedContent.replace(re, newClauseText);
              } else {
                // Fallback: remplacement simple (cas exact unique)
                modifiedContent = modifiedContent.replace(originalClauseText, newClauseText);
              }
            });

            // Créer le document Word
            const doc = new Document({
              sections: [{
                properties: {},
                children: [
                  // Titre principal
                  new Paragraph({
                    text: 'DOCUMENT MODIFIÉ AVEC RECOMMANDATIONS APPLIQUÉES',
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 }
                  }),

                  // Informations du document
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Document original : ', bold: true }),
                      new TextRun({ text: fileName || 'Document' })
                    ],
                    spacing: { after: 120 }
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Date de modification : ', bold: true }),
                      new TextRun({ text: new Date().toLocaleString('fr-FR') })
                    ],
                    spacing: { after: 120 }
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Nombre de modifications appliquées : ', bold: true }),
                      new TextRun({ text: appliedRecommendations.length.toString() })
                    ],
                    spacing: { after: 400 }
                  }),

                  // Section des modifications
                  new Paragraph({
                    text: 'MODIFICATIONS APPLIQUÉES',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                  }),

                  // Liste des modifications
                  ...appliedRecommendations.map((applied, idx) =>
                    new Paragraph({
                      text: `${idx + 1}. ${applied.originalClause.type} - ${applied.recommendation.title}`,
                      bullet: { level: 0 },
                      spacing: { after: 120 }
                    })
                  ),

                  // Section du contenu modifié
                  new Paragraph({
                    text: 'CONTENU MODIFIÉ',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 300 }
                  }),

                  // Contenu modifié (diviser par paragraphes)
                  ...modifiedContent.split('\n\n').map(para =>
                    new Paragraph({
                      text: para.trim(),
                      spacing: { after: 200 }
                    })
                  )
                ]
              }]
            });

            // Générer et sauvegarder le fichier
            const blob = await docx.Packer.toBlob(doc);
            saveAs(blob, `${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'document'}_modifie.docx`);

          } else {
            // Fallback : générer un rapport des recommandations seulement
            const doc = new Document({
              sections: [{
                properties: {},
                children: [
                  new Paragraph({
                    text: 'Rapport des recommandations appliquées',
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 }
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Généré le : ', bold: true }),
                      new TextRun({ text: new Date().toLocaleString('fr-FR') })
                    ],
                    spacing: { after: 200 }
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Nombre total : ', bold: true }),
                      new TextRun({ text: appliedRecommendations.length.toString() })
                    ],
                    spacing: { after: 400 }
                  }),

                  // Recommandations
                  ...appliedRecommendations.flatMap((item, idx) => [
                    new Paragraph({
                      text: `Recommandation ${idx + 1}`,
                      heading: HeadingLevel.HEADING_2,
                      spacing: { before: 300, after: 200 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Clause originale : ', bold: true }),
                        new TextRun({ text: item.originalClause.type })
                      ],
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Problème identifié : ', bold: true }),
                        new TextRun({ text: item.originalClause.justification })
                      ],
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Recommandation : ', bold: true }),
                        new TextRun({ text: item.recommendation.title })
                      ],
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      text: 'Texte suggéré :',
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      text: item.recommendation.clauseText,
                      indent: { left: 567 }, // 1cm indent
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Avantages : ', bold: true }),
                        new TextRun({ text: item.recommendation.benefits })
                      ],
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Réduction des risques : ', bold: true }),
                        new TextRun({ text: item.recommendation.riskReduction })
                      ],
                      spacing: { after: 120 }
                    }),

                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Appliquée le : ', bold: true }),
                        new TextRun({ text: item.appliedAt.toLocaleString('fr-FR') })
                      ],
                      spacing: { after: 400 }
                    })
                  ])
                ]
              }]
            });

            const blob = await docx.Packer.toBlob(doc);
            saveAs(blob, 'recommandations-appliquees.docx');
          }
        } catch (error) {
          console.error('Erreur lors de la génération du document Word:', error);
          // Fallback vers un fichier texte simple
          const appliedRecommendations = get().appliedRecommendations;
          let content = `DOCUMENT MODIFIÉ AVEC RECOMMANDATIONS APPLIQUÉES\n\n`;

          if (originalContent && appliedRecommendations.length > 0) {
            let modifiedContent = originalContent;
            appliedRecommendations.forEach((applied) => {
              modifiedContent = modifiedContent.replace(applied.originalClause.content, applied.recommendation.clauseText);
            });
            content += modifiedContent;
          } else {
            content += 'Aucune recommandation appliquée';
          }

          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'document'}_modifie.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      },

      generatePDFDocument: async (originalContent?: string, fileName?: string) => {
        const appliedRecommendations = get().appliedRecommendations;
        try {
          const { jsPDF } = await import('jspdf');
          const doc = new jsPDF();
          const margin = 20;
          let y = margin;
          const pageWidth = doc.internal.pageSize.width;
          const maxWidth = pageWidth - margin * 2;

          if (originalContent && appliedRecommendations.length > 0) {
            // Générer le PDF du document modifié
            let modifiedContent = originalContent;

            // Appliquer chaque recommandation
            appliedRecommendations.forEach((applied) => {
              const originalClauseText = applied.originalClause.content;
              const newClauseText = applied.recommendation.clauseText;
              if (!originalClauseText) return;
              const escaped = originalClauseText
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
              const re = new RegExp(escaped, 'g');
              if (re.test(modifiedContent)) {
                modifiedContent = modifiedContent.replace(re, newClauseText);
              } else {
                modifiedContent = modifiedContent.replace(originalClauseText, newClauseText);
              }
            });

            // En-tête
            doc.setFontSize(16);
            doc.text('DOCUMENT MODIFIÉ', margin, y);
            y += 8;
            doc.setFontSize(10);
            doc.text(`Document : ${fileName || 'Document'}`, margin, y);
            y += 5;
            doc.text(`Modifié le : ${new Date().toLocaleString('fr-FR')}`, margin, y);
            y += 5;
            doc.text(`${appliedRecommendations.length} modification(s) appliquée(s)`, margin, y);
            y += 10;

            // Liste des modifications
            doc.setFontSize(12);
            doc.text('MODIFICATIONS APPLIQUÉES :', margin, y);
            y += 6;
            doc.setFontSize(8);
            appliedRecommendations.forEach((applied, idx) => {
              if (y > 260) {
                doc.addPage();
                y = margin;
              }
              const modifText = `${idx + 1}. ${applied.originalClause.type} - ${applied.recommendation.title}`;
              const lines = doc.splitTextToSize(modifText, maxWidth);
              doc.text(lines, margin, y);
              y += lines.length * 4 + 2;
            });

            y += 10;
            if (y > 250) {
              doc.addPage();
              y = margin;
            }

            // Contenu modifié
            doc.setFontSize(12);
            doc.text('CONTENU MODIFIÉ :', margin, y);
            y += 8;
            doc.setFontSize(8);

            const contentLines = doc.splitTextToSize(modifiedContent, maxWidth);
            contentLines.forEach((line: string) => {
              if (y > 280) {
                doc.addPage();
                y = margin;
              }
              doc.text(line, margin, y);
              y += 4;
            });

            doc.save(`${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'document'}_modifie.pdf`);
          } else {
            // Fallback : PDF des recommandations seulement
            doc.setFontSize(18);
            doc.text('Rapport des recommandations appliquées', margin, y);
            y += 10;
            doc.setFontSize(10);
            doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, y);
            y += 10;
            doc.text(`Nombre total : ${appliedRecommendations.length}`, margin, y);
            y += 15;

            appliedRecommendations.forEach((item, idx) => {
              if (y > 260) {
                doc.addPage();
                y = margin;
              }
              doc.setFontSize(12);
              doc.text(`Recommandation ${idx + 1}`, margin, y);
              y += 6;
              doc.setFontSize(8);

              const wrap = (text: string, width: number) => doc.splitTextToSize(text, width);
              const maxWidth = pageWidth - margin * 2 - 5;

              const lines = [
                `Clause originale : ${item.originalClause.type}`,
                `Problème : ${item.originalClause.justification}`,
                `Recommandation : ${item.recommendation.title}`,
                `Texte suggéré : ${item.recommendation.clauseText}`,
                `Avantages : ${item.recommendation.benefits}`,
                `Réduction des risques : ${item.recommendation.riskReduction}`,
                `Appliquée le : ${item.appliedAt.toLocaleString('fr-FR')}`,
              ];
              lines.forEach((t) => {
                const splitted = wrap(t, maxWidth);
                doc.text(splitted, margin + 5, y);
                y += splitted.length * 4 + 2;
                if (y > 260) {
                  doc.addPage();
                  y = margin;
                }
              });
              y += 4;
            });

            doc.save('recommandations-appliquees.pdf');
          }
        } catch (e) {
          console.error('jsPDF error', e);
          get().generateWordDocument(originalContent, fileName);
        }
      },
    }),
);