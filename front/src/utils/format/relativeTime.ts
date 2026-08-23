/**
 * Date relative courte et lisible : "Aujourd'hui", "Hier", ou "Il y a N j".
 * Accepte une chaîne ISO ou un objet Date.
 */
export function relativeTime(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Hier";
  return `Il y a ${d} j`;
}
