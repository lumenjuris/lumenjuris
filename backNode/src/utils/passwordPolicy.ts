/**
 * Règles de robustesse des mots de passe, communes à toutes les routes qui en
 * enregistrent un : création de compte, réinitialisation, changement depuis le
 * profil.
 *
 * Les mêmes règles sont affichées au fil de la frappe côté front (voir
 * `SignupForm`). Ce contrôle-ci est celui qui compte vraiment : le formulaire
 * ne protège que le formulaire, la route reste appelable directement.
 */

/** Longueur minimale exigée. */
const LONGUEUR_MINIMALE = 8;

interface ResultatValidation {
  valide: boolean;
  /** Message prêt à renvoyer à l'utilisateur ; vide quand le mot de passe convient. */
  message: string;
}

/**
 * Vérifie qu'un mot de passe respecte la politique : longueur minimale, au
 * moins une majuscule, un chiffre et un caractère spécial.
 *
 * Renvoie le premier manquement rencontré, pour un message clair plutôt qu'une
 * liste de tout ce qui ne va pas.
 */
export function validatePasswordStrength(password: unknown): ResultatValidation {
  if (typeof password !== "string" || password.length < LONGUEUR_MINIMALE) {
    return {
      valide: false,
      message: `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`,
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valide: false,
      message: "Le mot de passe doit contenir au moins une majuscule.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valide: false,
      message: "Le mot de passe doit contenir au moins un chiffre.",
    };
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    return {
      valide: false,
      message: "Le mot de passe doit contenir au moins un caractère spécial.",
    };
  }

  return { valide: true, message: "" };
}
