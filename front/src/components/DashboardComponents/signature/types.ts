/**
 * Types partagés du module de e-signature.
 *
 * Voir signature/README.md pour le workflow complet.
 */

/** Rôle du signataire : émetteur ("self") ou destinataire ("counterparty"). */
export type SignerRole = "self" | "counterparty";

/**
 * Un signataire identifié par une couleur. La couleur est reprise visuellement
 * sur tous les champs assignés à ce signataire (overlay sur le PDF).
 */
export interface Signer {
  /** Identifiant logique du rôle. */
  role: SignerRole;
  /** Libellé affiché dans l'UI ("Vous" / "Cocontractant"). */
  name: string;
  /** Nom de couleur Tailwind associé (ex: "indigo"). */
  color: string;
  /** Valeur hex correspondant à la couleur — utilisée pour les styles inline. */
  hex: string;
}

/**
 * Type de champ déposable sur le document.
 * - `signature` : zone de signature graphique
 *
 * La date est gérée automatiquement (`Field.signedAt`).
 */
export type FieldType = "signature";

/**
 * Une zone (signature ou paraphe) déposée sur le PDF.
 *
 * Les coordonnées sont exprimées en pourcentage de la page (0..1) plutôt qu'en
 * pixels absolus, ce qui les rend invariantes au zoom / au redimensionnement
 * du viewer.
 */
export interface Field {
  id: string;
  type: FieldType;
  signer: SignerRole;
  /** Index de page (0-based). */
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  /** dataUrl PNG de la signature/paraphe une fois signé. */
  value?: string;
  /** Date de signature (ISO) — affichée sous la signature. */
  signedAt?: string;
  /** Si vrai, le champ est dupliqué visuellement à la même position sur toutes les pages. */
  replicateAllPages?: boolean;
}

/** Étape du wizard. */
export type WizardStep = "prepare" | "place" | "sign";

/**
 * Signature capturée par l'utilisateur via la modale.
 * Réutilisée automatiquement pour tous les champs du signataire qui sont
 * encore vides.
 */
export interface CapturedSignature {
  /** Méthode de saisie : tracée à la main ou tapée stylisée. */
  type: "drawn" | "typed";
  /** Image PNG en data URL — c'est ce qui est rendu dans le champ. */
  dataUrl: string;
  /** Texte tapé (si type === "typed"). */
  text?: string;
  /** Identifiant de la police choisie (si type === "typed"). */
  font?: string;
}

/**
 * Signataires par défaut au démarrage du wizard. Les noms sont fixes
 * (pas d'inputs en étape 1, le focus reste sur l'ajout du contrat).
 */
export const SIGNERS_DEFAULT: Signer[] = [
  { role: "self",         name: "Vous",          color: "indigo",   hex: "#4f46e5" },
  { role: "counterparty", name: "Cocontractant", color: "emerald",  hex: "#10b981" },
];

/** Date "JJ/MM/AAAA" pour affichage humain à partir d'un ISO. */
export function formatSignedDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
