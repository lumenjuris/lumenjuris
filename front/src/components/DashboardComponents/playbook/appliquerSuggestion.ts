/**
 * Retrouve le passage cité par l'analyse playbook dans le texte du contrat.
 * Tolère les écarts d'espaces et d'apostrophes entre le texte extrait et la
 * citation de l'IA. Renvoie null si le passage est introuvable.
 */
export function localiserPassage(texte: string, passage: string): { debut: number; fin: number } | null {
  const citation = passage.trim();
  if (!citation) return null;
  const motif = Array.from(citation)
    .map((c) => {
      if (/\s/.test(c)) return "\\s+";
      if ("'’‘`".includes(c)) return "['’‘`]";
      return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("")
    .replace(/(\\s\+)+/g, "\\s+");
  const m = new RegExp(motif, "i").exec(texte);
  return m ? { debut: m.index, fin: m.index + m[0].length } : null;
}

/**
 * Remplace le passage cité par la nouvelle rédaction. Renvoie null si le
 * passage est introuvable (rien n'est alors modifié : l'utilisateur garde la main).
 */
export function appliquerSuggestion(texte: string, passage: string, remplacement: string): string | null {
  const pos = localiserPassage(texte, passage);
  if (!pos) return null;
  return texte.slice(0, pos.debut) + remplacement + texte.slice(pos.fin);
}
