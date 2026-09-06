/**
 * Bandeau d'information affiché en haut de l'accueil (`InfoBanner`) et piloté
 * depuis Monitoring → onglet « Message Banner » (`MessageBanner`).
 *
 * Les messages sont stockés côté backend dans `backNode/message-banner.json`
 * (un tableau), servis par `GET /api/admin/message-banner` et créés par
 * `POST /api/admin/message-banner`.
 */

/** Catégorie d'un message : détermine l'icône et les couleurs du bandeau. */
export type BannerMessageType =
  | "information"
  | "nouveaute"
  | "update"
  | "maintenance"
  | "alerte";

/** Liste des catégories pour alimenter le `<select>` du formulaire admin. */
export const BANNER_MESSAGE_TYPES: { value: BannerMessageType; label: string }[] = [
  { value: "information", label: "Information" },
  { value: "nouveaute", label: "Nouveauté" },
  { value: "update", label: "Mise à jour" },
  { value: "maintenance", label: "Maintenance" },
  { value: "alerte", label: "Alerte" },
];

/**
 * Un message tel qu'il est stocké et renvoyé par l'API.
 *
 * Attention : `startAt` / `endAt` transitent en JSON, ce sont donc des chaînes
 * ISO (`"2026-09-17T00:00:00.000Z"`) et pas des `Date`, même si le backend les
 * construit avec `new Date()` avant de les écrire.
 */
export interface BannerMessage {
  /** Identifiant généré par le backend à la création, utilisé pour la suppression. */
  id: string;
  messageType: BannerMessageType;
  title: string;
  content: string;
  /** URL ou route interne du bouton « En savoir plus », ou `false` si aucun lien. */
  link: string | false;
  /** Date ISO de début d'affichage. */
  startAt: string;
  /** Date ISO de fin d'affichage. */
  endAt: string;
}

/** Ce que l'on envoie au `POST` : l'`id` est attribué par le backend. */
export type NewBannerMessage = Omit<BannerMessage, "id">;

/** Enveloppe commune des réponses de l'API bandeau. */
export interface BannerApiResponse {
  success: boolean;
  message: string;
  data?: BannerMessage[];
  error?: unknown;
}

/** Un message est diffusé entre `startAt` (inclus) et `endAt` (inclus). */
export function isBannerActive(message: BannerMessage, now: number = Date.now()): boolean {
  const start = new Date(message.startAt).getTime();
  const end = new Date(message.endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

/** Statut d'un message, utilisé pour l'affichage dans la liste admin. */
export type BannerStatus = "programme" | "actif" | "expire";

export function getBannerStatus(message: BannerMessage, now: number = Date.now()): BannerStatus {
  if (now < new Date(message.startAt).getTime()) return "programme";
  if (now > new Date(message.endAt).getTime()) return "expire";
  return "actif";
}
