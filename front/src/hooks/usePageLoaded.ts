
import { useEffect, useState } from "react"


//Hook pour détecter le chargement complet de l'application
export const usePageLoaded = ():boolean => {
    const [ready, setReady] = useState(document.readyState === 'complete')

    useEffect(() => {
        if (ready) return
        // La page a pu finir de charger entre le premier affichage et ce moment :
        // l'événement « load » serait alors déjà passé, et l'écran de chargement
        // resterait affiché indéfiniment.
        if (document.readyState === 'complete') {
            setReady(true)
            return
        }
        const handler = () => setReady(true)
        window.addEventListener('load', handler)
        return () => window.removeEventListener('load', handler)
    }, [])

    return ready
}