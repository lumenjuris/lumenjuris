import { marquerConnexionExterne } from "../../utils/destinationApresConnexion"


/** Logo Microsoft (les 4 carrés) en SVG, pour garder les couleurs officielles. */
const MicrosoftLogo = () => (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
)


export const ConnectMicrosoft = () => {
    const PROXY_URL: string = import.meta.env.VITE_URL_PROXY || "http://localhost:3000";

    const handleSubmitMicrosoft = () => {
        marquerConnexionExterne();
        window.location.href = `${PROXY_URL}/api/user/auth/microsoft`;
    };

    return (
        <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-lumenjuris text-sm font-medium text-lumenjuris transition-colors hover:bg-lumenjuris-background"
            type="button"
            onClick={handleSubmitMicrosoft}
        >
            <MicrosoftLogo />
            Continuer avec Microsoft
        </button>
    )
}
