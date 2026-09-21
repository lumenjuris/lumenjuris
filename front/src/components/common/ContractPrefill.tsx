import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Phone, RotateCcw, Wand2, X } from "lucide-react";
import type { VariableDef } from "../../contractEngine/types";
import { useUserStore } from "../../store/userStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { CompanySearchField } from "./CompanySearchField";
import type { CompanyResult } from "../../types/companySearch";
import { fetchProxy } from "../../utils/fetchProxy";
import { mapCompanyToEnterprise } from "../../utils/companyLookup";
import {
  chercherEntreprise,
  trouverParties,
  valeurPourChamp,
  valeursDuProfil,
  valeursSirene,
  type GroupePartie,
  type Valeurs,
} from "./prefill";

/** "" = saisi ou validé par l'utilisateur ; "profil" = fiche ; "suggestion" = source externe. */
export type OrigineChamp = "" | "profil" | "suggestion";

interface Props {
  variables: VariableDef[];
  values: Record<string, string>;
  origins: Record<string, string>;
  setVar: (id: string, value: string, origin: OrigineChamp) => void;
  /** Amène le champ à l'écran dans le document. */
  onVoirChamp: (id: string) => void;
  /** Incrémenté par le bouton « Préremplir » de la barre d'outils. */
  demandeOuverture: number;
}

type Etape = "accueil" | "choix" | "fait";

/**
 * Panneau « Préremplir le contrat », visible dès l'arrivée dans l'éditeur.
 *
 * 1. L'utilisateur indique d'un clic quelle partie est sa société.
 * 2. Ses champs sont remplis avec ce que le CLM connaît (fiche entreprise,
 *    compte) ; ce qui manque est cherché dans SIRENE et proposé en suggestion.
 * 3. Pour l'autre partie : si son nom ou son numéro est déjà saisi, on la
 *    cherche dans SIRENE ; sinon une recherche est proposée.
 * 4. Un résumé indique ce qui est complété, suggéré ou manquant, et les
 *    suggestions se valident ou s'ignorent une à une.
 */
export function ContractPrefill({ variables, values, origins, setVar, onVoirChamp, demandeOuverture }: Props) {
  const userData = useUserStore((s) => s.userData);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const telephone = usePreferencesStore((s) => s.telephone);
  const setTelephone = usePreferencesStore((s) => s.setTelephone);

  const parties = useMemo(() => trouverParties(variables), [variables]);
  const [etape, setEtape] = useState<Etape>("accueil");
  const [maPartie, setMaPartie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [telSaisi, setTelSaisi] = useState("");
  // Société de l'utilisateur trouvée dans SIRENE alors que sa fiche est vide :
  // on lui propose, en un clic, de la garder pour les contrats suivants.
  const [aSauver, setASauver] = useState<{ result: CompanyResult; siret?: string } | null>(null);
  const [sauvegarde, setSauvegarde] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const profilVide = !userData?.enterprise?.name && !userData?.enterprise?.siren;

  useEffect(() => {
    if (demandeOuverture > 0 && etape === "accueil") demarrer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeOuverture]);

  const rempli = (id: string) => (values[id] ?? "").trim().length > 0;

  // ── Compteurs (toujours à jour : ils se lisent dans le document) ─────────
  const suggestions = variables.filter((v) => origins[v.id] === "suggestion" && rempli(v.id));
  const completes = variables.filter((v) => rempli(v.id) && origins[v.id] !== "suggestion").length;
  const manquants = variables.filter((v) => !rempli(v.id) && v.importance !== "optionnel");

  /**
   * Remplit les champs vides d'une partie. `dejaRemplis` évite qu'une
   * deuxième source écrase ce qu'une première vient d'écrire dans le même
   * passage (la fiche passe avant SIRENE).
   */
  function remplir(g: GroupePartie, valeurs: Valeurs, origine: OrigineChamp, dejaRemplis: Set<string>, ecraserSuggestions = false): number {
    let n = 0;
    for (const c of g.champs) {
      const occupe = dejaRemplis.has(c.id) || (rempli(c.id) && !(ecraserSuggestions && origins[c.id] === "suggestion"));
      if (occupe) continue;
      const v = valeurPourChamp(g, c, valeurs);
      if (!v) continue;
      setVar(c.id, v, origine);
      dejaRemplis.add(c.id);
      n += 1;
    }
    return n;
  }

  function demarrer() {
    setMessage(null);
    if (parties.length === 0) {
      setEtape("fait");
      setMessage("Aucune partie reconnue dans ce contrat : complétez les champs directement.");
      return;
    }
    setEtape("choix");
  }

  async function preremplir(prefixeMoi: string | null) {
    setMaPartie(prefixeMoi);
    setEnCours(true);
    setMessage(null);
    const dejaRemplis = new Set<string>();
    let depuisProfil = 0;
    let suggerees = 0;

    // Ma société : la fiche d'abord, SIRENE ensuite pour ce qui manque.
    const moi = parties.find((g) => g.prefixe === prefixeMoi);
    if (moi) {
      const profil = valeursDuProfil(userData, telephone);
      depuisProfil += remplir(moi, profil, "profil", dejaRemplis);
      // Fiche vide : on tente avec ce qui est déjà écrit dans le contrat. Si
      // rien, le panneau propose la recherche de la société.
      const requete =
        profil.siren ?? profil.denomination ??
        valeurDe(moi, "siret") ?? valeurDe(moi, "siren") ?? valeurDe(moi, "denomination");
      if (requete) {
        const trouve = await chercherEntreprise(requete);
        if (trouve) {
          suggerees += remplir(moi, valeursSirene(trouve.result, trouve.siret), "suggestion", dejaRemplis);
          if (profilVide) setASauver(trouve);
        }
      }
    }

    // Les autres parties : recherche automatique si une identité est déjà saisie.
    for (const g of parties.filter((p) => p.prefixe !== prefixeMoi)) {
      const identite =
        valeurDe(g, "siret") ?? valeurDe(g, "siren") ?? valeurDe(g, "denomination");
      if (!identite) continue;
      const trouve = await chercherEntreprise(identite);
      if (trouve) suggerees += remplir(g, valeursSirene(trouve.result, trouve.siret), "suggestion", dejaRemplis);
    }

    setEnCours(false);
    setEtape("fait");
    setMessage(
      depuisProfil + suggerees === 0
        ? "Rien à préremplir automatiquement : utilisez la recherche ci-dessous ou complétez les champs."
        : null,
    );
  }

  function valeurDe(g: GroupePartie, donnee: string): string | undefined {
    const c = g.champs.find((x) => x.donnee === donnee);
    const v = c ? (values[c.id] ?? "").trim() : "";
    return v || undefined;
  }

  function choisirEntreprise(g: GroupePartie) {
    return (result: CompanyResult, siret?: string) => {
      remplir(g, valeursSirene(result, siret), "suggestion", new Set(), true);
    };
  }

  /** L'utilisateur a trouvé SA société dans les suggestions (fiche vide). */
  function choisirMaSociete(result: CompanyResult, siret?: string) {
    const moi = parties.find((g) => g.prefixe === maPartie);
    if (moi) remplir(moi, valeursSirene(result, siret), "suggestion", new Set(), true);
    setASauver({ result, siret });
    setSauvegarde("idle");
  }

  /**
   * Un clic : la société rejoint la fiche de l'utilisateur, et ses champs dans
   * ce contrat passent de « suggéré » à validé (il vient de les confirmer).
   * On passe par l'aperçu serveur des données publiques, qui ajoute la
   * convention collective ; à défaut, on garde ce que SIRENE a renvoyé.
   */
  async function enregistrerSociete() {
    if (!aSauver) return;
    setSauvegarde("saving");
    try {
      const siren = aSauver.result.siren ?? "";
      const apercu = siren
        ? await fetchProxy(`/api/enterprise/insee/${encodeURIComponent(siren)}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : null;
      const detail = apercu?.success ? apercu.data : null;
      const src = detail ?? mapCompanyToEnterprise(aSauver.result, aSauver.siret);
      const res = await fetchProxy("/api/enterprise", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: src.name,
          siren: src.siren,
          codeNaf: src.codeNaf,
          intituleNaf: src.intituleNaf,
          statusJuridiqueCode: src.statusJuridiqueCode,
          statusJuridique: src.statusJuridique,
          address: src.address?.address ?? "",
          codePostal: src.address?.codePostal ?? "",
          pays: src.address?.pays ?? "France",
          idccSelections: detail?.idccSelections ?? [],
          selectedIdccKey: detail?.selectedIdccKey ?? null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) throw new Error(String(res.status));
      const moi = parties.find((g) => g.prefixe === maPartie);
      for (const c of moi?.champs ?? []) {
        if (origins[c.id] === "suggestion" && rempli(c.id)) setVar(c.id, values[c.id] ?? "", "profil");
      }
      setSauvegarde("saved");
      void fetchUser();
    } catch {
      setSauvegarde("error");
    }
  }

  async function enregistrerTelephone() {
    const tel = telSaisi.trim();
    if (!tel) return;
    const ok = await setTelephone(tel);
    const moi = parties.find((g) => g.prefixe === maPartie);
    const champ = moi?.champs.find((c) => c.donnee === "telephone");
    if (champ && !rempli(champ.id)) setVar(champ.id, tel, "profil");
    setTelSaisi("");
    if (!ok) setMessage("Le téléphone a été ajouté au contrat, mais n'a pas pu être mémorisé dans votre profil.");
  }

  const toutValider = () => suggestions.forEach((v) => setVar(v.id, values[v.id] ?? "", ""));

  // ── Rendu ────────────────────────────────────────────────────────────────
  const autres = parties.filter((g) => g.prefixe !== maPartie);
  const maGroupe = parties.find((g) => g.prefixe === maPartie);
  const demandeTelephone =
    etape === "fait" && !telephone && !!maGroupe?.champs.some((c) => c.donnee === "telephone" && !rempli(c.id));
  // Fiche vide et société pas encore trouvée : on la cherche ici même, sans
  // envoyer l'utilisateur dans Mon compte (il veut tester le contrat).
  const chercherMaSociete = etape === "fait" && !!maGroupe && profilVide && !aSauver && sauvegarde !== "saved";

  return (
    <div className="space-y-3 rounded-2xl border border-brand/25 bg-white p-4 shadow-card">
      {etape === "accueil" && (
        <>
          <button
            type="button"
            onClick={demarrer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <Wand2 className="h-4 w-4" /> Préremplir le contrat
          </button>
          <p className="text-xs leading-snug text-ink-muted">
            Vos informations et celles de l'autre partie, en un clic. Vous validez tout.
          </p>
        </>
      )}

      {etape === "choix" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Quelle partie est votre société ?</p>
          {parties.map((g) => (
            <button
              key={g.prefixe || "partie"}
              type="button"
              disabled={enCours}
              onClick={() => void preremplir(g.prefixe)}
              className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-sm text-ink transition hover:border-brand/40 hover:bg-brand-light disabled:opacity-50"
            >
              {g.libelle}
              {enCours && maPartie === g.prefixe && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
            </button>
          ))}
          <button
            type="button"
            disabled={enCours}
            onClick={() => void preremplir(null)}
            className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-muted hover:bg-surface-subtle disabled:opacity-50"
          >
            Aucune : je rédige pour des tiers
          </button>
        </div>
      )}

      {etape === "fait" && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Préremplissage</p>
            <button
              type="button"
              onClick={() => { setEtape(parties.length ? "choix" : "accueil"); setMessage(null); }}
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-brand"
            >
              <RotateCcw className="h-3 w-3" /> Recommencer
            </button>
          </div>

          {/* Résumé simple, recalculé en continu */}
          <p className="text-xs leading-relaxed text-ink-secondary">
            <span className="font-semibold text-ink">{completes}</span> champ{completes > 1 ? "s" : ""} complété{completes > 1 ? "s" : ""}
            {" · "}
            <span className="font-semibold text-violet-700">{suggestions.length}</span> suggestion{suggestions.length > 1 ? "s" : ""}
            {" · "}
            <span className="font-semibold text-amber-700">{manquants.length}</span> information{manquants.length > 1 ? "s" : ""} manquante{manquants.length > 1 ? "s" : ""}
          </p>

          {message && <p className="text-xs text-ink-muted">{message}</p>}

          {chercherMaSociete && maGroupe && (
            <CompanySearchField
              label={`Votre société (${maGroupe.libelle.toLowerCase()})`}
              hint="Nom, SIREN ou SIRET : ses informations publiques remplissent vos champs."
              onSelect={choisirMaSociete}
            />
          )}

          {/* Une seule question, un seul clic, juste après la suggestion. */}
          {aSauver && sauvegarde !== "saved" && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-light px-2.5 py-2">
              <p className="min-w-0 flex-1 text-xs leading-snug text-ink">
                Garder <span className="font-semibold">{aSauver.result.nom_complet ?? aSauver.result.nom_raison_sociale ?? "cette société"}</span> pour vos prochains contrats ?
              </p>
              <button
                type="button"
                onClick={() => void enregistrerSociete()}
                disabled={sauvegarde === "saving"}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {sauvegarde === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Oui
              </button>
              <button
                type="button"
                onClick={() => setASauver(null)}
                aria-label="Non merci"
                className="shrink-0 rounded-md px-1.5 py-1 text-xs text-ink-muted hover:bg-white"
              >
                Non
              </button>
            </div>
          )}
          {sauvegarde === "saved" && (
            <p className="flex items-center gap-1.5 text-xs text-success-dark">
              <Check className="h-3.5 w-3.5" /> Société enregistrée : elle sera préremplie la prochaine fois.
            </p>
          )}
          {sauvegarde === "error" && (
            <p className="text-xs text-danger">L'enregistrement a échoué. Réessayez, ou complétez Mon compte.</p>
          )}

          {demandeTelephone && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                <Phone className="h-3.5 w-3.5" /> Votre téléphone
              </label>
              <div className="flex gap-1.5">
                <input
                  value={telSaisi}
                  onChange={(e) => setTelSaisi(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void enregistrerTelephone(); }}
                  placeholder="01 23 45 67 89"
                  className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-brand/40"
                />
                <button
                  type="button"
                  onClick={() => void enregistrerTelephone()}
                  disabled={!telSaisi.trim()}
                  className="rounded-lg bg-brand px-2.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-40"
                >
                  OK
                </button>
              </div>
              <p className="text-[10px] text-ink-subtle">Mémorisé dans votre profil pour les prochains contrats.</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">À valider</p>
                <button type="button" onClick={toutValider} className="text-[11px] font-medium text-violet-700 hover:underline">
                  Tout valider
                </button>
              </div>
              <ul className="space-y-1">
                {suggestions.map((v) => (
                  <li key={v.id} className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1.5">
                    <button type="button" onClick={() => onVoirChamp(v.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[10px] text-violet-700">{v.label}</span>
                      <span className="block truncate text-xs font-medium text-ink">{values[v.id]}</span>
                    </button>
                    <button type="button" aria-label={`Valider ${v.label}`} onClick={() => setVar(v.id, values[v.id] ?? "", "")} className="rounded p-1 text-emerald-700 hover:bg-emerald-100">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={`Ignorer ${v.label}`} onClick={() => setVar(v.id, "", "")} className="rounded p-1 text-ink-muted hover:bg-surface-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-snug text-ink-subtle">
                Trouvées dans la base officielle des entreprises (SIRENE). Modifier un champ vaut validation.
              </p>
            </div>
          )}

          {/* Recherche de l'autre partie quand elle n'a pas pu être trouvée seule */}
          {autres.map((g) => (
            <CompanySearchField
              key={g.prefixe || "partie"}
              label={`Rechercher ${g.libelle.toLowerCase()}`}
              hint="Nom ou SIRET : ses informations arrivent en suggestions à valider."
              onSelect={choisirEntreprise(g)}
            />
          ))}

          {manquants.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Manquant</p>
              <ul className="flex flex-wrap gap-1">
                {manquants.slice(0, 8).map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => onVoirChamp(v.id)} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100">
                      {v.label}
                    </button>
                  </li>
                ))}
                {manquants.length > 8 && (
                  <li className="px-1 py-0.5 text-[11px] text-ink-subtle">+{manquants.length - 8}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
