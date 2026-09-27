import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useUserStore } from "../../store/userStore";
import {
  consommerDestination,
  consommerRetourConnexionExterne,
  oublierDestination,
} from "../../utils/destinationApresConnexion";

/**
 * Reprend la navigation interrompue quand l'utilisateur revient d'une
 * connexion via un fournisseur externe (Google, Microsoft).
 *
 * Ce passage recharge entièrement l'application : le panneau de connexion qui
 * gérait la redirection n'existe plus au retour, personne ne lirait la
 * destination mémorisée. Ce hook s'en charge, une fois, à l'endroit le plus
 * haut de l'arbre.
 *
 * Il ne se déclenche que si l'on revient effectivement du fournisseur : un
 * rechargement ordinaire avec une session déjà ouverte ne doit détourner
 * personne.
 */
export function useRetourConnexionExterne() {
  const authStatus = useUserStore((state) => state.authStatus);
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === "idle" || authStatus === "loading") return;

    const revientDuFournisseur = consommerRetourConnexionExterne();

    if (authStatus === "unauthenticated") {
      // Connexion refusée ou abandonnée chez le fournisseur : la destination
      // n'a plus de raison d'attendre.
      if (revientDuFournisseur) oublierDestination();
      return;
    }

    if (!revientDuFournisseur) return;

    const destination = consommerDestination();
    if (destination) navigate(destination, { replace: true });
  }, [authStatus, navigate]);
}
