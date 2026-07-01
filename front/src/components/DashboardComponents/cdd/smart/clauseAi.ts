/**
 * Assistance IA pour le CDD : modification d'une clause selon une consigne libre
 * + vérification de la convention collective. Réutilise le client IA existant
 * (proxy → /openai-chat-5). Les builders de prompt sont purs (testables).
 */
import { callOpenAi52 } from "../../../../utils/aiClient";

export function clauseInstructionPrompt(
  clauseText: string,
  instruction: string,
): string {
  return (
    `Tu es juriste expert en droit du travail français, spécialisé dans le CDD. ` +
    `Modifie la clause ci-dessous selon la consigne de l'utilisateur, en conservant ` +
    `la conformité légale (mentions obligatoires du CDD). ` +
    `Consigne : « ${instruction.trim()} ». ` +
    `Réponds UNIQUEMENT avec le texte de la clause, sans préambule ni explication.\n\n` +
    `Clause :\n"""\n${clauseText}\n"""`
  );
}

export async function instructClause(
  clauseText: string,
  instruction: string,
): Promise<string> {
  const out = await callOpenAi52(
    clauseInstructionPrompt(clauseText, instruction),
    "none",
    "medium",
    "gpt-5.4-nano",
  );
  return out.trim();
}

export function conventionPrompt(
  convention: string,
  poste: string,
  naf: string,
): string {
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

export async function verifyConvention(
  convention: string,
  poste: string,
  naf: string,
): Promise<string> {
  const out = await callOpenAi52(
    conventionPrompt(convention, poste, naf),
    "low",
    "low",
    "gpt-5.2",
  );
  return out.trim();
}
