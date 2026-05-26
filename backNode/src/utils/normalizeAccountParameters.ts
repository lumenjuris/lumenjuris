/**
 * Reçoit le nouvel état des paramètres utilisateur lorsqu'un changement a eu lieu dans le Frontend
 *
 * @param input - Booleans - état des différents paramètres
 * @returns - Booleans - état des paramètres à stocker dans le UserPreference model de la BDD
 */
export function normalizeAccountParameters(input: unknown): {
  dyslexicMode: boolean;
  emailNotifications: boolean;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { dyslexicMode: false, emailNotifications: true };
  }
  const parameters = input as {
    dyslexicMode?: unknown;
    emailNotifications?: unknown;
  };
  return {
    dyslexicMode: Boolean(parameters.dyslexicMode),
    emailNotifications: parameters.emailNotifications !== false,
  };
}
