/** Met un texte en minuscules et sans accents, pour une recherche tolérante. */
function normalizeForSearch(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Recherche "contient", insensible à la casse et aux accents (comme le faisait
 * MariaDB avec `contains`). Sert à filtrer en mémoire les champs chiffrés,
 * que la base ne peut plus filtrer elle-même.
 * Renvoie vrai si aucune recherche n'est demandée.
 */
export function includesText(value: string | null, search?: string): boolean {
    if (!search) return true
    if (!value) return false
    return normalizeForSearch(value).includes(normalizeForSearch(search))
}
