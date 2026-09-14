import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import { useUserStore } from "../../../store/userStore";
import { WatchConfig, domainLabel } from "./legalWatchShared";
import { ExternalLink } from "lucide-react";
import { Button } from "@base-ui/react";
import { LegalConceptModal } from "../../ui/LegalConceptModal";
import { AlertBanner } from "../../common/AlertBanner";

/**
 * Onglet « Paramètres » : rend le fonctionnement transparent et donne le
 * contrôle. On voit QUELLES sources sont interrogées, QUELS thèmes juridiques
 * sont surveillés, et on peut les activer/désactiver (réservé aux éditeurs).
 */

// ── Présentation des sources (le back ne renvoie que name/isActive/lastRunAt) ──

const SOURCE_META: Record<string, { label: string; url: string }> = {
  judilibre: { label: "Cour de cassation", url: "https://www.courdecassation.fr" },
  legifrance: { label: "Légifrance", url: "https://www.legifrance.gouv.fr" },
  convention_collective: { label: "Conventions collectives", url: "https://www.legifrance.gouv.fr" },
};

/** Affiche l'URL sans protocole ni www (ex. "courdecassation.fr"). */
function siteLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

// ── Interrupteur simple ───────────────────────────────────────────────────────

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-lumenjuris" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-1"
        }`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(3px)" }}
      />
    </button>
  );
}

export function LegalWatchSettings() {
  const [config, setConfig] = useState<WatchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [legalConceptName, setLegalConceptName] = useState("");
  const [isAlertError, setIsAlertError] = useState(false);
  const [isAlertSuccess, setIsAlertSuccess] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const role = useUserStore((s) => s.userData?.profile?.role);
  const canEdit = role === "ADMIN" || role === "JURISTE";

  const toggleExpanded = (domain: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProxy("/api/legal-watch/config", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { success: boolean; data?: WatchConfig };
      if (payload.success && payload.data) setConfig(payload.data);
    } catch {
      setError("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSource = async (name: string, isActive: boolean) => {
    if (!config) return;
    const previous = config;
    setConfig({ ...config, sources: config.sources.map((s) => (s.name === name ? { ...s, isActive } : s)) });
    try {
      const res = await fetchProxy(`/api/legal-watch/sources/${encodeURIComponent(name)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setConfig(previous);
      setError("Modification non enregistrée. Réessayez.");
    }
  };

  const patchConcept = (concept: string, isActive: boolean) =>
    fetchProxy(`/api/legal-watch/concepts/${encodeURIComponent(concept)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });

  const toggleConcept = async (concept: string, isActive: boolean) => {
    if (!config) return;
    const previous = config;
    setConfig({
      ...config,
      concepts: config.concepts.map((c) => (c.concept === concept ? { ...c, isActive } : c)),
    });
    try {
      await patchConcept(concept, isActive);
    } catch {
      setConfig(previous);
      setError("Modification non enregistrée. Réessayez.");
    }
  };

  /** Active/désactive d'un coup tous les concepts d'un thème (domaine). */
  const toggleDomain = async (concepts: WatchConfig["concepts"], isActive: boolean) => {
    if (!config) return;
    const names = new Set(concepts.map((c) => c.concept));
    const previous = config;
    setConfig({
      ...config,
      concepts: config.concepts.map((c) => (names.has(c.concept) ? { ...c, isActive } : c)),
    });
    try {
      await Promise.all([...names].map((name) => patchConcept(name, isActive)));
    } catch {
      setConfig(previous);
      setError("Modification non enregistrée. Réessayez.");
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Chargement des paramètres…</div>;
  }

  const themeConcepts = config?.concepts.filter(c => c.legalDomain !== "convention_collective") ?? [];
  const conventionConcepts = config?.concepts.filter(c => c.legalDomain === "convention_collective") ?? [];

  // Concepts regroupés par domaine juridique.
  const byDomain = new Map<string, WatchConfig["concepts"]>();
  for (const c of themeConcepts) {
    byDomain.set(c.legalDomain, [...(byDomain.get(c.legalDomain) ?? []), c]);
  }

  const conventionDomain = new Map<string, WatchConfig["concepts"]>();
  for (const c of conventionConcepts) {
    conventionDomain.set(c.legalDomain, [...(conventionDomain.get(c.legalDomain) ?? []), c]);
  }

  const handleLegalConcept = async () => {
    if (!legalConceptName.trim()) {
      setIsEmpty(true);
      return;
    }
    try {
    const payload = await fetchProxy("/api/feedback", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        comment: legalConceptName,
        context: "Veille juridique",
        page: "/veille"
      }) 
    });
    const res = await payload.json();
    console.log("Succès :", res.message);
    setIsAlertSuccess(true);
    } catch (err) {
      setIsAlertError(true);
      console.error("Erreur serveur : ",err);
    }
    setLegalConceptName("");
    setIsOpen(false);
  }


  return (
    <div className="mx-auto w-full space-y-6 max-w-2xl">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
          {error}
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <Lock className="h-3.5 w-3.5" />
          Lecture seule — modification réservée aux Juristes et Administrateurs.
        </div>
      )}

      {isOpen && (
        <LegalConceptModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Demande d'ajout d'une convention collective"
          description="Veuillez ajouter le nom de la convention collective"
        >
          <textarea value={legalConceptName} onChange={(e) => setLegalConceptName(e.target.value)} className="text-sm text-gray-700 w-full 
          border rounded-lg border-gray-300 p-2" placeholder="Ecrivez le nom de votre convention collective ici..."></textarea>

          <div className="flex justify-end gap-3 pt-4">
            <Button className="border border-gray-300 text-white hover:bg-blue-800 bg-blue-700 px-4 py-2 rounded-lg" onClick={handleLegalConcept}>
              Envoyer
            </Button>
            <Button className="border border-gray-300 bg-red-700 text-white hover:bg-red-800 px-4 py-2 rounded-lg" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </div>
        </LegalConceptModal>
      )}

      {isEmpty && (
        <AlertBanner
          title="Champs manquants !"
          variant="error"
          detail="Veuillez remplir tous les champs."
          duration={8000}
          onClose={() => setIsEmpty(false)}
        />
      )}

      {isAlertError && (
        <AlertBanner
          title="La demande a échoué"
          variant="error"
          detail="L'envoi de la demande d'ajout de convention collective a échoué, veuillez réessayer."
          duration={8000}
          onClose={() => setIsAlertError(false)}
        />
      )}

      {isAlertSuccess && (
        <AlertBanner
          title="Demande de convention collective envoyée"
          variant="success"
          detail="Votre demande a bien été prise en compte. Les administrateurs traiteront votre demande sous peu."
          duration={8000}
          onClose={() => setIsAlertSuccess(false)}
        />
      )}

      {/* ── Sources ── */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Sources</h2>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="divide-y divide-gray-100">
            {config?.sources.map((s) => {
              const meta = SOURCE_META[s.name] ?? { label: s.name, url: "" };
              return (
                <div key={s.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className={`text-sm ${s.isActive ? "text-gray-800" : "text-gray-400"}`}>
                      {meta.label}
                    </p>
                    {meta.url && (
                      <a
                        href={meta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-lumenjuris hover:underline"
                      >
                        {siteLabel(meta.url)}
                      </a>
                    )}
                  </div>
                  <Toggle
                    checked={s.isActive}
                    disabled={!canEdit}
                    onChange={(v) => toggleSource(s.name, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Thèmes juridiques (repliables : le détail par concept est masqué) ── */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Thèmes surveillés</h2>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="divide-y divide-gray-100">
            {[...byDomain.entries()].map(([domain, concepts]) => {
              const activeCount = concepts.filter((c) => c.isActive).length;
              const isOpen = expanded.has(domain);
              return (
                <div key={domain}>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <button
                      onClick={() => toggleExpanded(domain)}
                      className="flex items-center gap-1.5 min-w-0 text-left"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                      <span className={`text-sm ${activeCount > 0 ? "text-gray-800" : "text-gray-400"}`}>
                        {domainLabel(domain)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {activeCount}/{concepts.length}
                      </span>
                    </button>
                    <Toggle
                      checked={activeCount > 0}
                      disabled={!canEdit}
                      onChange={(v) => toggleDomain(concepts, v)}
                    />
                  </div>
                  {isOpen && (
                    <div className="pl-5 pb-1 divide-y divide-gray-100">
                      {concepts.map((c) => (
                        <div key={c.concept} className="flex items-center justify-between gap-3 py-2">
                          <span className={`text-sm ${c.isActive ? "text-gray-600" : "text-gray-400"}`}>
                            {c.label}
                          </span>
                          <Toggle
                            checked={c.isActive}
                            disabled={!canEdit}
                            onChange={(v) => toggleConcept(c.concept, v)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="space-y-2">
        <div className="flex gap-4 items-center">
          <h2 className="text-base font-semibold text-gray-900">Conventions collectives</h2>
          <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center justify-center gap-2 
          rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all
          duration-150 hover:bg-blue-700">
            <span>Ajouter une convention</span>
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="divide-y divide-gray-100">
            {[...conventionDomain.entries()].map(([domain, concepts]) => {
              const activeCount = concepts.filter((c) => c.isActive).length;
              const isOpen = expanded.has(domain);
              return (
                <div key={domain}>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <button
                      onClick={() => toggleExpanded(domain)}
                      className="flex items-center gap-1.5 min-w-0 text-left"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                      <span className={`text-sm ${activeCount > 0 ? "text-gray-800" : "text-gray-400"}`}>
                        {domainLabel(domain)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {activeCount}/{concepts.length}
                      </span>
                    </button>
                    <Toggle
                      checked={activeCount > 0}
                      disabled={!canEdit}
                      onChange={(v) => toggleDomain(concepts, v)}
                    />
                  </div>
                  {isOpen && (
                    <div className="pl-5 pb-1 divide-y divide-gray-100">
                      {concepts.map((c) => (
                        <div key={c.concept} className="flex items-center justify-between gap-3 py-2">
                          <span className={`text-sm ${c.isActive ? "text-gray-600" : "text-gray-400"}`}>
                            {c.label}
                          </span>
                          <div className="flex items-center gap-5">
                            {c.sourceUrl &&
                              <a
                                href={c.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-right gap-2 text-xs font-medium text-lumenjuris hover:underline"
                              >Ouvrir<ExternalLink className="w-3.5 h-3.5" /></a>
                            }
                            <Toggle
                              checked={c.isActive}
                              disabled={!canEdit}
                              onChange={(v) => toggleConcept(c.concept, v)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
