import { FcGoogle } from "react-icons/fc"

import { marquerConnexionExterne } from "../../utils/destinationApresConnexion"


export const ConnectGoogle = () => {
    const PROXY_URL: string = import.meta.env.VITE_URL_PROXY || "http://localhost:3000";

    const handleSubmitGoogle = () => {
        // On quitte l'application : au retour, ce repère permet de reprendre la
        // page que l'utilisateur voulait ouvrir avant de se connecter.
        marquerConnexionExterne();
        window.location.href = `${PROXY_URL}/api/user/auth/google`;
    };

    return (
        <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-lumenjuris text-sm font-medium text-lumenjuris transition-colors hover:bg-lumenjuris-background"
            type="button"
            onClick={handleSubmitGoogle}
        >
            <FcGoogle className="text-[18px]" />
            Continuer avec Google
        </button>
    )
}