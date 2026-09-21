/**
 * Reçoit le nouvel état des paramètres utilisateur lorsqu'un changement a eu lieu dans le Frontend
 *
 * @param input - état des différents paramètres
 * @returns - état des paramètres à stocker dans le UserPreference model de la BDD
 */
export function normalizeAccountParameters(input: unknown): {
  dyslexicMode: boolean;
  emailNotifications: boolean;
  telephone: string | null;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { dyslexicMode: false, emailNotifications: true, telephone: null };
  }
  const parameters = input as {
    dyslexicMode?: unknown;
    emailNotifications?: unknown;
    telephone?: unknown;
  };
  return {
    dyslexicMode: Boolean(parameters.dyslexicMode),
    emailNotifications: parameters.emailNotifications !== false,
    telephone: normalizeTelephone(parameters.telephone),
  };
}

/**
 * Téléphone professionnel de l'utilisateur, repris pour préremplir les
 * contrats. Stocké ici plutôt que dans l'entreprise pour ne pas modifier la
 * structure de la base. On ne garde que des caractères de numéro, et une
 * longueur raisonnable.
 */
function normalizeTelephone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9+().\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
  return cleaned.length > 0 ? cleaned : null;
}
