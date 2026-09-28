/** Mémorise le dernier playbook choisi (confort de navigation, facultatif). */
const CLE = "playbook:courant";

export function lirePlaybookCourant(): string | null {
  try { return localStorage.getItem(CLE); } catch { return null; }
}

export function memoriserPlaybookCourant(id: string): void {
  try { localStorage.setItem(CLE, id); } catch { /* stockage indisponible : sans importance */ }
}
