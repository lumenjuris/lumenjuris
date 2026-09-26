/**
 * Mémorise la page qu'un visiteur a essayé d'ouvrir avant qu'on lui demande de
 * se connecter, pour l'y emmener une fois connecté.
 *
 * Le stockage passe par `localStorage` et non par le store : la connexion
 * Google quitte l'application, le navigateur recharge tout au retour, et un
 * état gardé en mémoire aurait disparu entre-temps.
 *
 * La destination est datée et ne vaut qu'une demi-heure. Sans cela, un
 * visiteur qui renonce à se connecter se retrouverait renvoyé vers un module
 * choisi la semaine précédente à sa prochaine visite.
 */

const CLE_STOCKAGE = "lumenjuris.destination-apres-connexion";

/** Au-delà, la destination est considérée comme oubliée. */
const DUREE_DE_VIE_MS = 30 * 60 * 1000;

interface DestinationStockee {
  chemin: string;
  /** Date d'écriture, en millisecondes. */
  ecriteA: number;
}

/**
 * Enregistre la destination. Appelée au moment où la navigation d'un visiteur
 * est retenue, pas au moment où il se connecte.
 */
export function memoriserDestination(chemin: string) {
  const aEnregistrer: DestinationStockee = { chemin, ecriteA: Date.now() };
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(aEnregistrer));
  } catch {
    // Navigation privée ou stockage plein : on se passe de la reprise, la
    // connexion elle-même doit continuer à fonctionner.
  }
}

/** Efface la destination, qu'elle ait servi ou non. */
export function oublierDestination() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch {
    // Voir memoriserDestination : le stockage peut être indisponible.
  }
}

/**
 * Renvoie la destination en attente, ou `null` s'il n'y en a pas, si elle a
 * expiré ou si le stockage est illisible. Ne l'efface pas : utiliser
 * `consommerDestination` pour cela.
 */
export function lireDestination(): string | null {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return null;

    const stockee = JSON.parse(brut) as Partial<DestinationStockee>;
    if (typeof stockee.chemin !== "string" || typeof stockee.ecriteA !== "number") {
      oublierDestination();
      return null;
    }

    if (Date.now() - stockee.ecriteA > DUREE_DE_VIE_MS) {
      oublierDestination();
      return null;
    }

    return stockee.chemin;
  } catch {
    // Contenu corrompu ou stockage inaccessible : on repart de zéro.
    oublierDestination();
    return null;
  }
}

/**
 * Renvoie la destination en attente et l'efface dans la foulée : elle ne doit
 * servir qu'une fois, sous peine de détourner les navigations suivantes.
 */
export function consommerDestination(): string | null {
  const chemin = lireDestination();
  oublierDestination();
  return chemin;
}

/* ------------------------------------------------------------------------- *
 * Retour d'une connexion par un fournisseur externe (Google)
 * ------------------------------------------------------------------------- */

const CLE_CONNEXION_EXTERNE = "lumenjuris.connexion-externe-en-cours";

/** Un aller-retour vers le fournisseur qui dépasse ce délai est abandonné. */
const DUREE_ALLER_RETOUR_MS = 10 * 60 * 1000;

/**
 * Note qu'on quitte l'application pour aller s'authentifier ailleurs.
 *
 * Sans ce repère, le retour de Google serait indiscernable d'un simple
 * rechargement de page : on renverrait vers la destination mémorisée un
 * utilisateur déjà connecté qui n'a rien demandé.
 */
export function marquerConnexionExterne() {
  try {
    localStorage.setItem(CLE_CONNEXION_EXTERNE, String(Date.now()));
  } catch {
    // Stockage indisponible : la connexion marche toujours, seule la reprise
    // de la navigation est perdue.
  }
}

/**
 * Dit si l'on revient d'un fournisseur externe, et efface le repère : un
 * retour ne vaut qu'une fois.
 */
export function consommerRetourConnexionExterne(): boolean {
  try {
    const brut = localStorage.getItem(CLE_CONNEXION_EXTERNE);
    localStorage.removeItem(CLE_CONNEXION_EXTERNE);
    if (!brut) return false;

    const partiA = Number(brut);
    return Number.isFinite(partiA) && Date.now() - partiA < DUREE_ALLER_RETOUR_MS;
  } catch {
    return false;
  }
}
