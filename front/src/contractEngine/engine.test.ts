import { describe, expect, it } from "vitest";
import { cddAccroissementModel as M } from "./models/cddAccroissement";
import { createInitialState } from "./state";
import {
  computeCompleteness,
  deriveConstraints,
  validateVariables,
} from "./engine";
import { buildDocument, renderDocumentText } from "./buildDocument";
import type { DraftState } from "./types";

const init = (mode: DraftState["mode"] = "juriste") => createInitialState(M, mode);

describe("createInitialState", () => {
  it("applique les valeurs par défaut (variables, alternatives, décisions)", () => {
    const s = init();
    expect(s.variables.heures_hebdo).toBe("35");
    expect(s.alternatives.essai).toBe("legal");
    expect(s.alternatives.non_concurrence).toBe("sans");
    expect(s.decisions.motif).toBe("active");
    expect(s.decisions.carence).toBe("pending");
  });
});

describe("deriveConstraints — dépendances", () => {
  it("le motif actif plafonne la durée à 18 mois", () => {
    const d = deriveConstraints(M, init());
    expect(d.varConstraints.contrat_duree_mois?.max).toBe(18);
  });
  it("la non-concurrence « avec » rend la contrepartie obligatoire", () => {
    const s = init();
    s.alternatives.non_concurrence = "avec";
    const d = deriveConstraints(M, s);
    expect(d.varConstraints.nc_contrepartie?.required).toBe(true);
  });
});

describe("validateVariables", () => {
  it("signale une durée supérieure au maximum légal", () => {
    const s = init();
    s.variables.contrat_duree_mois = "24";
    const issues = validateVariables(M, s, deriveConstraints(M, s));
    expect(issues.some((i) => i.varId === "contrat_duree_mois" && i.kind === "max")).toBe(true);
  });
  it("accepte une durée conforme", () => {
    const s = init();
    s.variables.contrat_duree_mois = "12";
    const issues = validateVariables(M, s, deriveConstraints(M, s));
    expect(issues.some((i) => i.varId === "contrat_duree_mois")).toBe(false);
  });
  it("exige la contrepartie quand la non-concurrence est activée", () => {
    const s = init();
    s.alternatives.non_concurrence = "avec";
    const issues = validateVariables(M, s, deriveConstraints(M, s));
    expect(issues.some((i) => i.varId === "nc_contrepartie" && i.kind === "required")).toBe(true);
  });
});

describe("computeCompleteness — modes & garde-fous", () => {
  it("le juriste peut exporter malgré des points non traités", () => {
    const s = init("juriste");
    const c = computeCompleteness(M, s, deriveConstraints(M, s));
    expect(c.decisionsBlocking.length).toBeGreaterThan(0); // carence en attente
    expect(c.canExport).toBe(true); // il a le dernier mot
  });
  it("le non-juriste est bloqué tant qu'une décision à fort enjeu n'est pas traitée", () => {
    const s = init("nonjuriste");
    const c = computeCompleteness(M, s, deriveConstraints(M, s));
    expect(c.canExport).toBe(false);
  });
  it("le non-juriste peut exporter une fois les garde-fous levés", () => {
    const s = init("nonjuriste");
    s.decisions.carence = "active"; // traite la décision bloquante
    const c = computeCompleteness(M, s, deriveConstraints(M, s));
    expect(c.decisionsBlocking.length).toBe(0);
    expect(c.canExport).toBe(true);
  });
  it("retirer une mention obligatoire bloque même le non-juriste", () => {
    const s = init("nonjuriste");
    s.decisions.carence = "active";
    s.blocks.art_motif = { source: "model", status: "removed" };
    const c = computeCompleteness(M, s, deriveConstraints(M, s));
    expect(c.missingMandatory.some((m) => m.id === "m_motif")).toBe(true);
    expect(c.canExport).toBe(false);
  });
});

describe("buildDocument", () => {
  it("assemble le document par défaut avec les bonnes alternatives", () => {
    const text = renderDocumentText(buildDocument(M, init()));
    expect(text).toContain("CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE");
    expect(text).toContain("accroissement temporaire");
    expect(text).toContain("période d'essai de"); // option essai = legal
    expect(text).toContain("rémunération brute mensuelle"); // remuneration = fixe
    expect(text).toContain("n'est pas renouvelable"); // renouvellement = non
  });
  it("substitue les variables renseignées", () => {
    const s = init();
    s.variables.poste_intitule = "Développeur";
    const text = renderDocumentText(buildDocument(M, s));
    expect(text).toContain("Développeur");
  });
  it("applique une alternative choisie", () => {
    const s = init();
    s.alternatives.renouvellement = "oui";
    const text = renderDocumentText(buildDocument(M, s));
    expect(text).toContain("renouvelé deux fois");
  });
  it("exclut un bloc retiré et respecte un override manuel", () => {
    const s = init();
    s.blocks.art_mobilite = { source: "model", status: "removed" };
    s.blocks.art_temps = { source: "manual", status: "active", contentOverride: "Texte réécrit à la main." };
    const blocks = buildDocument(M, s);
    expect(blocks.some((b) => b.id === "art_mobilite")).toBe(false);
    const temps = blocks.find((b) => b.id === "art_temps");
    expect(temps?.content).toBe("Texte réécrit à la main.");
    expect(temps?.source).toBe("manual");
  });
});
