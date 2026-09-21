import axios from "axios";

// Registre national des entreprises (INPI) : on n'en lit que le capital
// social, absent de la base SIRENE mais exigé dans la plupart des contrats
// (« SAS au capital de … € »). Identifiants du compte INPI dans le .env
// (INPI_USERNAME / INPI_PASSWORD) ; sans eux, la fonction est simplement
// désactivée.

const BASE = process.env.INPI_API_URL || "https://registre-national-entreprises.inpi.fr/api";

let jeton: { valeur: string; expire: number } | null = null;

async function obtenirJeton(): Promise<string | null> {
  const username = process.env.INPI_USERNAME;
  const password = process.env.INPI_PASSWORD;
  if (!username || !password) return null;
  if (jeton && jeton.expire > Date.now()) return jeton.valeur;
  const { data } = await axios.post(`${BASE}/sso/login`, { username, password }, { timeout: 10000 });
  if (!data?.token) return null;
  // Le jeton INPI est valable plusieurs heures ; on le renouvelle toutes les heures.
  jeton = { valeur: data.token, expire: Date.now() + 60 * 60 * 1000 };
  return jeton.valeur;
}

export function inpiConfigure(): boolean {
  return Boolean(process.env.INPI_USERNAME && process.env.INPI_PASSWORD);
}

/** « 10 000 € » à partir du montant et de la devise du registre. */
export function formaterCapital(montant: unknown, devise?: unknown): string | null {
  const n = typeof montant === "number" ? montant : Number(String(montant ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const texte = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n).replace(/\u202f|\u00a0/g, " ");
  const d = String(devise ?? "EUR").toUpperCase();
  return `${texte} ${d === "EUR" ? "€" : d}`;
}

export async function capitalSocial(siren: string): Promise<string | null> {
  if (!/^[0-9]{9}$/.test(siren)) return null;
  const token = await obtenirJeton();
  if (!token) return null;
  try {
    const { data } = await axios.get(`${BASE}/companies/${siren}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    const description = data?.formality?.content?.personneMorale?.identite?.description;
    return formaterCapital(description?.montantCapital, description?.deviseCapital);
  } catch (err) {
    // Jeton expiré ou refusé : on le jette, le prochain appel se reconnectera.
    if (axios.isAxiosError(err) && err.response?.status === 401) jeton = null;
    return null;
  }
}
