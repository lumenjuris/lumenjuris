
import { useEffect, useState } from "react"


//Hook pour détecter le chargement complet de l'application
export const usePageLoaded = ():boolean => {
    const [ready, setReady] = useState(document.readyState === 'complete')
    console.log("Chargement de l'application en cours")


    useEffect(() => {
        if (ready) return
        const handler = () => setReady(true)
        window.addEventListener('load', handler)
        return () => window.removeEventListener('load', handler)
    }, [])

    return ready
}