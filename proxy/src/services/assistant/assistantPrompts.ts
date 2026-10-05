/**
 * Prompts des petites aides IA de l'application (éditeur de CDD, contrathèque,
 * analyse de clause, chats). Construits ICI, côté proxy, et jamais dans le
 * front : le front n'envoie que des données (texte, consigne…).
 * Le générateur « de zéro » a ses propres prompts (services/generateur/scratchPrompts.ts).
 */

// ─── Éditeur de CDD ──────────────────────────────────────────────────────────

/** Modification d'une clause de CDD selon une consigne libre. */
export function buildCddClausePrompt(clauseText: string, instruction: string): string {
  return (
    `Tu es juriste expert en droit du travail français, spécialisé dans le CDD. ` +
    `Modifie la clause ci-dessous selon la consigne de l'utilisateur, en conservant ` +
    `la conformité légale (mentions obligatoires du CDD). ` +
    `Conserve TELS QUELS les marqueurs de variables au format {{NOM}} présents dans la clause ` +
    `(ne les traduis pas, ne les remplis pas, ne les supprime pas). ` +
    `Consigne : « ${instruction.trim()} ». ` +
    `Réponds UNIQUEMENT avec le texte de la clause, sans préambule ni explication.\n\n` +
    `Clause :\n"""\n${clauseText}\n"""`
  );
}

/** Modification globale d'un contrat selon une consigne libre (tout ou partie). */
export function buildContractInstructionPrompt(contractText: string, instruction: string): string {
  return (
    `Tu es juriste expert en droit français des contrats. ` +
    `Modifie le contrat ci-dessous selon la consigne de l'utilisateur. ` +
    `Ne modifie QUE ce que la consigne demande ; conserve tout le reste STRICTEMENT à l'identique. ` +
    `Conserve TELS QUELS les marqueurs de variables au format {{nom_variable}} ` +
    `(ne les traduis pas, ne les remplis pas, ne les supprime pas, sauf si la consigne l'exige). ` +
    `Conserve le format du document : une ligne « # » pour le titre, « ### » pour chaque intitulé ` +
    `d'article, paragraphes séparés par une ligne vide. ` +
    `Consigne : « ${instruction.trim()} ». ` +
    `Réponds UNIQUEMENT avec le contrat complet au même format, sans préambule ni commentaire.\n\n` +
    `Contrat :\n"""\n${contractText}\n"""`
  );
}

/** Vérification de la convention collective d'un CDD. */
export function buildConventionPrompt(convention: string, poste: string, naf: string): string {
  return (
    `Tu es juriste en droit du travail français. Évalue la convention collective ` +
    `« ${convention || "non précisée"} » pour un CDD d'accroissement temporaire au poste ` +
    `« ${poste || "non précisé"} »${naf ? ` (NAF ${naf})` : ""}.\n\n` +
    `Réponds en Markdown, TRÈS concis et visuel, sans introduction ni conclusion :\n` +
    `- 1ʳᵉ ligne exactement : « **Verdict :** » suivi de ✅ Cohérent / ⚠️ À vérifier / ❌ Inadapté, puis 8 mots max.\n` +
    `- Ensuite 3 puces maximum, chacune ≤ 18 mots, préfixées en gras : ` +
    `**Durée du travail**, **Période d'essai**, **Indemnités**.\n` +
    `- Pas de paragraphe long.`
  );
}

/** Rédaction du contenu d'un champ à remplir dans un contrat. */
export function buildFieldDraftPrompt(
  contractTitle: string,
  fieldLabel: string,
  sentence: string,
  knownFields: { label: string; value: string }[],
): string {
  const remplis = knownFields.map((field) => `- ${field.label} : ${field.value}`).join("\n");
  return (
    `Contrat : « ${contractTitle} ». Rédige le contenu du champ « ${fieldLabel} », qui s'insère dans la phrase : « ${sentence} ». ` +
    `Informations déjà connues :\n${remplis || "(aucune)"}\n` +
    `Consignes : français juridique clair, concret, adapté à ce contrat ; 1 à 3 phrases, 60 mots maximum ; ` +
    `n'invente aucun nom, montant ni date absent des informations connues ; ` +
    `réponds UNIQUEMENT avec le texte du champ, sans guillemets ni introduction.`
  );
}

// ─── Contrathèque ────────────────────────────────────────────────────────────

/** Reformulation d'une clause, avec ou sans consigne. */
export function buildReformulationPrompt(clauseText: string, instruction: string): string {
  const consigne = instruction
    ? `en tenant compte de cette consigne : « ${instruction} ». `
    : "pour la rendre plus claire, équilibrée et juridiquement robuste. ";
  return (
    `Tu es juriste expert en droit français des contrats. Reformule la clause ci-dessous ${consigne}` +
    `Réponds UNIQUEMENT avec le texte reformulé de la clause, sans préambule ni explication.\n\n` +
    `Clause à reformuler :\n"""\n${clauseText}\n"""`
  );
}

// ─── Analyse détaillée d'une clause (analyzer) ───────────────────────────────

/** Analyse d'une clause : résumé, risque, problèmes et 2 réécritures, en JSON. */
export function buildClauseAnalysisPrompt(clauseText: string): string {
  return `Tu es un avocat français spécialisé en droit des contrats.
Analyse la clause suivante:
"""${clauseText}"""

RÈGLE DE STYLE : n'utilise JAMAIS d'énumérations en chiffres romains ((i), (ii), (iii), i., ii.…) ; rédige en phrases complètes, ou numérote 1. 2. 3. si nécessaire.

Réponds STRICTEMENT en JSON:
{
  "summary":"résumé 2 lignes",
  "riskLevel":"High|Medium|Low",
  "riskScore":"0-100",
  "litigation":"type de litige potentiel",
  "issues":["problème1","problème2"],
  "advice":"conseil global (1-2 phrases)",
  "alternatives":[
    {
      "clause":"réécriture intégrale (Proposition 1)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    },
    {
      "clause":"réécriture intégrale (Proposition 2)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    }
  ]
}`;
}

// ─── Complément Word ─────────────────────────────────────────────────────────

/** Détail d'une clause pour le volet Word (JSON, réponses courtes, langue de la clause). */
export function buildAddinClauseDetailPrompt(clauseText: string): string {
  return `Tu es un avocat français spécialisé en droit des contrats. Tu t'adresses à des professionnels du droit.
Analyse la clause suivante:
"""${clauseText}"""

LANGUE — IMPÉRATIF : rédige TOUS les textes de ta réponse dans la langue de la
clause ci-dessus. Si la clause est en anglais, réponds en anglais. Le droit
applicable reste le droit français : seule la langue de rédaction s'adapte.

STYLE DES "issues" (problèmes) — IMPÉRATIF :
- 2 problèmes MAXIMUM (1 seul si un seul risque réel), classés du plus grave au moins grave.
- Une phrase courte chacun (20 mots max), qui va droit au risque concret.
- Langage clair et direct, sans jargon superflu ni énumération de généralités ; précis sur le plan juridique mais immédiatement compréhensible.
- Pas de chiffres romains ((i), (ii)…), pas de sous-listes.

Réponds STRICTEMENT en JSON:
{
  "summary":"résumé 1 ligne",
  "riskLevel":"High|Medium|Low",
  "riskScore":"0-100",
  "litigation":"type de litige potentiel",
  "issues":["problème principal (1 phrase courte)","problème secondaire éventuel (1 phrase courte)"],
  "advice":"conseil actionnable (1 phrase)",
  "alternatives":[
    {
      "clause":"réécriture intégrale (Proposition 1)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    },
    {
      "clause":"réécriture intégrale (Proposition 2)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    }
  ]
}`;
}

/** Question libre du juriste sur une clause, dans le volet Word. */
export function buildAddinQuestionPrompt(
  clauseText: string,
  clauseType: string,
  justification: string,
  question: string,
): string {
  return `Tu es un avocat français spécialisé en droit des contrats. Voici une clause d'un contrat :
"""${clauseText}"""

Contexte : cette clause a été identifiée comme à risque (${clauseType}) pour la raison suivante : ${justification}

Question du juriste : ${question}

Réponds de façon concise, structurée et opérationnelle, en droit français, sans inventer de jurisprudence ni d'article de loi.

LANGUE — IMPÉRATIF : rédige ta réponse dans la langue de la clause ci-dessus.
Si la clause est en anglais, réponds en anglais. Le droit applicable reste le
droit français : seule la langue de rédaction s'adapte.

FORMAT — le volet Word est étroit, la réponse doit se lire d'un coup d'œil :
- 180 mots maximum.
- Pas de titres de niveau 1 ou 2, pas de séparateurs horizontaux.
- Va droit au fait, sans préambule ni relance finale proposant d'autres questions.`;
}

// ─── Chats ───────────────────────────────────────────────────────────────────

/** Contexte de la page « Chat juridique ». */
export const CHAT_JURIDIQUE_CONTEXT =
  "Tu es un assistant juridique spécialisé en droit du travail français. Réponds avec précision en citant les articles du Code du travail pertinents.";

/** Contexte du chat sur une clause (analyzer). */
export function buildClauseChatContext(clauseText: string): string {
  return `Réponds en 2-3 phrases maximum. Pas d'introduction ni de conclusion.\n\nTexte de la clause:\n"""${clauseText.slice(0, 4000)}"""`;
}
