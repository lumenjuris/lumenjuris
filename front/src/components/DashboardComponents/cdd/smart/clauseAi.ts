/**
 * Assistance IA pour le CDD : modification d'une clause ou du contrat selon une
 * consigne libre + vérification de la convention collective.
 * Les prompts sont construits par le proxy (services/assistant/assistantPrompts.ts),
 * jamais ici : le front n'envoie que des données.
 */
import { callAssistant } from "../../../../utils/aiClient";

/** Modification d'une clause de CDD selon une consigne libre. */
export async function instructClause(
  clauseText: string,
  instruction: string,
): Promise<string> {
  const out = await callAssistant("cdd-clause", { clauseText, instruction });
  return out.trim();
}

/** Modification globale du contrat selon une consigne libre (tout ou partie). */
export async function instructContract(
  contractText: string,
  instruction: string,
): Promise<string> {
  const out = await callAssistant("contract-instruction", { contractText, instruction });
  return out.trim();
}

/** Vérification de la convention collective d'un CDD. */
export async function verifyConvention(
  convention: string,
  poste: string,
  naf: string,
): Promise<string> {
  const out = await callAssistant("cdd-convention", { convention, poste, naf });
  return out.trim();
}
