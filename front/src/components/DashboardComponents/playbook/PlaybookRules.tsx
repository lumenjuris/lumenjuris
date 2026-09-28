import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ListChecks, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { playbookApi } from "./api";
import { RuleEditor } from "./RuleEditor";
import { PLAYBOOK_CATEGORIES, RULE_TYPE_LABEL, SEVERITY_LABEL, SEVERITY_STYLE } from "./types";
import type { PlaybookInfo, PlaybookRule } from "./types";
import { lirePlaybookCourant, memoriserPlaybookCourant } from "./playbookCourant";
import { useUserStore } from "../../../store/userStore";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { BannerAction, PageBanner } from "../../common/PageBanner";

const normaliser = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Page « Playbook » : les règles de négociation internes. Même habillage que la
 * bibliothèque de clauses, en liste compacte (une ligne par règle).
 */
export function PlaybookRules() {
  const role = useUserStore((s) => s.userData?.profile?.role);
  const canEdit = role === "ADMIN" || role === "JURISTE" || role === "USER";

  const [playbooks, setPlaybooks] = useState<PlaybookInfo[]>([]);
  const [courant, setCourant] = useState<string | null>(null);
  const [aSupprimerPb, setASupprimerPb] = useState<PlaybookInfo | null>(null);
  const [rules, setRules] = useState<PlaybookRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PlaybookRule | null | "new">(null);
  const [aSupprimer, setASupprimer] = useState<PlaybookRule | null>(null);

  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [seulementActives, setSeulementActives] = useState(false);

  /** Liste des playbooks ; garde le playbook choisi s'il existe encore, sinon le principal. */
  const chargerPlaybooks = useCallback(async (choisir?: string) => {
    try {
      const liste = await playbookApi.playbooks();
      setPlaybooks(liste);
      const voulu = choisir ?? lirePlaybookCourant();
      const retenu = liste.find((p) => p.id === voulu) ?? liste.find((p) => p.isDefault) ?? liste[0];
      if (retenu) { setCourant(retenu.id); memoriserPlaybookCourant(retenu.id); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setLoading(false);
    }
  }, []);

  const charger = useCallback(async () => {
    if (!courant) return;
    setLoading(true); setError("");
    try { setRules(await playbookApi.list(courant)); }
    catch (e) { setError(e instanceof Error ? e.message : "Erreur réseau"); }
    finally { setLoading(false); }
  }, [courant]);

  useEffect(() => { void chargerPlaybooks(); }, [chargerPlaybooks]);
  useEffect(() => { void charger(); }, [charger]);

  function choisirPlaybook(id: string) {
    setCourant(id);
    memoriserPlaybookCourant(id);
  }

  async function creerPlaybook(nom: string) {
    try {
      const p = await playbookApi.createPlaybook(nom);
      await chargerPlaybooks(p.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Création impossible"); }
  }

  async function renommerPlaybook(p: PlaybookInfo, nom: string) {
    setPlaybooks((l) => l.map((x) => (x.id === p.id ? { ...x, name: nom } : x)));
    try { await playbookApi.renamePlaybook(p.id, nom); }
    catch (e) { setError(e instanceof Error ? e.message : "Renommage impossible"); void chargerPlaybooks(); }
  }

  async function supprimerPlaybook() {
    const p = aSupprimerPb;
    setASupprimerPb(null);
    if (!p) return;
    try { await playbookApi.removePlaybook(p.id); await chargerPlaybooks(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible"); }
  }

  const visibles = useMemo(() => {
    const n = normaliser(search.trim());
    return rules.filter((r) =>
      (!categorie || r.category === categorie) &&
      (!seulementActives || r.isActive) &&
      (!n || normaliser(`${r.name} ${r.expectedValue ?? ""} ${r.suggestion ?? ""}`).includes(n)),
    );
  }, [rules, search, categorie, seulementActives]);

  const parCategorie = useMemo(() => {
    const m = new Map<string, PlaybookRule[]>();
    for (const r of visibles) m.set(r.category, [...(m.get(r.category) ?? []), r]);
    return Array.from(m.entries());
  }, [visibles]);

  const categoriesFiltre = useMemo(
    () => Array.from(new Set([...PLAYBOOK_CATEGORIES, ...rules.map((r) => r.category)])),
    [rules],
  );

  async function basculer(r: PlaybookRule) {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !x.isActive } : x)));
    try { await playbookApi.update(r.id, { name: r.name, isActive: !r.isActive }); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec"); void charger(); }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    const r = aSupprimer;
    setASupprimer(null);
    setRules((prev) => prev.filter((x) => x.id !== r.id));
    try { await playbookApi.remove(r.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); void charger(); }
  }

  const actives = rules.filter((r) => r.isActive).length;
  const filtreActif = !!(search.trim() || categorie || seulementActives);

  return (
    <div className="space-y-4 mx-auto w-full max-w-7xl">
      <PageBanner
        compact
        title="Playbook"
        subtitle="Vos règles de négociation : chaque contrat analysé est comparé à vos positions habituelles."
        actions={canEdit && (
          <BannerAction onClick={() => setEditing("new")} icon={<Plus />}>Nouvelle règle</BannerAction>
        )}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-2.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <PlaybookTabs
        playbooks={playbooks}
        courant={courant}
        canEdit={canEdit}
        onChoisir={choisirPlaybook}
        onCreer={(nom) => void creerPlaybook(nom)}
        onRenommer={(p, nom) => void renommerPlaybook(p, nom)}
        onSupprimer={setASupprimerPb}
      />

      {/* Filtres + compteurs sur une seule ligne */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une règle…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
          />
        </div>
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          className="bg-white border border-line px-3 py-2 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer shadow-card"
        >
          <option value="">Toutes les catégories</option>
          {categoriesFiltre.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setSeulementActives((v) => !v)}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all shadow-card border ${
            seulementActives
              ? "bg-success-light text-success-dark border-success/30"
              : "bg-white text-ink-secondary border-line hover:bg-surface-subtle"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Actives
        </button>
        {!loading && rules.length > 0 && (
          <span className="text-xs text-ink-muted md:ml-1 whitespace-nowrap">
            {rules.length} règle{rules.length > 1 ? "s" : ""} · {actives} active{actives > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Liste compacte */}
      {loading ? (
        <div className="bg-white rounded-card border border-line shadow-card divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 animate-pulse bg-surface-subtle/50" />)}
        </div>
      ) : visibles.length === 0 ? (
        <div className="flex items-center justify-between gap-4 bg-white rounded-card border border-line shadow-card px-4 py-4">
          <div className="flex items-center gap-3">
            <ListChecks className="w-5 h-5 text-ink-subtle stroke-[1.5]" />
            <div>
              <p className="text-sm font-semibold text-ink">{filtreActif ? "Aucune règle ne correspond" : "Aucune règle"}</p>
              <p className="text-xs text-ink-muted">
                {filtreActif ? "Modifiez la recherche ou les filtres." : "Exemple : « Paiement à 30 jours maximum », « Commission minimum 15 % »."}
              </p>
            </div>
          </div>
          {canEdit && !filtreActif && (
            <button onClick={() => setEditing("new")} className="flex shrink-0 items-center gap-2 px-3 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all">
              <Plus className="w-4 h-4" /> Nouvelle règle
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
          {parCategorie.map(([cat, liste]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 bg-surface-subtle px-4 py-1.5 border-b border-line">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary">{cat}</h2>
                <span className="text-[10px] font-semibold text-white bg-blue-primary px-1.5 py-0.5 rounded-chip">{liste.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {liste.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    canEdit={canEdit}
                    onToggle={() => void basculer(r)}
                    onEdit={() => setEditing(r)}
                    onDelete={() => setASupprimer(r)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <RuleEditor
          rule={editing === "new" ? null : editing}
          playbookId={courant ?? undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void charger(); void chargerPlaybooks(courant ?? undefined); }}
        />
      )}
      <ConfirmationModal
        open={aSupprimer !== null}
        title="Supprimer la règle"
        description={`Souhaitez-vous supprimer la règle « ${aSupprimer?.name ?? ""} » ?`}
        confirmLabel="Valider"
        onConfirm={() => void supprimer()}
        onCancel={() => setASupprimer(null)}
      />
      <ConfirmationModal
        open={aSupprimerPb !== null}
        title="Supprimer le playbook"
        description={`Supprimer « ${aSupprimerPb?.name ?? ""} » et ses ${aSupprimerPb?.ruleCount ?? 0} règle(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={() => void supprimerPlaybook()}
        onCancel={() => setASupprimerPb(null)}
      />
    </div>
  );
}

/**
 * Onglets des playbooks (« Mes règles », « Contrats artistes », « NDA »…) :
 * un clic pour changer, « Nouveau playbook » pour en créer, crayon / corbeille
 * sur l'onglet actif (le playbook principal ne se supprime pas).
 */
function PlaybookTabs({
  playbooks, courant, canEdit, onChoisir, onCreer, onRenommer, onSupprimer,
}: {
  playbooks: PlaybookInfo[];
  courant: string | null;
  canEdit: boolean;
  onChoisir: (id: string) => void;
  onCreer: (nom: string) => void;
  onRenommer: (p: PlaybookInfo, nom: string) => void;
  onSupprimer: (p: PlaybookInfo) => void;
}) {
  const [saisie, setSaisie] = useState<{ mode: "creer" | "renommer"; valeur: string } | null>(null);
  const actif = playbooks.find((p) => p.id === courant);

  function valider() {
    const nom = saisie?.valeur.trim();
    if (nom && saisie?.mode === "creer") onCreer(nom);
    if (nom && saisie?.mode === "renommer" && actif) onRenommer(actif, nom);
    setSaisie(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {playbooks.map((p) => {
        const estActif = p.id === courant;
        if (estActif && saisie?.mode === "renommer") return null;
        return (
          <button
            key={p.id}
            onClick={() => onChoisir(p.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-all ${
              estActif ? "border-brand bg-brand text-white font-semibold" : "border-line bg-white text-ink-secondary hover:bg-surface-subtle"
            }`}
          >
            {p.name}
            <span className={`text-[10px] font-semibold ${estActif ? "text-white/80" : "text-ink-subtle"}`}>{p.activeCount}</span>
          </button>
        );
      })}

      {saisie ? (
        <form onSubmit={(e) => { e.preventDefault(); valider(); }} className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={saisie.valeur}
            onChange={(e) => setSaisie({ ...saisie, valeur: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Escape") setSaisie(null); }}
            placeholder="ex. Contrats artistes"
            className="w-48 rounded-xl border border-brand/40 bg-white px-3 py-1.5 text-sm text-ink outline-none shadow-ring-brand"
          />
          <button type="submit" title="Valider" className="rounded-lg p-1.5 text-brand hover:bg-brand-light"><Check className="h-4 w-4" /></button>
          <button type="button" title="Annuler" onClick={() => setSaisie(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle"><X className="h-4 w-4" /></button>
        </form>
      ) : canEdit && (
        <>
          <button
            onClick={() => setSaisie({ mode: "creer", valeur: "" })}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-line px-3 py-1.5 text-sm text-ink-muted hover:border-brand/40 hover:text-brand"
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau playbook
          </button>
          {actif && (
            <span className="ml-auto inline-flex items-center gap-0.5">
              <button onClick={() => setSaisie({ mode: "renommer", valeur: actif.name })} title="Renommer ce playbook" className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-brand">
                <Pencil className="h-4 w-4" />
              </button>
              {!actif.isDefault && (
                <button onClick={() => onSupprimer(actif)} title="Supprimer ce playbook" className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger-dark">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Une règle sur une ligne : nom, importance, type, valeur, puis actions. */
function RuleRow({
  rule, canEdit, onToggle, onEdit, onDelete,
}: {
  rule: PlaybookRule;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-subtle/60 transition-colors ${rule.isActive ? "" : "opacity-55"}`}>
      <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold text-ink md:w-72 md:shrink-0 truncate" title={rule.name}>{rule.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip tracking-wide ${SEVERITY_STYLE[rule.severity]}`}>
            {SEVERITY_LABEL[rule.severity].toUpperCase()}
          </span>
          <span className="text-[9px] font-semibold text-brand bg-brand-light px-1.5 py-0.5 rounded-chip whitespace-nowrap">{RULE_TYPE_LABEL[rule.ruleType]}</span>
        </div>
        {rule.expectedValue && (
          <span className="min-w-0 truncate text-sm text-ink-secondary" title={rule.expectedValue}>{rule.expectedValue}</span>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={rule.isActive}
            title={rule.isActive ? "Désactiver" : "Activer"}
            onClick={onToggle}
            className={`relative mr-1 h-5 w-9 rounded-full transition-colors ${rule.isActive ? "bg-brand" : "bg-line-emphasis"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${rule.isActive ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <button onClick={onEdit} title="Modifier" className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-brand transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Supprimer" className="p-1.5 rounded-lg text-ink-muted hover:bg-danger-light hover:text-danger-dark transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </li>
  );
}
