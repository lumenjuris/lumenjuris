import { ClauseRisk } from "./types";

/* global Word, Office, OfficeExtension */

/**
 * Intégration document Word : lecture du texte, surlignage des clauses à
 * risque (équivalent du surlignage du DocumentViewer de la plateforme),
 * navigation vers une clause, et application d'une recommandation en suivi
 * des modifications.
 *
 * Ancrage : chaque clause localisée est enveloppée dans un content control
 * tagué `lumen-risk-<id>` — on retrouve ainsi la clause de façon stable même
 * si le document bouge (équivalent Word du findBestClauseSpan du front).
 *
 * Localisation : l'API search de Word est limitée (~255 caractères, pas de
 * correspondance au-delà d'une marque de paragraphe). On recherche donc le
 * DÉBUT et la FIN de la clause séparément, puis on étend la plage du début
 * jusqu'à la fin (expandTo) pour surligner la clause ENTIÈRE. À défaut de
 * fin localisable, on se replie sur le paragraphe du début (garde-fou de
 * longueur), puis en dernier recours sur le fragment de début seul.
 */

const RISK_TAG_PREFIX = "lumen-risk-";

const SEARCH_OPTIONS = { ignoreSpace: true, ignorePunct: true, matchCase: false };

/**
 * Couleur de surlignage selon le score. Word WEB accepte les hex pastel ;
 * Word Windows/Mac desktop ne supporte que la palette de surlignage — un hex
 * hors palette y est ramené à la couleur la plus proche (rouge vif, illisible).
 * La plateforme est lue au moment du surlignage : au chargement du module,
 * Office n'est pas encore prêt et le test concluait à tort à Word web.
 */
const isWeb = (): boolean => {
  try {
    return Office.context.platform === Office.PlatformType.OfficeOnline;
  } catch {
    return true;
  }
};

const highlightFor = (riskScore: number): string => {
  if (isWeb()) return riskScore >= 4 ? "#FCA5A5" : riskScore >= 3 ? "#FDBA74" : "#FDE68A";
  return riskScore >= 4 ? "pink" : riskScore >= 3 ? "yellow" : "turquoise";
};

const supportsTracking = (): boolean =>
  Office.context.requirements.isSetSupported("WordApi", "1.4");

/** Texte complet du document (envoyé à l'analyseur, comme le PDF sur la plateforme). */
export async function getDocumentText(): Promise<string> {
  let text = "";
  await Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    text = body.text;
  });
  return text;
}

/* ------------------------- Construction des recherches ------------------------- */

/**
 * Assainit une chaîne pour l'API search : les séquences « ^ » sont des codes
 * spéciaux de la recherche Word (^p, ^t…) — un code invalide ferait échouer
 * TOUT le lot de recherches de la phase 1.
 */
const sanitize = (s: string): string => s.replace(/\^/g, " ").replace(/\s+/g, " ").trim();

/** Coupe à ~max caractères sur une limite de mot (depuis le début ou la fin). */
function capAtWord(text: string, max: number, fromEnd = false): string {
  if (text.length <= max) return text;
  if (!fromEnd) {
    const cut = text.slice(0, max);
    const i = cut.lastIndexOf(" ");
    return i > max / 2 ? cut.slice(0, i) : cut;
  }
  const cut = text.slice(-max);
  const i = cut.indexOf(" ");
  return i !== -1 && i < max / 2 ? cut.slice(i + 1) : cut;
}

/**
 * Segments sans ponctuation ambiguë (apostrophes typographiques vs droites,
 * guillemets, tirets…) — le texte renvoyé par l'IA diffère souvent du document
 * sur ces caractères, d'où des variantes de repli insensibles à la ponctuation.
 */
function splitSegments(line: string): string[] {
  return line
    .split(/[«»"“”'’‘`–—…()\[\]]/)
    .map((s) => sanitize(s))
    .filter((s) => s.length >= 15);
}

/** Variantes de recherche pour le DÉBUT de la clause. */
function startVariants(line: string): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    if (s && s.length >= 10 && !out.includes(s)) out.push(s);
  };
  add(capAtWord(line, 120));
  const segments = splitSegments(line).sort((a, b) => b.length - a.length);
  if (segments[0]) add(capAtWord(segments[0], 120));
  const words = line.split(" ");
  if (words.length >= 8) add(capAtWord(words.slice(3, 18).join(" "), 120));
  return out.slice(0, 3);
}

/** Variantes de recherche pour la FIN de la clause (fin de la ligne d'ancrage). */
function endVariants(line: string): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    if (s && s.length >= 10 && !out.includes(s)) out.push(s);
  };
  add(capAtWord(line, 120, true));
  const segments = splitSegments(line);
  if (segments.length > 0) add(capAtWord(segments[segments.length - 1], 120, true));
  return out.slice(0, 2);
}

interface SearchPlan {
  starts: string[];
  ends: string[];
  /** true = la recherche de début couvre INTÉGRALEMENT la clause (≤ 120 car., une ligne). */
  whole: boolean;
}

function buildSearchPlan(content: string): SearchPlan {
  const lines = content
    .split(/[\r\n]+/)
    .map((l) => sanitize(l))
    .filter((l) => l.length >= 3);
  const norm = sanitize(content);
  const first = lines[0] ?? norm;

  // whole=true SEULEMENT si la chaîne recherchée couvre réellement toute la
  // clause : une seule ligne ET ≤ 120 caractères (capAtWord ne tronque pas).
  if (lines.length <= 1 && norm.length <= 120) {
    return { starts: startVariants(norm), ends: [], whole: true };
  }

  // Ligne d'ancrage de FIN : la dernière ligne assez longue pour être
  // recherchable (≥ 10 car.) — une clause finissant par « 2025. » s'ancre sur
  // l'avant-dernière ligne plutôt que de perdre toute extension.
  const endLine = [...lines].reverse().find((l) => l.length >= 10) ?? norm;
  return { starts: startVariants(first), ends: endVariants(endLine), whole: false };
}

/* ------------------------------- Surlignage ------------------------------- */

export interface HighlightReport {
  located: string[]; // ids localisés et surlignés
  missing: string[]; // ids introuvables dans le document
}

/** Relations « la fin est après le début » acceptées pour étendre la plage. */
const END_AFTER_START = new Set<string>(["After", "AdjacentAfter", "OverlapsAfter"]);

/**
 * Surligne toutes les clauses à risque dans le document et les ancre dans des
 * content controls. Idempotent : réinitialise d'abord les anciens ancrages.
 * Les allers-retours réseau sont regroupés par phase (Word web : chaque
 * context.sync() est un appel serveur).
 */
export async function highlightClauses(clauses: ClauseRisk[]): Promise<HighlightReport> {
  const report: HighlightReport = { located: [], missing: [] };

  await clearHighlights();

  await Word.run(async (context) => {
    // Phase 1 — TOUTES les recherches (débuts + fins, toutes clauses) en une passe.
    const specs = clauses.map((clause) => {
      const plan = buildSearchPlan(clause.content);
      const queue = (texts: string[]) =>
        texts.map((t) => {
          const results = context.document.body.search(t, SEARCH_OPTIONS);
          results.load("items");
          return results;
        });
      return { clause, plan, startResults: queue(plan.starts), endResults: queue(plan.ends) };
    });
    await context.sync();

    // Phase 2 — début retenu ; position des fins candidates vs le début.
    interface Candidate {
      clause: ClauseRisk;
      start: Word.Range;
      whole: boolean;
      endCompares: { range: Word.Range; relation: OfficeExtension.ClientResult<Word.LocationRelation> }[];
    }
    const candidates: Candidate[] = [];
    let needsSync = false;

    for (const spec of specs) {
      const startHit = spec.startResults.find((r) => r.items.length > 0);
      if (!startHit) {
        report.missing.push(spec.clause.id);
        continue;
      }
      const start = startHit.items[0];
      const endRanges = spec.plan.whole ? [] : spec.endResults.flatMap((r) => r.items).slice(0, 10);
      const endCompares = endRanges.map((range) => ({ range, relation: range.compareLocationWith(start) }));
      if (endCompares.length > 0) needsSync = true;
      candidates.push({ clause: spec.clause, start, whole: spec.plan.whole, endCompares });
    }
    if (needsSync) await context.sync();

    // Phase 3 — étendue début → fin (première fin APRÈS le début) ; en
    // parallèle, paragraphe du début comme plan B. Textes chargés pour les
    // garde-fous de longueur.
    interface Pending {
      clause: ClauseRisk;
      start: Word.Range;
      expanded: Word.Range | null;
      paragraph: Word.Range | null;
    }
    const pending: Pending[] = [];
    needsSync = false;

    for (const c of candidates) {
      let expanded: Word.Range | null = null;
      let paragraph: Word.Range | null = null;
      if (!c.whole) {
        const end = c.endCompares.find((cmp) => END_AFTER_START.has(String(cmp.relation.value)))?.range;
        if (end) {
          expanded = c.start.expandTo(end);
          expanded.load("text");
        }
        paragraph = c.start.paragraphs.getFirst().getRange(Word.RangeLocation.content);
        paragraph.load("text");
        needsSync = true;
      }
      pending.push({ clause: c.clause, start: c.start, expanded, paragraph });
    }
    if (needsSync) await context.sync();

    // Choix de la plage à surligner pour chaque clause (garde-fou de longueur :
    // ne jamais surligner un pavé sans rapport).
    const chosen = pending.map((p) => {
      const maxLength = p.clause.content.length * 1.8 + 240;
      let range = p.start; // dernier recours : fragment de début
      if (p.expanded && (p.expanded.text ?? "").length <= maxLength) {
        range = p.expanded;
      } else if (p.paragraph) {
        const len = (p.paragraph.text ?? "").length;
        if (len <= maxLength && len >= 40) range = p.paragraph;
      }
      return { clause: p.clause, range };
    });

    const anchor = (clause: ClauseRisk, range: Word.Range) => {
      const control = range.insertContentControl();
      control.tag = `${RISK_TAG_PREFIX}${clause.id}`;
      control.title = `⚠ ${clause.type.slice(0, 60)} (${clause.riskScore}/5)`;
      control.appearance = Word.ContentControlAppearance.boundingBox;
      control.color = clause.riskScore >= 4 ? "#DC2626" : "#D97706";
      range.font.highlightColor = highlightFor(clause.riskScore);
    };

    // Phase 4 — voie rapide : tout ancrer + surligner en UNE seule passe
    // réseau (sur Word web chaque context.sync() est un aller-retour serveur).
    try {
      for (const c of chosen) anchor(c.clause, c.range);
      await context.sync();
      for (const c of chosen) report.located.push(c.clause.id);
    } catch {
      // Repli : le lot a échoué (ex. chevauchement de content controls) →
      // on reprend clause par clause pour isoler la fautive.
      for (const c of chosen) {
        try {
          anchor(c.clause, c.range);
          await context.sync();
          report.located.push(c.clause.id);
        } catch {
          report.missing.push(c.clause.id);
        }
      }
    }
  });

  return report;
}

/** Supprime tous les surlignages/ancrages issus d'une analyse précédente. */
export async function clearHighlights(): Promise<void> {
  await Word.run(async (context) => {
    const controls = context.document.contentControls;
    controls.load("items/tag");
    await context.sync();

    for (const control of controls.items) {
      if (control.tag && control.tag.startsWith(RISK_TAG_PREFIX)) {
        control.getRange(Word.RangeLocation.whole).font.highlightColor = null as unknown as string;
        control.delete(true); // true = conserver le contenu
      }
    }
    await context.sync();
  });
}

/** Sélectionne la clause dans le document (scroll + focus). */
export async function selectClause(clauseId: string): Promise<boolean> {
  let found = false;
  await Word.run(async (context) => {
    const controls = context.document.contentControls.getByTag(`${RISK_TAG_PREFIX}${clauseId}`);
    controls.load("items");
    await context.sync();
    if (controls.items.length > 0) {
      controls.items[0].select();
      await context.sync();
      found = true;
    }
  });
  return found;
}

export interface ApplyResult {
  applied: boolean;
  tracked: boolean;
}

/** Abréviations juridiques dont le point ne termine PAS une phrase. */
const LEGAL_ABBREV = ["art", "arts", "al", "c", "L", "R", "D", "ch", "n°", "no", "cf", "ex", "p", "pp", "éd", "s", "ss"];

/**
 * Segmente une clause recommandée en lignes lisibles. L'IA renvoie souvent la
 * clause en un seul bloc : on ajoute des retours à la ligne aux frontières de
 * phrases et devant les énumérations (1) 2° a) b) -), sans casser les
 * références légales (« art. L.1242-8 ») ni les dates.
 */
function segmentClause(raw: string): string[] {
  let text = (raw ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];

  // Protège le point des abréviations pour qu'il ne déclenche pas de coupure.
  const MARK = String.fromCharCode(1);
  for (const a of LEGAL_ABBREV) {
    text = text.replace(new RegExp(`\\b${a}\\.`, "g"), a + MARK);
  }

  // Coupe devant les marqueurs d'énumération, seulement après une fin de
  // phrase ou un deux-points : le tiret d'un titre (« Article 4 – Objet »)
  // ne doit pas couper la ligne.
  text = text.replace(/([.;:])\s+(?=(?:\d{1,2}[°)]|[a-z]\)|[-–•])\s)/g, "$1\n");
  // Coupe en fin de phrase : « . » suivi d'une majuscule.
  text = text.replace(/\.\s+(?=[A-ZÀ-Ÿ])/g, ".\n");

  // Restaure les abréviations.
  text = text.split(MARK).join(".");

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}


/** Police du texte remplacé, reprise par la clause insérée. */
interface TextStyle {
  name: string;
  size: number;
}

/**
 * Convertit le texte de la clause recommandée en HTML : insertHtml restitue de
 * vrais paragraphes Word (insertText collerait tout sur une seule ligne). Sans
 * style explicite, Word applique sa police HTML par défaut (Times New Roman) et
 * de grands espacements : on reprend la police du texte d'origine.
 */
function toHtmlParagraphs(text: string, style: TextStyle | null): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const css = [
    style?.name ? `font-family:'${escape(style.name)}'` : "",
    style?.size ? `font-size:${style.size}pt` : "",
    "margin:0 0 6pt 0",
  ]
    .filter(Boolean)
    .join(";");
  const lines = segmentClause(text);
  if (lines.length === 0) return "<p></p>";
  return lines
    .map((line) => {
      // Ligne de titre (« Article 4 – Responsabilité ») : en gras, comme l'original.
      const isTitle = /^(article|art\.)\s*\d+/i.test(line) && line.length <= 90;
      return `<p style="${css}">${isTitle ? `<b>${escape(line)}</b>` : escape(line)}</p>`;
    })
    .join("");
}

/**
 * Remplace le texte de la clause (ancrée par son content control) par la
 * clause recommandée, EN SUIVI DES MODIFICATIONS : le juriste accepte ou
 * rejette la révision dans Word. Le mode de suivi initial est restauré même
 * si le remplacement échoue en cours de route.
 */
export async function applyRecommendationTracked(clauseId: string, newText: string): Promise<ApplyResult> {
  const tracked = supportsTracking();
  let applied = false;

  await Word.run(async (context) => {
    const doc = context.document;
    let previousMode: string | undefined;

    if (tracked) {
      doc.load("changeTrackingMode");
      await context.sync();
      previousMode = doc.changeTrackingMode;
      doc.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
    }

    try {
      const controls = doc.contentControls.getByTag(`${RISK_TAG_PREFIX}${clauseId}`);
      controls.load("items");
      await context.sync();

      if (controls.items.length > 0) {
        const control = controls.items[0];
        const range = control.getRange(Word.RangeLocation.whole);
        // Police du corps de la clause (dernier paragraphe : le titre peut différer).
        const bodyFont = control.paragraphs.getLast().font;
        bodyFont.load("name,size");
        await context.sync();
        const style = { name: bodyFont.name || "", size: bodyFont.size || 0 };
        range.font.highlightColor = null as unknown as string;
        // insertHtml (et non insertText) : préserve les sauts de ligne de la
        // clause recommandée sous forme de vrais paragraphes Word.
        control.insertHtml(toHtmlParagraphs(newText, style), Word.InsertLocation.replace);
        control.select();
        applied = true;
        await context.sync();
      }
    } finally {
      // Restaure le mode de suivi initial de l'utilisateur, même en cas
      // d'échec du remplacement (sinon le document reste en trackAll forcé).
      if (tracked && previousMode && previousMode !== Word.ChangeTrackingMode.trackAll) {
        try {
          doc.changeTrackingMode = previousMode as Word.ChangeTrackingMode;
          await context.sync();
        } catch {
          // best-effort : ne pas masquer l'erreur d'origine
        }
      }
    }
  });

  return { applied, tracked };
}
