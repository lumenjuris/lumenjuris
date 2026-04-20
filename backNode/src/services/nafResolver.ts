import { readFileSync } from "node:fs"

export type ConventionCollectiveSource = "naf" | "custom"

export type ConventionCollectiveItem = {
    key: string
    name: string
    idccCode: string | null
    source: ConventionCollectiveSource
}

type ConventionCollectiveCandidate = {
    key?: unknown
    name?: unknown
    idccCode?: unknown
    source?: unknown
}

type NafIdccEntry = {
    CodeIDCC?: string | null
    IntituléIDCC?: string | null
}

type NafSourceEntry = {
    Naf2008?: string
    IntituléNaf2008?: string | null
    IDCC?: NafIdccEntry[]
}

type NafEntry = {
    IntituléNaf?: string | null
    Sources?: NafSourceEntry[]
}

type NafContext = {
    intituleNaf: string | null
    conventionCollectives: ConventionCollectiveItem[]
}

type StatusJuridiqueMap = Record<string, string>

const nafData = JSON.parse(
    readFileSync(new URL("../../ressources/NAF.json", import.meta.url), "utf-8"),
) as Record<string, NafEntry>

const statusJuridiqueMap = JSON.parse(
    readFileSync(new URL("../../ressources/status_juridiques.json", import.meta.url), "utf-8"),
) as StatusJuridiqueMap

const nafContextByCodeNaf = new Map<string, NafContext>()

// Le JSON NAF est chargé une seule fois au démarrage pour éviter de le reparcourir à chaque requête.
for (const nafEntry of Object.values(nafData)) {
    for (const source of nafEntry.Sources ?? []) {
        const codeNaf = source.Naf2008?.trim().toUpperCase()

        if (!codeNaf) {
            continue
        }

        const currentContext = nafContextByCodeNaf.get(codeNaf) ?? {
            intituleNaf: source.IntituléNaf2008?.trim() || nafEntry.IntituléNaf?.trim() || null,
            conventionCollectives: [],
        }

        const nextConventionCollectives = mergeConventionCollectiveLists(
            currentContext.conventionCollectives,
            normalizeConventionCollectiveList(
                (source.IDCC ?? []).map((idccEntry) => ({
                    name: idccEntry.IntituléIDCC,
                    idccCode: idccEntry.CodeIDCC,
                    source: "naf",
                })),
                "naf",
            ),
        )

        nafContextByCodeNaf.set(codeNaf, {
            intituleNaf: currentContext.intituleNaf,
            conventionCollectives: nextConventionCollectives,
        })
    }
}

// Les customs sans code IDCC utilisent une clé dérivée du libellé pour rester sélectionnables dans le temps.
function normalizeKeyFragment(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

// La clé stable permet de stocker le choix préféré sans dépendre de l'ordre de la liste.
export function createConventionCollectiveKey(
    name: string,
    idccCode: string | null,
    source: ConventionCollectiveSource,
) {
    const normalizedIdccCode = idccCode?.trim() || null

    if (normalizedIdccCode) {
        return `${source}:${normalizedIdccCode}`
    }

    return `${source}:name:${normalizeKeyFragment(name)}`
}

// Cette normalisation s'applique à toute entrée venant du front ou d'un JSON déjà stocké en base.
export function normalizeConventionCollectiveItem(
    input: unknown,
    fallbackSource: ConventionCollectiveSource,
): ConventionCollectiveItem | null {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return null
    }

    const candidate = input as ConventionCollectiveCandidate
    const name = typeof candidate.name === "string" ? candidate.name.trim() : ""

    if (!name) {
        return null
    }

    const idccCode = typeof candidate.idccCode === "string" && candidate.idccCode.trim()
        ? candidate.idccCode.trim()
        : null

    const source = candidate.source === "custom" || candidate.source === "naf"
        ? candidate.source
        : fallbackSource

    const key = typeof candidate.key === "string" && candidate.key.trim()
        ? candidate.key.trim()
        : createConventionCollectiveKey(name, idccCode, source)

    return {
        key,
        name,
        idccCode,
        source,
    }
}

// Toute liste sauvegardée ou fusionnée passe ici pour être nettoyée et dédupliquée.
export function normalizeConventionCollectiveList(
    input: unknown,
    fallbackSource: ConventionCollectiveSource,
) {
    if (!Array.isArray(input)) {
        return []
    }

    const uniqueItems = new Map<string, ConventionCollectiveItem>()

    for (const candidate of input) {
        const normalizedItem = normalizeConventionCollectiveItem(candidate, fallbackSource)

        if (!normalizedItem) {
            continue
        }

        uniqueItems.set(normalizedItem.key, normalizedItem)
    }

    return [...uniqueItems.values()]
}

// Cette résolution est utilisée quand on remplit un profil depuis INSEE ou quand le code NAF est modifié.
export function getConventionCollectiveContextFromCodeNaf(codeNaf: string | null) {
    if (!codeNaf) {
        return {
            intituleNaf: null,
            conventionCollectives: [],
        }
    }

    return nafContextByCodeNaf.get(codeNaf.trim().toUpperCase()) ?? {
        intituleNaf: null,
        conventionCollectives: [],
    }
}

// L'API INSEE renvoie un code de catégorie juridique; ce helper le traduit en libellé métier exploitable.
export function getStatusJuridiqueLabelFromCode(statusJuridiqueCode: string | number | null | undefined) {
    if (statusJuridiqueCode === null || statusJuridiqueCode === undefined) {
        return null
    }

    const normalizedStatusJuridiqueCode = String(statusJuridiqueCode).trim()

    if (!normalizedStatusJuridiqueCode) {
        return null
    }

    return statusJuridiqueMap[normalizedStatusJuridiqueCode] ?? normalizedStatusJuridiqueCode
}

// Les listes sont fusionnées en conservant l'ordre d'arrivée, utile pour garder les customs du user.
export function mergeConventionCollectiveLists(...lists: ConventionCollectiveItem[][]) {
    const uniqueItems = new Map<string, ConventionCollectiveItem>()

    for (const list of lists) {
        for (const item of list) {
            uniqueItems.set(item.key, item)
        }
    }

    return [...uniqueItems.values()]
}

// Dès qu'une liste change, on vérifie que le choix préféré pointe encore vers une entrée valide.
export function resolveSelectedIdccKey(
    selections: ConventionCollectiveItem[],
    selectedIdccKey: string | null | undefined,
) {
    if (!selections.length) {
        return null
    }

    if (selectedIdccKey && selections.some((selection) => selection.key === selectedIdccKey)) {
        return selectedIdccKey
    }

    return selections[0].key
}

// Les réponses API renvoient l'objet sélectionné pour éviter au front de refaire une résolution locale.
export function getSelectedConventionCollective(
    selections: ConventionCollectiveItem[],
    selectedIdccKey: string | null | undefined,
) {
    const resolvedSelectedIdccKey = resolveSelectedIdccKey(selections, selectedIdccKey)

    if (!resolvedSelectedIdccKey) {
        return null
    }

    return selections.find((selection) => selection.key === resolvedSelectedIdccKey) ?? null
}
