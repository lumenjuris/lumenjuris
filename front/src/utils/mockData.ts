/**
 * 🧪 MOCK DATA - Version Mots-clés seulement
 * Données de test pour le développement (sans positions)
 */

import { ClauseRisk } from "../types";

export const mockClauses: ClauseRisk[] = [
  {
    id: "clause-1",
    type: "Clause pénale excessive",
    content:
      "En cas de retard dans l'exécution des prestations, une pénalité de 2% du montant total sera appliquée pour chaque jour de retard, sans limitation de durée.",
    riskScore: 5,
    category: "penalty",
    justification:
      "Pénalité manifestement excessive pouvant dépasser le préjudice réel (art. 1231-5 C. civ.)",
    suggestion: "Limiter à 0,5% par jour avec plafond à 20% du montant total",
    page: 1,
    keywords: ["pénalité", "retard", "2%", "jour"],
  },
  {
    id: "clause-2",
    type: "Résiliation unilatérale abusive",
    content:
      "Le Client se réserve le droit de résilier le présent contrat à tout moment, sans préavis ni indemnité, par simple notification écrite.",
    riskScore: 4,
    category: "termination",
    justification:
      "Déséquilibre contractuel majeur - résiliation sans cause légitime ni compensation",
    suggestion:
      "Prévoir un préavis de 3 mois et une indemnité équitable en cas de résiliation sans faute",
    page: 2,
    keywords: ["résilier", "tout moment", "sans préavis", "notification"],
  },
  {
    id: "clause-3",
    type: "Exclusion de garantie excessive",
    content:
      "Le Prestataire exclut toute garantie concernant la conformité, la disponibilité ou la performance des services fournis.",
    riskScore: 3,
    category: "warranty",
    justification:
      "Exclusion trop large des garanties légales et contractuelles",
    suggestion:
      "Maintenir les garanties légales minimales et prévoir un SLA raisonnable",
    page: 3,
    keywords: ["exclut", "garantie", "conformité", "performance"],
  },
  {
    id: "clause-4",
    type: "Non-concurrence disproportionnée",
    content:
      "Le Prestataire s'interdit pendant 5 ans après la fin du contrat toute activité concurrente sur l'ensemble du territoire français.",
    riskScore: 4,
    category: "nonCompete",
    justification:
      "Durée et étendue géographique excessives sans contrepartie financière suffisante",
    suggestion:
      "Limiter à 2 ans maximum avec zone géographique restreinte et indemnité compensatrice",
    page: 4,
    keywords: ["interdit", "5 ans", "concurrente", "territoire français"],
  },
  {
    id: "clause-5",
    type: "Confidentialité perpétuelle",
    content:
      "L'obligation de confidentialité demeure applicable sans limitation de durée, même après la fin du contrat.",
    riskScore: 2,
    category: "confidentiality",
    justification:
      "Durée excessive pour certains types d'informations confidentielles",
    suggestion:
      "Distinguer selon la nature des informations (5-10 ans max pour les informations commerciales)",
    page: 5,
    keywords: ["confidentialité", "sans limitation", "durée", "fin du contrat"],
  },
];

export const mockContractContent = `
CONTRAT DE PRESTATION DE SERVICES
=== PAGE 1 ===

ARTICLE 1 - OBJET
Le présent contrat a pour objet la fourniture de services informatiques par le Prestataire au Client.

ARTICLE 2 - OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à fournir les services conformément aux spécifications techniques annexées.

En cas de retard dans l'exécution des prestations, une pénalité de 2% du montant total sera appliquée pour chaque jour de retard, sans limitation de durée.

=== PAGE 2 ===

ARTICLE 3 - RÉSILIATION
Le Client se réserve le droit de résilier le présent contrat à tout moment, sans préavis ni indemnité, par simple notification écrite.

ARTICLE 4 - DURÉE
Le présent contrat est conclu pour une durée de 12 mois renouvelable tacitement.

=== PAGE 3 ===

ARTICLE 5 - GARANTIES
Le Prestataire exclut toute garantie concernant la conformité, la disponibilité ou la performance des services fournis.

ARTICLE 6 - RESPONSABILITÉ
La responsabilité du Prestataire est limitée au montant des prestations facturées.

=== PAGE 4 ===

ARTICLE 7 - NON-CONCURRENCE
Le Prestataire s'interdit pendant 5 ans après la fin du contrat toute activité concurrente sur l'ensemble du territoire français.

=== PAGE 5 ===

ARTICLE 8 - CONFIDENTIALITÉ
L'obligation de confidentialité demeure applicable sans limitation de durée, même après la fin du contrat.

ARTICLE 9 - DISPOSITIONS GÉNÉRALES
Le présent contrat est soumis au droit français.
`;

export const mockAnalysisResult = {
  content: mockContractContent,
  clauses: mockClauses,
  riskStats: {
    total: mockClauses.length,
    high: mockClauses.filter((c) => c.riskScore >= 4).length,
    medium: mockClauses.filter((c) => c.riskScore === 3).length,
    low: mockClauses.filter((c) => c.riskScore < 3).length,
    averageRisk:
      mockClauses.reduce((sum, c) => sum + c.riskScore, 0) / mockClauses.length,
  },
  analysis: {
    overallRisk: "high" as const,
    summary:
      "Contrat présentant plusieurs clauses déséquilibrées nécessitant une révision",
    recommendations: [
      "Réviser les conditions de pénalités excessives",
      "Équilibrer les conditions de résiliation",
      "Ajuster la clause de non-concurrence",
      "Préciser les garanties minimales",
    ],
  },
};

export default {
  mockClauses,
  mockContractContent,
  mockAnalysisResult,
};
