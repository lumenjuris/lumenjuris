// Tests de l'analyse playbook (sans réseau ni IA) : npm run test:playbook
import assert from "node:assert/strict";
import {
  buildPlaybookPrompt,
  parsePlaybookResponse,
  preselectRules,
  summarize,
  type PlaybookRule,
} from "../src/services/playbook/playbookEngine.js";

let echecs = 0;
function check(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✔ ${nom}`);
  } catch (e) {
    echecs += 1;
    console.error(`✘ ${nom}\n  ${(e as Error).message}`);
  }
}

const image: PlaybookRule = {
  id: "r-image", name: "Durée maximale de cession", category: "Droit à l'image",
  ruleType: "MAX", expectedValue: "24", unit: "mois", severity: "HIGH",
  suggestion: "Limiter la cession à 24 mois.",
};
const commission: PlaybookRule = {
  id: "r-com", name: "Commission agence", category: "Commission",
  ruleType: "MIN", expectedValue: "15", unit: "%", severity: "MEDIUM",
};
const resiliation: PlaybookRule = {
  id: "r-resil", name: "Possibilité de résiliation", category: "Résiliation",
  ruleType: "REQUIRED", severity: "HIGH",
};
const voix: PlaybookRule = {
  id: "r-voix", name: "Clonage de voix", category: "Utilisation de l'image ou de la voix",
  ruleType: "FORBIDDEN", severity: "HIGH",
};

const contrat =
  "Article 3 – Cession. L'artiste cède à la société le droit d'exploiter son image. La cession est consentie pour 5 ans. " +
  "Article 4 – Rémunération. L'agence perçoit une commission de 20 % sur les cachets.";

const reponse = (results: unknown[]) => JSON.stringify({ results });

check("présélection : garde les règles dont le sujet est dans le contrat", () => {
  const ids = preselectRules(contrat, [image, commission, voix]).map((r) => r.id);
  assert.deepEqual(ids, ["r-image", "r-com"]);
});

check("présélection : une règle obligatoire est toujours gardée", () => {
  assert.ok(preselectRules(contrat, [resiliation]).some((r) => r.id === "r-resil"));
});

check("présélection : aucun playbook → aucune règle, donc aucun appel IA", () => {
  assert.deepEqual(preselectRules(contrat, []), []);
});

check("prompt : contient uniquement les règles présélectionnées", () => {
  const p = buildPlaybookPrompt(contrat, [image]);
  assert.ok(p.includes("r-image") && !p.includes("r-com"));
});

check("métier : cession 5 ans face à 24 mois max → non conforme, suggestion 24 mois", () => {
  const f = parsePlaybookResponse(
    reponse([{ rule_id: "r-image", status: "non_compliant", confidence: 0.95, clause: "Cession",
      contract_excerpt: "La cession est consentie pour 5 ans.", detected_value: "5 ans (60 mois)",
      expected_value: "24 mois maximum", explanation: "60 mois dépasse 24 mois.", recommendation: "",
      replacement: "La cession est consentie pour 24 mois." }]),
    [image], contrat,
  );
  assert.equal(f[0].status, "non_compliant");
  assert.equal(f[0].recommendation, "Limiter la cession à 24 mois.");
  assert.equal(f[0].replacement, "La cession est consentie pour 24 mois.");
  assert.equal(f[0].severity, "HIGH");
});

check("métier : commission 20 % face à 15 % min → conforme", () => {
  const f = parsePlaybookResponse(
    reponse([{ rule_id: "r-com", status: "compliant", confidence: 0.9,
      contract_excerpt: "L'agence perçoit une commission de 20 % sur les cachets.", detected_value: "20 %" }]),
    [commission], contrat,
  );
  assert.equal(f[0].status, "compliant");
  assert.equal(f[0].replacement, "");
});

check("plusieurs règles : écarts triés en premier, résumé correct", () => {
  const f = parsePlaybookResponse(
    reponse([
      { rule_id: "r-com", status: "compliant", contract_excerpt: "" },
      { rule_id: "r-image", status: "non_compliant", contract_excerpt: "La cession est consentie pour 5 ans." },
      { rule_id: "r-resil", status: "to_check" },
    ]),
    [image, commission, resiliation], contrat,
  );
  assert.deepEqual(f.map((x) => x.rule_id), ["r-image", "r-resil", "r-com"]);
  assert.deepEqual(summarize(f), { analysed: 3, compliant: 1, nonCompliant: 1, toCheck: 1 });
});

check("règle ambiguë : statut inconnu → à vérifier", () => {
  const f = parsePlaybookResponse(reponse([{ rule_id: "r-image", status: "peut-être" }]), [image], contrat);
  assert.equal(f[0].status, "to_check");
});

check("passage inventé par l'IA → retiré et passé en « à vérifier »", () => {
  const f = parsePlaybookResponse(
    reponse([{ rule_id: "r-image", status: "non_compliant", contract_excerpt: "Cession pour 99 ans.", replacement: "x" }]),
    [image], contrat,
  );
  assert.equal(f[0].status, "to_check");
  assert.equal(f[0].contract_excerpt, "");
  assert.equal(f[0].replacement, "");
});

check("règle inconnue ou non applicable → ignorée", () => {
  const f = parsePlaybookResponse(
    reponse([{ rule_id: "inventee", status: "non_compliant" }, { rule_id: "r-image", status: "not_applicable" }]),
    [image], contrat,
  );
  assert.equal(f.length, 0);
});

check("réponse IA illisible → erreur (l'appelant affiche « Relancer »)", () => {
  assert.throws(() => parsePlaybookResponse("désolé", [image], contrat));
});

if (echecs > 0) {
  console.error(`\n${echecs} test(s) en échec`);
  process.exit(1);
}
console.log("\nTous les tests playbook passent.");
