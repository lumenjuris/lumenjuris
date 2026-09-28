// Analyse « Playbook » : compare un contrat aux règles de négociation de
// l'utilisateur. Module sans effet de bord (pas de réseau) pour être testé
// seul : présélection des règles, prompt, lecture et contrôle de la réponse IA.
// Distinct de l'analyse juridique (aiAnalyzer.ts), qui n'est pas modifiée.

export type RuleType = "MAX" | "MIN" | "REQUIRED" | "FORBIDDEN" | "ALLOWED_VALUES" | "INSTRUCTION";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type Compliance = "compliant" | "non_compliant" | "to_check";

export interface PlaybookRule {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  ruleType: RuleType;
  expectedValue?: string | null;
  unit?: string | null;
  severity: Severity;
  suggestion?: string | null;
  keywords?: string[];
}

export interface PlaybookFinding {
  rule_id: string;
  rule_name: string;
  category: string;
  status: Compliance;
  confidence: number;
  clause: string;
  contract_excerpt: string;
  detected_value: string;
  expected_value: string;
  explanation: string;
  recommendation: string;
  /** Texte de remplacement proposé pour le passage (facultatif). */
  replacement: string;
  severity: Severity;
}

export interface PlaybookSummary {
  analysed: number;
  compliant: number;
  nonCompliant: number;
  toCheck: number;
}

/** Mots qui signalent qu'une catégorie est abordée dans le contrat. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "paiement": ["paiement", "payer", "facture", "règlement", "réglé", "échéance", "jours fin de mois", "virement"],
  "rémunération": ["rémunération", "cachet", "honoraires", "salaire", "prix", "montant", "euros", "€"],
  "commission": ["commission", "pourcentage", "%", "rétrocession"],
  "durée": ["durée", "période", "mois", "an ", "ans", "année", "à compter"],
  "renouvellement": ["renouvel", "reconduction", "tacite"],
  "résiliation": ["résiliation", "résilier", "rupture", "mettre fin", "terme anticipé"],
  "exclusivité": ["exclusivité", "exclusif", "exclusive"],
  "non-concurrence": ["non-concurrence", "non concurrence", "concurren"],
  "territoire": ["territoire", "monde", "mondial", "france", "europe", "pays"],
  "propriété intellectuelle": ["propriété intellectuelle", "droits d'auteur", "droit d'auteur", "œuvre", "oeuvre", "marque"],
  "droit à l'image": ["image", "photograph", "portrait", "apparence", "vidéo"],
  "cession de droits": ["cession", "cède", "céder", "licence", "concession"],
  "confidentialité": ["confidenti", "secret", "divulg"],
  "responsabilité": ["responsabilit", "dommage", "préjudice"],
  "indemnisation": ["indemni", "dédommag", "réparation"],
  "garanties": ["garanti"],
  "intelligence artificielle": ["intelligence artificielle", " ia ", "i.a.", "algorithm", "apprentissage", "entraîn", "génératif"],
  "utilisation de l'image ou de la voix": ["image", "voix", "vocal", "clonage", "synthèse", "deepfake"],
  "juridiction": ["tribunal", "juridiction", "compétent", "litige", "arbitrage"],
  "loi applicable": ["loi applicable", "droit applicable", "droit français", "régi par", "soumis au droit", "law"],
  "délais": ["délai", "jours", "préavis", "dans les"],
};

const normaliser = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'");

/**
 * Mots-clés d'une règle, du plus précis au plus large : ceux saisis par
 * l'utilisateur et les mots significatifs de son nom (« Clonage de voix » →
 * « clonage ») ; à défaut seulement, ceux de sa catégorie. Ainsi une règle sur
 * le clonage de voix n'est pas envoyée pour un contrat qui parle seulement d'image.
 */
export function keywordsForRule(rule: PlaybookRule): string[] {
  const precis = [
    ...(rule.keywords ?? []),
    ...rule.name
      .split(/[\s,;:'’()/-]+/)
      .filter((w) => w.length >= 5 && !/^(maximum|maximale?|minimum|minimale?|obligatoire|interdite?|autoris[ée]es?|possibilit[ée]|agence|contrat)$/i.test(w)),
  ].map(normaliser).filter((k) => k.trim().length >= 2);
  if (precis.length) return precis;
  const cle = normaliser(rule.category.trim());
  const entree = Object.entries(CATEGORY_KEYWORDS).find(([c]) => normaliser(c) === cle);
  return (entree?.[1] ?? []).map(normaliser);
}

/**
 * Présélection sans IA : ne garde que les règles dont le sujet apparaît dans
 * le contrat. Exceptions : une règle « obligatoire » (REQUIRED) est toujours
 * gardée — son absence est justement ce qu'on cherche.
 */
export function preselectRules(content: string, rules: PlaybookRule[]): PlaybookRule[] {
  const texte = ` ${normaliser(content)} `;
  return rules.filter((rule) => rule.ruleType === "REQUIRED" || keywordsForRule(rule).some((k) => texte.includes(k)));
}

const TYPE_LABEL: Record<RuleType, string> = {
  MAX: "valeur maximale",
  MIN: "valeur minimale",
  REQUIRED: "doit obligatoirement figurer au contrat",
  FORBIDDEN: "interdit",
  ALLOWED_VALUES: "seules ces valeurs sont autorisées",
  INSTRUCTION: "instruction à respecter",
};

/** Taille max du contrat envoyée à l'IA. */
const MAX_CONTRACT_CHARS = 120_000;

export function buildPlaybookPrompt(content: string, rules: PlaybookRule[]): string {
  const regles = rules
    .map((r) =>
      [
        `- rule_id: ${r.id}`,
        `  nom: ${r.name}`,
        `  catégorie: ${r.category}`,
        `  type: ${TYPE_LABEL[r.ruleType]}`,
        r.expectedValue ? `  valeur attendue: ${r.expectedValue}${r.unit ? ` ${r.unit}` : ""}` : "",
        r.description ? `  précision: ${r.description}` : "",
        r.suggestion ? `  correction souhaitée: ${r.suggestion}` : "",
      ].filter(Boolean).join("\n"),
    )
    .join("\n");

  return `Tu es juriste. Tu compares un contrat aux RÈGLES DE NÉGOCIATION INTERNES de ton client (son « playbook »).
Ce n'est PAS une analyse de légalité : une clause peut être parfaitement légale mais contraire à ces règles.

RÈGLES :
${regles}

MÉTHODE, pour chaque règle :
1. Cherche dans le contrat la ou les clauses qui traitent du même sujet.
2. Compare la valeur du contrat à la valeur attendue, en convertissant les unités (5 ans = 60 mois ; 20 % ≥ 15 %).
3. Statut :
   - "compliant" : le contrat respecte la règle ;
   - "non_compliant" : le contrat contredit la règle, ou une clause obligatoire est absente ;
   - "to_check" : le sujet est abordé de façon ambiguë, ou la règle est trop vague pour conclure ;
   - "not_applicable" : le contrat ne traite pas du tout ce sujet (sauf règle obligatoire).
4. Ne JAMAIS inventer un passage : "contract_excerpt" est recopié MOT POUR MOT depuis le contrat (une ou deux phrases au plus), ou vide si absent.

RÉPONSE : uniquement un objet JSON, sans markdown :
{"results":[{"rule_id":"...","status":"compliant|non_compliant|to_check|not_applicable","confidence":0.0,"clause":"titre ou objet de la clause","contract_excerpt":"...","detected_value":"...","expected_value":"...","explanation":"une ou deux phrases","recommendation":"modification conseillée","replacement":"nouvelle rédaction du passage cité, ou vide"}]}
Une entrée par règle, avec exactement les rule_id donnés.

CONTRAT :
${content.slice(0, MAX_CONTRACT_CHARS)}`;
}

function extraireJson(raw: string): any {
  const debut = raw.indexOf("{");
  const fin = raw.lastIndexOf("}");
  if (debut < 0 || fin <= debut) throw new Error("Réponse IA sans JSON");
  return JSON.parse(raw.slice(debut, fin + 1));
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Le passage cité figure-t-il vraiment dans le contrat (espaces et apostrophes tolérés) ? */
export function excerptInContract(excerpt: string, content: string): boolean {
  const n = (s: string) => normaliser(s).replace(/\s+/g, " ").trim();
  const e = n(excerpt);
  return e.length > 0 && n(content).includes(e);
}

/**
 * Lit la réponse de l'IA et la contrôle :
 * - règle inconnue → ignorée (l'IA ne crée ni ne modifie de règle) ;
 * - passage cité introuvable dans le contrat → « à vérifier », sans passage ;
 * - règle sans réponse ou « non applicable » → retirée du résultat.
 */
export function parsePlaybookResponse(raw: string, rules: PlaybookRule[], content: string): PlaybookFinding[] {
  const data = extraireJson(raw);
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const byId = new Map(rules.map((r) => [r.id, r]));
  const vus = new Set<string>();
  const findings: PlaybookFinding[] = [];

  for (const item of results) {
    const rule = byId.get(str(item?.rule_id));
    if (!rule || vus.has(rule.id)) continue;
    vus.add(rule.id);

    let status = str(item.status) as Compliance | "not_applicable";
    if (status === "not_applicable") continue;
    if (!["compliant", "non_compliant", "to_check"].includes(status)) status = "to_check";

    let excerpt = str(item.contract_excerpt);
    let replacement = str(item.replacement);
    if (excerpt && !excerptInContract(excerpt, content)) {
      excerpt = "";
      replacement = "";
      if (status === "non_compliant") status = "to_check";
    }

    const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    findings.push({
      rule_id: rule.id,
      rule_name: rule.name,
      category: rule.category,
      status: status as Compliance,
      confidence,
      clause: str(item.clause),
      contract_excerpt: excerpt,
      detected_value: str(item.detected_value),
      expected_value: str(item.expected_value) || [rule.expectedValue, rule.unit].filter(Boolean).join(" "),
      explanation: str(item.explanation),
      recommendation: str(item.recommendation) || str(rule.suggestion),
      replacement: status === "compliant" ? "" : replacement,
      severity: rule.severity,
    });
  }

  const poids: Record<Compliance, number> = { non_compliant: 0, to_check: 1, compliant: 2 };
  const sev: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return findings.sort((a, b) => poids[a.status] - poids[b.status] || sev[a.severity] - sev[b.severity]);
}

export function summarize(findings: PlaybookFinding[]): PlaybookSummary {
  return {
    analysed: findings.length,
    compliant: findings.filter((f) => f.status === "compliant").length,
    nonCompliant: findings.filter((f) => f.status === "non_compliant").length,
    toCheck: findings.filter((f) => f.status === "to_check").length,
  };
}
