/**
 * Types de la page d'accueil (`/dashboard`).
 *
 * Les composants d'affichage ne connaissent que ces "vues" : c'est
 * `useDashboardData` qui transforme les réponses des APIs (contrathèque,
 * signature, négociation, facturation) en objets prêts à afficher.
 */

/** Statuts d'une enveloppe de signature (miroir de l'enum Prisma). */
export type EnvelopeStatus =
  | "DRAFT" | "SENT" | "PARTIALLY_SIGNED" | "SIGNED" | "DECLINED" | "EXPIRED";

/** Enveloppe de signature, version allégée (seuls les champs utiles ici). */
export interface SignatureEnvelope {
  id: string;
  documentName: string;
  status: EnvelopeStatus;
  counterpartyName: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Les 3 familles de travail affichées dans la file « À traiter ». */
export type QueueGroup = "Rédaction" | "Signature" | "Négociation";

/** Une ligne de la file « À traiter ». */
export interface QueueItem {
  /** Clé React (préfixée par la famille pour éviter les collisions d'ID). */
  key: string;
  group: QueueGroup;
  title: string;
  /** Sous-titre : cocontractant, nombre de propositions, etc. */
  meta: string;
  /** Colonne d'urgence : « Aujourd'hui », « À relancer », « Il y a 2 j »… */
  due: string;
  /** Vrai si la ligne demande une action rapide (affichée en rouge). */
  isUrgent: boolean;
  /** Libellé du lien de droite : « Reprendre », « Suivre », « Répondre ». */
  action: string;
  /** Route interne ouverte au clic. */
  to: string;
  /** Date de dernière activité (timestamp), utilisée pour le tri. */
  updatedAt: number;
}

/** Une des statistiques compactes affichées en bas de l'en-tête. */
export interface KpiCard {
  label: string;
  value: number;
  /** Précision affichée à côté du chiffre (« 2 en retard »), vide si inutile. */
  hint: string;
  /** Classe Tailwind de la couleur du `hint`, lisible sur fond sombre. */
  toneClassName: string;
  /** Vrai pour les compteurs qu'on retire de la ligne quand ils valent 0. */
  hideWhenZero: boolean;
  to: string;
}

/** Une étape du bloc « Premiers pas », cochée automatiquement. */
export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  /** Vrai dès que les données montrent que l'étape a été franchie. */
  done: boolean;
  /** Libellé du bouton affiché sur la prochaine étape à faire. */
  actionLabel: string;
  to: string;
}

/** Une échéance du bloc « Échéances à venir ». */
export interface DeadlineCard {
  key: string;
  /** Jour sur 2 chiffres, ex. « 02 ». */
  day: string;
  /** Mois abrégé, ex. « sept ». */
  month: string;
  title: string;
  /** Cocontractant + préavis éventuel. */
  party: string;
  tag: string;
  tagClassName: string;
  to: string;
}

/** Une alerte du bloc « Risques & conformité ». */
export interface RiskAlert {
  key: string;
  level: "high" | "medium";
  title: string;
  detail: string;
  to: string;
}

/**
 * Où en est une consommation, pour colorer la jauge sans que le composant ait
 * à refaire le calcul :
 *   - `ok`        : il reste de la marge ;
 *   - `warning`   : 80 % ou plus du quota est consommé ;
 *   - `full`      : le quota est épuisé, c'est le moment de proposer une offre ;
 *   - `unlimited` : quota illimité dans la formule ;
 *   - `disabled`  : fonctionnalité non incluse dans la formule.
 */
export type QuotaState = "ok" | "warning" | "full" | "unlimited" | "disabled";

/** Une jauge de consommation de la carte « Votre abonnement ». */
export interface QuotaBar {
  label: string;
  /** Valeur lisible : « 42 / 100 », « Illimité », « Non inclus ». */
  text: string;
  /** Remplissage de la barre, de 0 à 100. */
  percent: number;
  state: QuotaState;
}
