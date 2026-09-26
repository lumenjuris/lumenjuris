import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AlertBanner, type AlertVariant } from "../../common/AlertBanner";

interface Notice {
  variant: AlertVariant;
  title: string;
  detail: string;
}

/**
 * Messages que le serveur ne peut transmettre que par un paramètre d'URL, faute
 * de pouvoir ouvrir un panneau : les redirections OAuth Google et les liens de
 * validation de compte reviennent sur l'accueil. Chaque entrée correspond à une
 * valeur reconnue, dans l'ordre de priorité d'affichage.
 */
const MESSAGES: { correspond: (p: URLSearchParams) => boolean; notice: Notice }[] = [
  {
    correspond: (p) =>
      p.get("error") === "banned" || p.get("reason") === "banned",
    notice: {
      variant: "error",
      title: "Votre compte a été bloqué",
      detail:
        "Votre compte a été bloqué par les services de modération. Si vous ne comprenez pas les raisons, vous pouvez nous contacter par e-mail à l'adresse contact@lumenjuris.com",
    },
  },
  {
    correspond: (p) => p.get("error") === "google-email-non-verifie",
    notice: {
      variant: "error",
      title: "Adresse Google non vérifiée",
      detail:
        "Votre adresse e-mail Google n'est pas vérifiée. Vérifiez-la auprès de Google, puis réessayez — ou créez un compte avec une adresse e-mail et un mot de passe.",
    },
  },
  {
    correspond: (p) => p.get("verified") === "true",
    notice: {
      variant: "success",
      title: "Compte validé",
      detail: "Votre adresse e-mail est confirmée. Vous pouvez vous connecter.",
    },
  },
];

/** Noms de paramètres consommés ici, retirés de l'URL une fois lus. */
const PARAMS_CONSOMMES = ["error", "reason", "verified"];

/**
 * Affiche, sur l'accueil, le message correspondant au paramètre d'URL posé par
 * une redirection serveur (compte bloqué, e-mail Google non vérifié, compte
 * validé). Le paramètre est retiré dès sa lecture, sinon le message reviendrait
 * à chaque rechargement et l'adresse resterait partageable en l'état.
 */
export function AccountRedirectNotice() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const trouve = MESSAGES.find((m) => m.correspond(searchParams));
    if (!trouve) return;

    setNotice(trouve.notice);

    const parametresNettoyes = new URLSearchParams(searchParams);
    PARAMS_CONSOMMES.forEach((nom) => parametresNettoyes.delete(nom));
    setSearchParams(parametresNettoyes, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!notice) return null;

  return (
    <AlertBanner
      title={notice.title}
      variant={notice.variant}
      detail={notice.detail}
      duration={15000}
      onClose={() => setNotice(null)}
    />
  );
}
