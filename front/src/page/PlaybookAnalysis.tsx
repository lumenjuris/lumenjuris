import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle, ClipboardCheck, Copy, Check, Download, FileText, Plus, RotateCcw, Trash2, Undo2, Wand2, X,
} from "lucide-react";
import { extractDocumentContent } from "../utils/documentExtractor";
import { downloadTextAsDocx, toExportBaseName } from "../utils/exportContract";
import { playbookApi } from "../components/DashboardComponents/playbook/api";
import { appliquerSuggestion, localiserPassage } from "../components/DashboardComponents/playbook/appliquerSuggestion";
import { lirePlaybookCourant, memoriserPlaybookCourant } from "../components/DashboardComponents/playbook/playbookCourant";
import { PlaybookEditor, type Surlignage } from "../components/DashboardComponents/playbook/PlaybookEditor";
import { SEVERITY_LABEL } from "../components/DashboardComponents/playbook/types";
import type {
  Compliance, PlaybookAnalysisSummary, PlaybookCheckResult, PlaybookFinding, PlaybookInfo,
} from "../components/DashboardComponents/playbook/types";
import { BannerAction, PageBanner } from "../components/common/PageBanner";
import { AlertBanner } from "../components/common/AlertBanner";
import { COMPLETION_ANIMATION_MS, LoadingZoneAnalyzer } from "../components/common/LoadingZoneAnalyzer";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";

// Formats acceptés pour l'import (identiques à l'analyse des risques)
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Couleurs reprises de l'analyse des risques : rouge = non conforme, orange = à vérifier, vert = conforme.
const STATUT: Record<Compliance, { label: string; carte: string; badge: string; type: string; surligne: string }> = {
  non_compliant: {
    label: "Non conforme",
    carte: "bg-red-card-primary border-red-600 text-red-900",
    badge: "text-red-card-primary bg-white border border-black",
    type: "text-red-card-primary border-red-800",
    surligne: "bg-red-100 border-red-200",
  },
  to_check: {
    label: "À vérifier",
    carte: "bg-yellow-card-primary border-black text-orange-800",
    badge: "border-yellow-card-text bg-white text-yellow-card-text border",
    type: "text-yellow-card-text border-yellow-card-text",
    surligne: "bg-orange-100 border-orange-200",
  },
  compliant: {
    label: "Conforme",
    carte: "bg-green-card-primary border-green-800 text-green-900",
    badge: "border-green-700 bg-white border text-green-card-primary",
    type: "text-green-card-primary border-green-800",
    surligne: "bg-green-100 border-green-200",
  },
};
const MODIFIEE = {
  carte: "ring-1 ring-blue-500 bg-blue-50",
  badge: "border-blue-300 bg-white border text-blue-500",
  type: "text-blue-500 border-blue-300",
  surligne: "bg-blue-100 border-blue-300",
};

/** Une suggestion peut s'appliquer au texte : il y a un passage cité et une nouvelle rédaction. */
const applicable = (f: PlaybookFinding) => f.status !== "compliant" && !!f.contract_excerpt && !!f.replacement;

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/**
 * Page « Analyse playbook » : compare un contrat aux règles de négociation de
 * l'utilisateur. Même présentation que l'analyse des risques : contrat
 * surligné à gauche, liste des règles à droite, panneau de détail au clic.
 * Chaque analyse est enregistrée dans l'historique et se rouvre telle quelle.
 */
export function PlaybookAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [playbooks, setPlaybooks] = useState<PlaybookInfo[]>([]);
  const [playbookChoisi, setPlaybookChoisi] = useState<string>("");
  const [historique, setHistorique] = useState<PlaybookAnalysisSummary[] | null>(null);
  const [aSupprimer, setASupprimer] = useState<PlaybookAnalysisSummary | null>(null);

  const [enCours, setEnCours] = useState(false);
  const [pret, setPret] = useState(false);
  const [erreurFichier, setErreurFichier] = useState(false);
  const [erreurAnalyse, setErreurAnalyse] = useState("");
  const [erreurModif, setErreurModif] = useState("");

  const [analyseId, setAnalyseId] = useState<string | null>(null);
  const [fichier, setFichier] = useState("");
  const [texte, setTexte] = useState("");
  const [resultat, setResultat] = useState<PlaybookCheckResult | null>(null);
  /** Règle → texte mis à la place du passage d'origine (suggestion appliquée). */
  const [appliquees, setAppliquees] = useState<Record<string, string>>({});
  /** Nouvelle rédaction retouchée par l'utilisateur avant application. */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [ouverte, setOuverte] = useState<PlaybookFinding | null>(null);
  const [copie, setCopie] = useState(false);

  const chargerHistorique = useCallback(async () => {
    try { setHistorique(await playbookApi.analyses()); } catch { setHistorique([]); }
  }, []);

  useEffect(() => {
    void chargerHistorique();
    playbookApi.playbooks()
      .then((liste) => {
        setPlaybooks(liste);
        const voulu = lirePlaybookCourant();
        setPlaybookChoisi((liste.find((p) => p.id === voulu) ?? liste.find((p) => p.isDefault) ?? liste[0])?.id ?? "");
      })
      .catch(() => setPlaybooks([]));
  }, [chargerHistorique]);

  function reinitialiser() {
    setAnalyseId(null);
    setResultat(null);
    setTexte("");
    setAppliquees({});
    setBrouillons({});
    setOuverte(null);
    setErreurAnalyse("");
  }

  async function analyser(contenu: string, nomFichier: string) {
    setEnCours(true);
    setPret(false);
    setErreurAnalyse("");
    try {
      const r = await playbookApi.check(contenu, playbookChoisi || undefined);
      // On laisse la barre arriver à 100 % avant d'afficher le résultat
      setPret(true);
      await new Promise((resolve) => setTimeout(resolve, COMPLETION_ANIMATION_MS));
      setResultat(r);
      if (r.findings.length > 0) {
        playbookApi
          .saveAnalysis({ fileName: nomFichier, playbookId: playbookChoisi || undefined, summary: r.summary, snapshot: { text: contenu, result: r, applied: {} } })
          .then(({ id }) => { setAnalyseId(id); void chargerHistorique(); })
          .catch(() => { /* l'historique est un confort : l'analyse reste affichée */ });
      }
    } catch (e) {
      setErreurAnalyse(e instanceof Error ? e.message : "L'analyse playbook n'a pas pu être réalisée.");
    } finally {
      setEnCours(false);
    }
  }

  // Contrat envoyé depuis l'analyse des risques (bouton « Playbook ») : analyse immédiate.
  const recu = useRef(false);
  useEffect(() => {
    const st = location.state as { playbookTexte?: string; playbookFichier?: string } | null;
    if (recu.current || !st?.playbookTexte || !playbookChoisi) return;
    recu.current = true;
    navigate(".", { replace: true, state: null });
    reinitialiser();
    setFichier(st.playbookFichier || "Contrat");
    setTexte(st.playbookTexte);
    void analyser(st.playbookTexte, st.playbookFichier || "Contrat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, playbookChoisi]);

  async function choisirFichier(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setErreurFichier(true);
      return;
    }
    setErreurFichier(false);
    reinitialiser();
    setFichier(file.name);
    setEnCours(true);
    try {
      const extrait = await extractDocumentContent(file);
      if (!extrait.text?.trim()) throw new Error("Aucun texte lisible dans ce document.");
      setTexte(extrait.text);
      await analyser(extrait.text, file.name);
    } catch (e) {
      setErreurAnalyse(e instanceof Error ? e.message : "Lecture du document impossible.");
      setEnCours(false);
    }
  }

  async function rouvrir(a: PlaybookAnalysisSummary) {
    try {
      const d = await playbookApi.analysis(a.id);
      reinitialiser();
      setAnalyseId(d.id);
      setFichier(d.fileName);
      setTexte(d.snapshot.text ?? "");
      setAppliquees(d.snapshot.applied ?? {});
      setResultat(d.snapshot.result);
    } catch (e) {
      setErreurAnalyse(e instanceof Error ? e.message : "Analyse introuvable.");
    }
  }

  async function supprimerAnalyse() {
    const a = aSupprimer;
    setASupprimer(null);
    if (!a) return;
    setHistorique((h) => h?.filter((x) => x.id !== a.id) ?? null);
    try { await playbookApi.removeAnalysis(a.id); } catch { void chargerHistorique(); }
  }

  // Les suggestions appliquées sont enregistrées dans l'historique (après une courte pause).
  useEffect(() => {
    if (!analyseId || !resultat) return;
    const t = window.setTimeout(() => {
      void playbookApi.updateAnalysis(analyseId, { summary: resultat.summary, snapshot: { text: texte, result: resultat, applied: appliquees } }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [analyseId, resultat, texte, appliquees]);

  /** Fait défiler le contrat jusqu'au passage de la règle, comme dans l'analyse des risques. */
  function allerAuPassage(ruleId: string) {
    window.setTimeout(() => {
      document.getElementById(`pb-passage-${ruleId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function ouvrir(f: PlaybookFinding) {
    setOuverte(f);
    allerAuPassage(f.rule_id);
  }

  const redaction = (f: PlaybookFinding) => brouillons[f.rule_id] ?? f.replacement;

  /** Applique directement la nouvelle rédaction dans le contrat (annulable). */
  function appliquer(f: PlaybookFinding) {
    const nouvelle = redaction(f).trim();
    if (!nouvelle) return;
    const nouveau = appliquerSuggestion(texte, f.contract_excerpt, nouvelle);
    if (nouveau === null) {
      setErreurModif("Le passage n'a pas été retrouvé dans le contrat : modifiez-le à la main.");
      return;
    }
    setTexte(nouveau);
    setAppliquees((a) => ({ ...a, [f.rule_id]: nouvelle }));
    allerAuPassage(f.rule_id);
  }

  /** Applique d'un coup toutes les suggestions des règles non conformes. */
  function toutAppliquer() {
    if (!resultat) return;
    let t = texte;
    const ajout: Record<string, string> = {};
    let echecs = 0;
    for (const f of resultat.findings) {
      if (f.status !== "non_compliant" || !applicable(f) || appliquees[f.rule_id]) continue;
      const nouvelle = redaction(f).trim();
      const n = nouvelle ? appliquerSuggestion(t, f.contract_excerpt, nouvelle) : null;
      if (n === null) { echecs += 1; continue; }
      t = n;
      ajout[f.rule_id] = nouvelle;
    }
    setTexte(t);
    setAppliquees((a) => ({ ...a, ...ajout }));
    if (echecs) setErreurModif(`${echecs} passage(s) introuvable(s) : à modifier à la main.`);
  }

  /** Remet le passage d'origine à la place de la suggestion appliquée. */
  function annuler(f: PlaybookFinding) {
    const nouveau = appliquerSuggestion(texte, appliquees[f.rule_id] ?? "", f.contract_excerpt);
    if (nouveau === null) return;
    setTexte(nouveau);
    setAppliquees((a) => { const n = { ...a }; delete n[f.rule_id]; return n; });
    allerAuPassage(f.rule_id);
  }

  // Règles à traiter d'abord, puis les conformes.
  const aTraiter = useMemo(() => resultat?.findings.filter((f) => f.status !== "compliant") ?? [], [resultat]);
  const conformes = useMemo(() => resultat?.findings.filter((f) => f.status === "compliant") ?? [], [resultat]);
  const ordre = useMemo(() => [...aTraiter, ...conformes], [aTraiter, conformes]);
  const restantAAppliquer = aTraiter.filter((f) => f.status === "non_compliant" && applicable(f) && !appliquees[f.rule_id]).length;

  // Clavier : ↑ ↓ pour passer d'une règle à l'autre, Entrée pour appliquer, Échap pour fermer.
  useEffect(() => {
    if (!resultat) return;
    function touche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable)) return;
      if (e.key === "Escape") { setOuverte(null); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (ordre.length === 0) return;
        e.preventDefault();
        const i = ouverte ? ordre.findIndex((f) => f.rule_id === ouverte.rule_id) : -1;
        const j = e.key === "ArrowDown" ? Math.min(ordre.length - 1, i + 1) : Math.max(0, i - 1);
        ouvrir(ordre[j]);
        return;
      }
      if (e.key === "Enter" && ouverte && applicable(ouverte) && !appliquees[ouverte.rule_id]) {
        e.preventDefault();
        appliquer(ouverte);
      }
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat, ordre, ouverte, appliquees, texte, brouillons]);

  // Passages à surligner dans le contrat (le texte modifié remplace le passage d'origine).
  const surlignages = useMemo<Surlignage[]>(() => {
    if (!resultat) return [];
    const zones: Surlignage[] = [];
    for (const f of resultat.findings) {
      const passage = appliquees[f.rule_id] ?? f.contract_excerpt;
      const pos = passage ? localiserPassage(texte, passage) : null;
      if (!pos || zones.some((z) => pos.debut < z.fin && z.debut < pos.fin)) continue;
      const couleur = appliquees[f.rule_id] ? "bleu" : f.status === "non_compliant" ? "rouge" : f.status === "to_check" ? "orange" : "vert";
      zones.push({ ...pos, ruleId: f.rule_id, couleur });
    }
    return zones;
  }, [resultat, texte, appliquees]);

  const clicRegle = useCallback((ruleId: string) => {
    const f = resultat?.findings.find((x) => x.rule_id === ruleId);
    if (f) setOuverte(f);
  }, [resultat]);

  const nbAppliquees = Object.keys(appliquees).length;
  const aResultats = !!resultat && resultat.findings.length > 0;

  const choixPlaybook = playbooks.length > 1 && (
    <select
      value={playbookChoisi}
      onChange={(e) => { setPlaybookChoisi(e.target.value); memoriserPlaybookCourant(e.target.value); }}
      disabled={enCours}
      title="Playbook utilisé pour l'analyse"
      className="h-10 rounded-xl border-0 bg-white/15 px-3 text-sm font-medium text-white outline-none cursor-pointer [&>option]:text-ink"
    >
      {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.activeCount})</option>)}
    </select>
  );

  const carteRegle = (f: PlaybookFinding) => {
    const modifiee = !!appliquees[f.rule_id];
    const st = modifiee ? MODIFIEE : STATUT[f.status];
    return (
      <div
        key={f.rule_id}
        onClick={() => ouvrir(f)}
        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${st.carte} ${ouverte?.rule_id === f.rule_id ? "ring-2 ring-blue-primary" : ""}`}
      >
        <div className="mb-2">
          <span className={`inline-block px-4 py-2 rounded-full text-xs font-medium ${st.badge}`}>
            {modifiee ? "Suggestion appliquée" : `${STATUT[f.status].label} · ${SEVERITY_LABEL[f.severity]}`}
          </span>
        </div>
        <div className={`flex font-medium bg-white p-2 rounded-lg border ${st.type}`}>{f.rule_name}</div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageBanner
        compact={!!resultat}
        title="Analyse playbook"
        backLink={resultat ? { label: "Historique", onClick: () => { reinitialiser(); void chargerHistorique(); } } : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {choixPlaybook}
            <BannerAction onClick={() => inputRef.current?.click()} disabled={enCours} icon={<Plus />}>
              Analyser un contrat
            </BannerAction>
          </div>
        }
      />
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => void choisirFichier(e)} />

      <div className="space-y-3">
        {erreurFichier && (
          <AlertBanner
            title="Erreur de fichier"
            variant="error"
            detail="Seuls les fichiers PDF, DOC et DOCX (Word) sont acceptés."
            duration={8000}
            onClose={() => setErreurFichier(false)}
          />
        )}
        {erreurAnalyse && (
          <AlertBanner title="Analyse playbook impossible" variant="error" detail={erreurAnalyse} onClose={() => setErreurAnalyse("")} />
        )}
        {erreurAnalyse && texte && !enCours && !resultat && (
          <button onClick={() => void analyser(texte, fichier)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            <RotateCcw className="h-4 w-4" /> Relancer l'analyse
          </button>
        )}
        {erreurModif && (
          <AlertBanner title="Modification impossible" variant="error" detail={erreurModif} duration={8000} onClose={() => setErreurModif("")} />
        )}
      </div>

      {enCours ? (
        <div className="mt-8">
          <LoadingZoneAnalyzer phase="playbook" isComplete={pret} />
        </div>
      ) : resultat && !aResultats ? (
        <Vide
          texte={resultat.totalRules === 0 ? "Ce playbook n'a encore aucune règle active." : `Aucune des ${resultat.totalRules} règles de ce playbook ne concerne ce contrat.`}
          lien={resultat.totalRules === 0}
        />
      ) : resultat ? (
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Contrat surligné */}
          <div className="flex-1 w-full min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 shadow flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4 bg-blue-primary">
                <h2 className="min-w-0 truncate text-lg font-semibold text-white">{fichier}</h2>
                {nbAppliquees > 0 && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => { void navigator.clipboard.writeText(texte); setCopie(true); setTimeout(() => setCopie(false), 1500); }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/40 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10"
                    >
                      {copie ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copier
                    </button>
                    <button
                      onClick={() => void downloadTextAsDocx(toExportBaseName(fichier), texte, `${toExportBaseName(fichier)} - modifié`)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-primary hover:bg-white/90"
                    >
                      <Download className="h-3.5 w-3.5" /> Word
                    </button>
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="max-w-4xl mx-auto">
                  <PlaybookEditor
                    texte={texte}
                    surlignages={surlignages}
                    actif={ouverte?.rule_id ?? null}
                    onClickRegle={clicRegle}
                    onChange={setTexte}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Liste des règles à droite (même gabarit que « Risques détectés ») */}
          <div className="flex flex-col w-full md:w-80 flex-shrink-0 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]">
            <div className="w-full bg-white border rounded-lg flex flex-col min-h-0 md:max-h-[calc(100vh-2rem)]">
              <div className="sticky top-0 z-10 bg-blue-primary border-b border-gray-100 px-4 pt-4 pb-3 rounded-t-lg">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-gray-300 stroke-[1.5]" />
                  <span className="text-sm font-semibold text-white tracking-tight">
                    Règles analysées ({resultat.summary.analysed})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resultat.summary.nonCompliant > 0 && (
                    <Compteur n={resultat.summary.nonCompliant} label="non conforme" point="bg-red-500" style="text-red-700 bg-red-50 border-red-100" />
                  )}
                  {resultat.summary.toCheck > 0 && (
                    <Compteur n={resultat.summary.toCheck} label="à vérifier" invariable point="bg-orange-400" style="text-orange-700 bg-orange-50 border-orange-100" />
                  )}
                  {resultat.summary.compliant > 0 && (
                    <Compteur n={resultat.summary.compliant} label="conforme" point="bg-green-400" style="text-green-700 bg-green-50 border-green-100" />
                  )}
                </div>
                {restantAAppliquer > 0 && (
                  <button
                    onClick={toutAppliquer}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-primary hover:bg-white/90"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Tout appliquer ({restantAAppliquer})
                  </button>
                )}
              </div>
              {nbAppliquees > 0 && (
                <div className="flex justify-center items-center gap-2 text-sm font-medium text-gray-600 mt-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {nbAppliquees} suggestion{nbAppliquees > 1 ? "s" : ""} appliquée{nbAppliquees > 1 ? "s" : ""}
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {aTraiter.length === 0 && (
                  <p className="text-center text-sm font-medium text-green-700">Toutes les règles sont respectées.</p>
                )}
                {aTraiter.map(carteRegle)}
                {conformes.map(carteRegle)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Historique
          analyses={historique}
          onOuvrir={(a) => void rouvrir(a)}
          onSupprimer={setASupprimer}
          onImporter={() => inputRef.current?.click()}
        />
      )}

      {ouverte && (
        <DetailRegle
          f={ouverte}
          appliquee={appliquees[ouverte.rule_id]}
          redaction={redaction(ouverte)}
          onRedaction={(v) => setBrouillons((b) => ({ ...b, [ouverte.rule_id]: v }))}
          onClose={() => setOuverte(null)}
          onAppliquer={() => appliquer(ouverte)}
          onAnnuler={() => annuler(ouverte)}
        />
      )}

      <ConfirmationModal
        open={aSupprimer !== null}
        title="Supprimer l'analyse"
        description={`Supprimer l'analyse de « ${aSupprimer?.fileName ?? ""} » de l'historique ?`}
        confirmLabel="Supprimer"
        onConfirm={() => void supprimerAnalyse()}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}

/** Historique des analyses playbook, affiché avant tout import. */
function Historique({
  analyses, onOuvrir, onSupprimer, onImporter,
}: {
  analyses: PlaybookAnalysisSummary[] | null;
  onOuvrir: (a: PlaybookAnalysisSummary) => void;
  onSupprimer: (a: PlaybookAnalysisSummary) => void;
  onImporter: () => void;
}) {
  if (analyses === null) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}</div>;
  }
  if (analyses.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-lg bg-gray-card p-10 border border-gray-300 text-center">
        <ClipboardCheck className="h-6 w-6 text-blue-primary" />
        <p className="text-sm text-gray-600">
          <button onClick={onImporter} className="font-semibold text-blue-primary hover:underline">Analysez un contrat</button>{" "}
          pour le comparer à vos règles. Vos règles se gèrent dans{" "}
          <Link to="/playbook" className="font-semibold text-blue-primary hover:underline">Playbook</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Analyses récentes
      </div>
      <ul className="divide-y divide-gray-100">
        {analyses.map((a) => (
          <li key={a.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer" onClick={() => onOuvrir(a)}>
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{a.fileName}</p>
              <p className="text-xs text-gray-500">{formatDate(a.updatedAt)}{a.playbookName ? ` · ${a.playbookName}` : ""}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              {a.nonCompliant > 0 && <Compteur n={a.nonCompliant} label="non conforme" point="bg-red-500" style="text-red-700 bg-red-50 border-red-100" />}
              {a.toCheck > 0 && <Compteur n={a.toCheck} label="à vérifier" invariable point="bg-orange-400" style="text-orange-700 bg-orange-50 border-orange-100" />}
              {a.compliant > 0 && <Compteur n={a.compliant} label="conforme" point="bg-green-400" style="text-green-700 bg-green-50 border-green-100" />}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onSupprimer(a); }}
              title="Supprimer"
              className="rounded-lg p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Panneau de détail d'une règle : même panneau latéral que le détail d'une clause à risque. */
function DetailRegle({
  f, appliquee, redaction, onRedaction, onClose, onAppliquer, onAnnuler,
}: {
  f: PlaybookFinding;
  /** Texte appliqué au contrat, s'il y en a un. */
  appliquee: string | undefined;
  redaction: string;
  onRedaction: (v: string) => void;
  onClose: () => void;
  onAppliquer: () => void;
  onAnnuler: () => void;
}) {
  const st = STATUT[f.status];
  const corps = (
    <div className="p-4 space-y-4 font-sans">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${appliquee ? MODIFIEE.badge : st.badge}`}>
          {appliquee ? "Suggestion appliquée" : st.label}
        </span>
        {f.status !== "compliant" && (
          <span className="text-xs text-gray-500">Importance {SEVERITY_LABEL[f.severity].toLowerCase()}</span>
        )}
      </div>
      <p className="text-xs text-gray-500">{f.category}{f.clause ? ` · ${f.clause}` : ""}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Dans le contrat</p>
          <p className="mt-1 text-sm text-gray-900">{f.detected_value || "—"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Votre règle</p>
          <p className="mt-1 text-sm text-gray-900">{f.expected_value || "—"}</p>
        </div>
      </div>

      {f.explanation && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-800">Explication</h4>
          <p className="text-sm leading-relaxed text-slate-700">{f.explanation}</p>
        </div>
      )}
      {f.status !== "compliant" && f.recommendation && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-800">Suggestion</h4>
          <p className="text-sm leading-relaxed text-slate-700">{f.recommendation}</p>
          {applicable(f) && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                {appliquee ? "Rédaction appliquée" : "Nouvelle rédaction (modifiable)"}
              </p>
              {appliquee ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-800">{appliquee}</p>
              ) : (
                <textarea
                  value={redaction}
                  onChange={(e) => onRedaction(e.target.value)}
                  rows={Math.min(8, Math.max(3, Math.ceil(redaction.length / 45)))}
                  className="mt-1 w-full resize-y rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-blue-400"
                />
              )}
              {appliquee ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><Check className="h-3.5 w-3.5" /> Appliquée au contrat</span>
                  <button onClick={onAnnuler} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-blue-primary">
                    <Undo2 className="h-3.5 w-3.5" /> Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={onAppliquer}
                  disabled={!redaction.trim()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Appliquer la suggestion
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const entete = (
    <header className="flex-shrink-0 flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
      <h3 className="text-base font-semibold">{f.rule_name}</h3>
      <button onClick={onClose} title="Fermer"><X size={18} /></button>
    </header>
  );

  return (
    <>
      {/* Mobile */}
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden" onClick={onClose}>
        <motion.section
          className="relative w-full rounded-lg bg-white shadow-xl mx-2 mb-3 flex flex-col overflow-hidden"
          style={{ maxHeight: "85vh" }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {entete}
          <div className="overflow-y-auto">{corps}</div>
        </motion.section>
      </div>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}>
          <motion.section
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 overflow-hidden flex flex-col"
            initial={{ x: 384, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "tween", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            {entete}
            <div className="flex-1 overflow-y-auto">{corps}</div>
          </motion.section>
        </div>
      </div>
    </>
  );
}

function Compteur({ n, label, point, style, invariable }: { n: number; label: string; point: string; style: string; invariable?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium border px-2 py-0.5 rounded-full ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${point}`} />
      {n} {label}{n > 1 && !invariable ? "s" : ""}
    </span>
  );
}

function Vide({ texte, lien }: { texte: string; lien?: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-lg bg-gray-card p-10 border border-gray-300 text-center">
      <ClipboardCheck className="h-6 w-6 text-blue-primary" />
      <p className="text-sm font-semibold text-gray-900">{texte}</p>
      {lien && (
        <Link to="/playbook" className="rounded-md bg-blue-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Créer mes règles
        </Link>
      )}
    </div>
  );
}
