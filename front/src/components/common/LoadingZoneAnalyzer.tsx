import { useState, useEffect, useRef } from "react"
import { AnalysisProgress } from "../../types/analysisProgress";


// Fréquence de rafraîchissement de la barre
const TICK_INTERVAL_MS = 200;
// La barre ne dépasse jamais ce pourcentage tant que l'IA n'a pas répondu
const MAX_PCT_BEFORE_RESPONSE = 95;
// À partir de ce pourcentage on affiche le message de finalisation
const FINAL_MESSAGE_FROM_PCT = 90;
// Clé localStorage où l'on mémorise la durée réelle des dernières réponses
const DURATION_STORAGE_KEY = "loadingZone:expectedDurations";


type PhaseMessage = { main: string; sub: string | null };

const PHASE_CONFIG: Record<
    string,
    {
        label: string;
        // Durée estimée par défaut (avant d'avoir mesuré de vraies réponses)
        defaultDurationMs: number;
        messages: PhaseMessage[];
        // Texte affiché en fin de chargement, quand l'IA n'a pas encore répondu
        finalLabel: string;
        finalMessage: PhaseMessage;
    }
> = {
    analysis: {
        label: "Analyse du document",
        defaultDurationMs: 53000,
        finalLabel: "Finalisation de l'analyse",
        finalMessage: {
            main: "Préparation du rendu final",
            sub: "Génération des clauses détectées",
        },
        messages: [
            {
                main: "Lecture du contrat",
                sub: "Compréhension de la structure du document",
            },
            {
                main: "Analyse du contenu",
                sub: "Comprendre les enjeux du document",
            },
            {
                main: "Détection des clauses",
                sub: "Évaluation des risques juridiques",
            },
            {
                main: "Génération du rapport",
                sub: "Organisation des résultats de l'analyse",
            },],
    },
    // Utilisé par la page "Comprendre ses contrats"
    summary: {
        label: "Résumé du contrat",
        defaultDurationMs: 20000,
        finalLabel: "Finalisation du résumé",
        finalMessage: {
            main: "Préparation de la synthèse",
            sub: "Mise en forme des points clés",
        },
        messages: [
            {
                main: "Lecture du contrat",
                sub: "Extraction du texte du document",
            },
            {
                main: "Identification des parties et de l'objet",
                sub: "Compréhension du contexte du contrat",
            },
            {
                main: "Repérage des obligations et des délais",
                sub: "Sélection des points d'attention",
            },
            {
                main: "Rédaction du résumé",
                sub: "Synthèse claire des éléments clés",
            },
        ],
    },
};


/*
    Durée attendue : on garde une moyenne des vraies durées de réponse
    (par phase) dans le localStorage, pour que la barre colle à la réalité.
*/
function readSavedDurations(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(DURATION_STORAGE_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function getExpectedDuration(phase: string): number {
    const savedDuration = readSavedDurations()[phase];
    if (typeof savedDuration === "number" && savedDuration > 0) return savedDuration;
    return PHASE_CONFIG[phase]?.defaultDurationMs ?? 30000;
}

function saveRealDuration(phase: string, realDurationMs: number) {
    try {
        const savedDurations = readSavedDurations();
        const previousDuration = savedDurations[phase];
        // Moyenne simple entre l'ancienne estimation et la nouvelle mesure,
        // pour lisser les réponses exceptionnellement rapides ou lentes
        savedDurations[phase] = typeof previousDuration === "number"
            ? Math.round((previousDuration + realDurationMs) / 2)
            : realDurationMs;
        localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(savedDurations));
    } catch {
        // localStorage indisponible : on garde la durée par défaut
    }
}


/*
    Progression : la barre avance vite au début puis ralentit en approchant
    de la fin, sans jamais s'arrêter net. Au bout de la durée attendue elle
    est autour de 90 %, et elle plafonne à 95 % tant que l'IA n'a pas répondu.
*/
function computeProgress(elapsedMs: number, expectedDurationMs: number): number {
    const speed = 2.3 / expectedDurationMs;
    const progress = 100 * (1 - Math.exp(-elapsedMs * speed));
    return Math.min(MAX_PCT_BEFORE_RESPONSE, Math.max(1, progress));
}


function useLoadingAnimation(phase: string, isActive: boolean, isComplete: boolean) {
    const [elapsedMs, setElapsedMs] = useState(0);
    const startTimeRef = useRef(Date.now());
    const expectedDurationRef = useRef(getExpectedDuration(phase));
    const hasSavedDurationRef = useRef(false);

    // Nouveau chargement : on repart de zéro
    useEffect(() => {
        startTimeRef.current = Date.now();
        expectedDurationRef.current = getExpectedDuration(phase);
        hasSavedDurationRef.current = false;
        setElapsedMs(0);
    }, [phase]);

    // Avancement du temps écoulé
    useEffect(() => {
        if (!isActive || isComplete) return;
        const timer = setInterval(() => {
            setElapsedMs(Date.now() - startTimeRef.current);
        }, TICK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [isActive, isComplete]);

    // Réponse reçue : on mémorise la vraie durée pour les prochains chargements
    useEffect(() => {
        if (!isComplete || hasSavedDurationRef.current) return;
        hasSavedDurationRef.current = true;
        saveRealDuration(phase, Date.now() - startTimeRef.current);
    }, [isComplete, phase]);

    const config = PHASE_CONFIG[phase];
    if (!config) {
        return { pct: 0, phaseLabel: "", currentMsg: { main: "Chargement…", sub: null } };
    }

    if (isComplete) {
        return {
            pct: 100,
            phaseLabel: config.finalLabel,
            currentMsg: { main: "Terminé", sub: "Affichage du résultat" },
        };
    }

    const pct = computeProgress(elapsedMs, expectedDurationRef.current);

    if (pct >= FINAL_MESSAGE_FROM_PCT) {
        return { pct: Math.round(pct), phaseLabel: config.finalLabel, currentMsg: config.finalMessage };
    }

    // Les messages défilent en suivant la progression (sans reboucler)
    const msgIndex = Math.min(
        config.messages.length - 1,
        Math.floor((pct / FINAL_MESSAGE_FROM_PCT) * config.messages.length),
    );

    return { pct: Math.round(pct), phaseLabel: config.label, currentMsg: config.messages[msgIndex] };
}



interface LoadingZoneProps {
    phase: string;
    analysisProgress?: AnalysisProgress | null;
    // Passer à true quand l'IA a répondu : la barre se remplit à 100 %
    // (le parent attend COMPLETION_ANIMATION_MS avant de changer de vue)
    isComplete?: boolean;
}

// Durée de l'animation de fin, à attendre côté parent avant d'afficher le résultat
export const COMPLETION_ANIMATION_MS = 600;

export function LoadingZoneAnalyzer({ phase, analysisProgress, isComplete = false }: LoadingZoneProps) {
    const isRetrying = (analysisProgress?.currentAttempt ?? 1) > 1;
    const { pct, currentMsg, phaseLabel } = useLoadingAnimation(phase, !isRetrying, isComplete);

    const displayMain = isRetrying
        ? `Nouvelle tentative ${analysisProgress?.currentAttempt}/${analysisProgress?.totalAttempts}`
        : currentMsg.main;
    const displaySub = isRetrying ? "Une erreur est survenue, réessai en cours…" : currentMsg.sub;
    const displayPct = isRetrying ? null : pct;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            {/* En-tête de phase */}
            <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-blue-600">{phaseLabel}</span>
                {displayPct !== null && (
                    <span className="text-sm text-gray-400 tabular-nums">{displayPct} %</span>
                )}
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-6">
                {isRetrying ? (
                    <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: "100%", animation: "pulse 1.5s ease-in-out infinite" }}
                    />
                ) : (
                    <div
                        className={`h-full rounded-full transition-all ease-out relative overflow-hidden ${isComplete ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%`, transitionDuration: `${isComplete ? COMPLETION_ANIMATION_MS : TICK_INTERVAL_MS}ms` }}
                    >
                        <div
                            className="absolute inset-0"
                            style={{
                                background:
                                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                                animation: "shimmer 2s ease-in-out infinite",
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="space-y-1 min-h-[2.5rem]">
                <p className="text-sm text-gray-700 transition-all duration-300">{displayMain}</p>
                {displaySub && (
                    <p className="text-xs text-gray-400 transition-all duration-300">{displaySub}</p>
                )}
            </div>

            {/* Points animés */}
            <div className="flex gap-1.5 justify-center mt-6">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="block w-1.5 h-1.5 rounded-full bg-blue-300"
                        style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                    />
                ))}
            </div>

            <style>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(100%); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
