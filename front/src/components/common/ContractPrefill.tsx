import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, Pencil, RotateCcw, Wand2 } from "lucide-react";
import type { VariableDef } from "../../contractEngine/types";
import { useUserStore } from "../../store/userStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { CompanySearchField } from "./CompanySearchField";
import type { CompanyResult } from "../../types/companySearch";
import { fetchProxy } from "../../utils/fetchProxy";
import { mapCompanyToEnterprise } from "../../utils/companyLookup";
import {
  chercherCapital,
  chercherEntreprise,
  estFermee,
  trouverParties,
  valeurPourChamp,
  valeursDuProfil,
  valeursSirene,
  villeDeLAdresse,
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
type Trouvee = { result: CompanyResult; siret?: string };

/**
 * Panneau « Préremplir » : une carte par partie, un clic par société.
 *
 * 1. L'utilisateur indique d'un clic quelle partie est sa société.
 * 2. Ses champs viennent de sa fiche ; sinon sa société est cherchée dans le
 *    registre officiel (SIRENE), à partir de ce que dit déjà le contrat.
 * 3. L'autre partie est cherchée de même, ou via une recherche par nom.
 * 4. Un « Oui » confirme la société entière (le risque est de se tromper de
 *    société, pas d'adresse). Pour sa propre société, ce même clic la garde
 *    pour les prochains contrats.
 *
 * Téléphone, e-mail, IBAN de l'autre partie ne figurent dans aucune source
 * officielle : ils restent des champs à compléter, rien n'est inventé.
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
  const [trouvees, setTrouvees] = useState<Record<string, Trouvee>>({});
  const [confirmees, setConfirmees] = useState<Set<string>>(new Set());
  const [enRecherche, setEnRecherche] = useState<Set<string>>(new Set());
  const [sauvegarde, setSauvegarde] = useState<"idle" | "saving" | "error">("idle");
  const prochainManquant = useRef(0);

  const profilVide = !userData?.enterprise?.name && !userData?.enterprise?.siren;

  useEffect(() => {
    if (demandeOuverture > 0 && etape === "accueil") demarrer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeOuverture]);

  const rempli = (id: string) => (values[id] ?? "").trim().length > 0;
  const manquants = variables.filter((v) => !rempli(v.id) && v.importance !== "optionnel");
  const maGroupe = parties.find((g) => g.prefixe === maPartie);

  // Téléphone tapé une fois dans sa propre partie : gardé en mémoire, sans
  // question, pour les contrats suivants (seulement s'il n'y en avait pas).
  const champTel = maGroupe?.champs.find((c) => c.donnee === "telephone");
  const telTape = champTel && origins[champTel.id] === "" ? (values[champTel.id] ?? "").trim() : "";
  useEffect(() => {
    if (telephone || telTape.replace(/\D/g, "").length < 10) return;
    const t = window.setTimeout(() => void setTelephone(telTape), 1500);
    return () => window.clearTimeout(t);
  }, [telTape, telephone, setTelephone]);

  /**
   * Remplit les champs vides d'une partie. `dejaRemplis` évite qu'une
   * deuxième source écrase ce qu'une première vient d'écrire dans le même
   * passage (la fiche passe avant SIRENE).
   */
  function remplir(g: GroupePartie, valeurs: Valeurs, origine: OrigineChamp, dejaRemplis: Set<string>, ecraserSuggestions = false) {
    for (const c of g.champs) {
      const occupe = dejaRemplis.has(c.id) || (rempli(c.id) && !(ecraserSuggestions && origins[c.id] === "suggestion"));
      if (occupe) continue;
      const v = valeurPourChamp(g, c, valeurs);
      if (!v) continue;
      setVar(c.id, v, origine);
      dejaRemplis.add(c.id);
    }
  }

  /** Capital social (registre INPI) : arrive après coup, s'il est connu. */
  async function ajouterCapital(g: GroupePartie, siren: string | null | undefined, origine: OrigineChamp) {
    const champ = g.champs.find((c) => c.donnee === "capital");
    if (!champ || rempli(champ.id)) return;
    const capital = await chercherCapital(siren);
    if (capital) setVar(champ.id, capital, origine);
  }

  function demarrer() {
    setEtape(parties.length === 0 ? "fait" : "choix");
  }

  function recommencer() {
    setEtape(parties.length ? "choix" : "accueil");
    setTrouvees({});
    setConfirmees(new Set());
    setEnRecherche(new Set());
    setSauvegarde("idle");
  }

  function valeurDe(g: GroupePartie, donnee: string): string | undefined {
    const c = g.champs.find((x) => x.donnee === donnee);
    const v = c ? (values[c.id] ?? "").trim() : "";
    return v || undefined;
  }

  async function preremplir(prefixeMoi: string | null) {
    setMaPartie(prefixeMoi);
    setEnCours(true);
    const dejaRemplis = new Set<string>();
    const nouvelles: Record<string, Trouvee> = {};

    // Ma société : la fiche d'abord, le registre ensuite pour ce qui manque.
    const moi = parties.find((g) => g.prefixe === prefixeMoi);
    if (moi) {
      const profil = valeursDuProfil(userData, telephone);
      remplir(moi, profil, "profil", dejaRemplis);
      if (!profilVide) void ajouterCapital(moi, userData?.enterprise?.siren, "profil");
      const requete =
        profil.siren ?? profil.denomination ??
        valeurDe(moi, "siret") ?? valeurDe(moi, "siren") ?? valeurDe(moi, "denomination");
      if (requete) {
        const trouve = await chercherEntreprise(requete);
        if (trouve) {
          remplir(moi, valeursSirene(trouve.result, trouve.siret), profilVide ? "suggestion" : "profil", dejaRemplis);
          if (profilVide) {
            nouvelles[moi.prefixe] = trouve;
            void ajouterCapital(moi, trouve.result.siren, "suggestion");
          }
        }
      }
    }

    // Les autres parties : recherche automatique si une identité est déjà saisie.
    for (const g of parties.filter((p) => p.prefixe !== prefixeMoi)) {
      const identite = valeurDe(g, "siret") ?? valeurDe(g, "siren") ?? valeurDe(g, "denomination");
      if (!identite) continue;
      const trouve = await chercherEntreprise(identite);
      if (!trouve) continue;
      remplir(g, valeursSirene(trouve.result, trouve.siret), "suggestion", dejaRemplis);
      nouvelles[g.prefixe] = trouve;
      void ajouterCapital(g, trouve.result.siren, "suggestion");
    }

    setTrouvees(nouvelles);
    setEnCours(false);
    setEtape("fait");
  }

  /** Société choisie dans la recherche : elle remplace ce qui était suggéré. */
  function choisir(g: GroupePartie) {
    return (result: CompanyResult, siret?: string) => {
      remplir(g, valeursSirene(result, siret), "suggestion", new Set(), true);
      void ajouterCapital(g, result.siren, "suggestion");
      setTrouvees((t) => ({ ...t, [g.prefixe]: { result, siret } }));
      setEnRecherche((s) => { const n = new Set(s); n.delete(g.prefixe); return n; });
      setConfirmees((s) => { const n = new Set(s); n.delete(g.prefixe); return n; });
    };
  }

  /**
   * « Oui » : les champs suggérés de la partie deviennent validés. Pour sa
   * propre société sans fiche, le même clic l'enregistre dans son profil.
   */
  async function confirmer(g: GroupePartie) {
    const estMoi = g.prefixe === maPartie;
    if (estMoi && profilVide && trouvees[g.prefixe]) {
      setSauvegarde("saving");
      const ok = await enregistrerSociete(trouvees[g.prefixe]);
      setSauvegarde(ok ? "idle" : "error");
      if (!ok) return;
    }
    for (const c of g.champs) {
      if (origins[c.id] === "suggestion" && rempli(c.id)) setVar(c.id, values[c.id] ?? "", estMoi ? "profil" : "");
    }
    setConfirmees((s) => new Set(s).add(g.prefixe));
  }

  /**
   * Enregistre la société dans la fiche de l'utilisateur. On passe par
   * l'aperçu serveur des données publiques, qui ajoute la convention
   * collective ; à défaut, on garde ce que SIRENE a renvoyé.
   */
  async function enregistrerSociete(t: Trouvee): Promise<boolean> {
    try {
      const siren = t.result.siren ?? "";
      const apercu = siren
        ? await fetchProxy(`/api/enterprise/insee/${encodeURIComponent(siren)}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : null;
      const detail = apercu?.success ? apercu.data : null;
      const src = detail ?? mapCompanyToEnterprise(t.result, t.siret);
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
      if (!res.ok || !payload?.success) return false;
      void fetchUser();
      return true;
    } catch {
      return false;
    }
  }

  /** « → » : amène au champ manquant suivant, en boucle. */
  function allerAuManquant() {
    if (manquants.length === 0) return;
    const i = prochainManquant.current % manquants.length;
    prochainManquant.current = i + 1;
    onVoirChamp(manquants[i].id);
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  const ordre = maGroupe ? [maGroupe, ...parties.filter((g) => g !== maGroupe)] : parties;

  return (
    <div className="space-y-2.5 rounded-2xl border border-brand/25 bg-white p-3 shadow-card">
      {etape === "accueil" && (
        <button
          type="button"
          onClick={demarrer}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
        >
          <Wand2 className="h-4 w-4" /> Préremplir le contrat
        </button>
      )}

      {etape === "choix" && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">Votre société ?</p>
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
            Aucune
          </button>
        </div>
      )}

      {etape === "fait" && (
        <>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Wand2 className="h-3.5 w-3.5 text-brand" /> Préremplir
            </p>
            {parties.length > 0 && (
              <button type="button" onClick={recommencer} aria-label="Recommencer" title="Recommencer" className="rounded p-1 text-ink-muted hover:bg-surface-subtle hover:text-brand">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {ordre.length > 0 && (
            <div className="divide-y divide-line rounded-xl border border-line">
              {ordre.map((g) => (
                <CartePartie
                  key={g.prefixe || "partie"}
                  titre={g === maGroupe ? "Vous" : g.libelle.replace(/^(L'|Le |La |Les )/, "")}
                  trouvee={trouvees[g.prefixe]}
                  // Sa société déjà dans sa fiche : rien à confirmer.
                  depuisFiche={g === maGroupe && !profilVide}
                  nomFiche={userData?.enterprise?.name ?? null}
                  villeFiche={villeDeLAdresse(userData?.enterprise?.address?.address)}
                  confirmee={confirmees.has(g.prefixe)}
                  aConfirmer={g.champs.some((c) => origins[c.id] === "suggestion" && rempli(c.id))}
                  enRecherche={enRecherche.has(g.prefixe) || (!trouvees[g.prefixe] && !(g === maGroupe && !profilVide))}
                  enregistrement={g === maGroupe ? sauvegarde : "idle"}
                  titreOui={g === maGroupe ? "C'est bien votre société : elle sera gardée pour vos prochains contrats" : "C'est bien cette société"}
                  onOui={() => void confirmer(g)}
                  onChanger={() => setEnRecherche((s) => new Set(s).add(g.prefixe))}
                  onChoisir={choisir(g)}
                />
              ))}
            </div>
          )}

          {manquants.length > 0 ? (
            <button
              type="button"
              onClick={allerAuManquant}
              className="flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
            >
              {manquants.length} champ{manquants.length > 1 ? "s" : ""} à compléter
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-success-dark">
              <Check className="h-3.5 w-3.5" /> Tout est complété
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Une partie : sa société trouvée (un clic pour confirmer) ou une recherche. */
function CartePartie({
  titre, trouvee, depuisFiche, nomFiche, villeFiche, confirmee, aConfirmer, enRecherche, enregistrement, titreOui, onOui, onChanger, onChoisir,
}: {
  titre: string;
  trouvee?: Trouvee;
  depuisFiche: boolean;
  nomFiche: string | null;
  villeFiche: string | null;
  confirmee: boolean;
  aConfirmer: boolean;
  enRecherche: boolean;
  enregistrement: "idle" | "saving" | "error";
  /** Infobulle du « Oui » (sa société : elle est aussi gardée pour la suite). */
  titreOui: string;
  onOui: () => void;
  onChanger: () => void;
  onChoisir: (result: CompanyResult, siret?: string) => void;
}) {
  const r = trouvee?.result;
  const nom = r ? (r.nom_complet ?? r.nom_raison_sociale ?? "") : (nomFiche ?? "");
  const ville = r ? villeDeLAdresse(r.siege?.adresse) ?? r.siege?.libelle_commune ?? "" : (villeFiche ?? "");
  const fermee = r ? estFermee(r) : false;

  return (
    <div className="flex items-start gap-2 px-3 py-2.5">
      <span className="w-12 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{titre}</span>
      <div className="min-w-0 flex-1">
        {enRecherche ? (
          <CompanySearchField label="" hint="" placeholder="Nom ou SIRET" onSelect={onChoisir} />
        ) : (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{nom}</p>
              {ville && <p className="truncate text-[11px] text-ink-muted">{ville}</p>}
              {fermee && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
                  <AlertTriangle className="h-3 w-3" /> Société fermée
                </p>
              )}
              {enregistrement === "error" && <p className="text-[11px] text-danger">Échec, réessayez.</p>}
            </div>
            {depuisFiche || confirmee || !aConfirmer ? (
              <Check aria-label="Confirmée" className="h-4 w-4 shrink-0 text-brand" />
            ) : (
              <button
                type="button"
                onClick={onOui}
                title={titreOui}
                disabled={enregistrement === "saving"}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {enregistrement === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Oui
              </button>
            )}
            {!depuisFiche && (
              <button type="button" onClick={onChanger} aria-label="Changer de société" title="Changer de société" className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-subtle hover:text-brand">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
