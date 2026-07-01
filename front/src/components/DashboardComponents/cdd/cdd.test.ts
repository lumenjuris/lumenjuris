import { describe, expect, it } from "vitest";
import {
  computeEssaiMax,
  createEmptyCddFields,
  getMissingMandatory,
  type CddFields,
} from "./cddModel";
import { buildCddContract, formatDateFr, renderCddText } from "./buildCddContract";

describe("computeEssaiMax", () => {
  it("1 jour/semaine, sous le plafond de 2 semaines pour un contrat ≤ 6 mois", () => {
    // ~3 mois ≈ 13 semaines -> 13 jours (sous le plafond de 14)
    const r = computeEssaiMax("2026-01-01", "2026-03-31");
    expect(r?.days).toBe(13);
  });
  it("atteint le plafond de 14 jours pour un contrat de ~6 mois", () => {
    const r = computeEssaiMax("2026-01-01", "2026-06-30");
    expect(r?.days).toBe(14);
  });
  it("plafonne à 1 mois pour un contrat > 6 mois", () => {
    const r = computeEssaiMax("2026-01-01", "2026-12-31");
    expect(r?.days).toBe(30);
  });
  it("1 jour par semaine pour un contrat court", () => {
    // 14 jours -> 2 semaines -> 2 jours d'essai
    const r = computeEssaiMax("2026-01-01", "2026-01-14");
    expect(r?.days).toBe(2);
  });
  it("renvoie null si dates invalides ou fin avant début", () => {
    expect(computeEssaiMax("2026-03-01", "2026-01-01")).toBeNull();
    expect(computeEssaiMax("", "")).toBeNull();
  });
});

describe("formatDateFr", () => {
  it("formate en français avec 1er", () => {
    expect(formatDateFr("2026-01-01")).toBe("1er janvier 2026");
    expect(formatDateFr("2026-03-15")).toBe("15 mars 2026");
  });
});

function sampleFields(overrides: Partial<CddFields> = {}): CddFields {
  return {
    ...createEmptyCddFields(),
    emp_denomination: "ACME",
    sal_nom: "Dupont",
    sal_prenom: "Jean",
    motif_detail: "Surcroît exceptionnel de commandes",
    poste_intitule: "Développeur",
    poste_qualification: "Cadre",
    date_debut: "2026-02-01",
    date_fin: "2026-07-31",
    remuneration_brut_mensuel: "2500",
    convention_collective: "Syntec",
    caisse_retraite: "Malakoff Humanis",
    organisme_prevoyance: "AG2R",
    ...overrides,
  };
}

describe("getMissingMandatory", () => {
  it("ne signale rien quand toutes les mentions obligatoires sont présentes", () => {
    expect(getMissingMandatory(sampleFields())).toEqual([]);
  });
  it("exige le salarié remplacé en cas de remplacement", () => {
    const missing = getMissingMandatory(
      sampleFields({ cas_recours: "remplacement" }),
    );
    expect(missing).toContain("Nom du salarié remplacé");
    expect(missing).toContain("Qualification du salarié remplacé");
  });
  it("exige la date de fin pour un terme précis et la durée minimale pour un terme imprécis", () => {
    expect(getMissingMandatory(sampleFields({ date_fin: "" }))).toContain(
      "Date de fin (terme précis)",
    );
    expect(
      getMissingMandatory(
        sampleFields({ terme_type: "imprecis", date_fin: "", duree_minimale: "" }),
      ),
    ).toContain("Durée minimale (terme imprécis)");
  });
});

describe("buildCddContract", () => {
  it("contient toutes les mentions obligatoires de l'art. L1242-12", () => {
    const text = renderCddText(buildCddContract(sampleFields()));
    expect(text).toContain("CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE");
    expect(text).toContain("motif"); // 1°
    expect(text).toContain("terme précis"); // 2°
    expect(text).toContain("Développeur"); // 3° poste
    expect(text).toContain("Syntec"); // 4° convention
    expect(text).toContain("période d'essai"); // 5°
    expect(text).toContain("2500"); // 6° rémunération
    expect(text).toContain("Malakoff Humanis"); // 7° retraite
    expect(text).toContain("AG2R"); // 7° prévoyance
    expect(text).toContain("précarité"); // L1243-8
    expect(text).toContain("L1242-12"); // garde-fou requalification
  });

  it("ajoute la mention du salarié remplacé en cas de remplacement", () => {
    const text = renderCddText(
      buildCddContract(
        sampleFields({
          cas_recours: "remplacement",
          remplace_nom: "Marie Durand",
          remplace_qualification: "Comptable",
        }),
      ),
    );
    expect(text).toContain("Marie Durand");
    expect(text).toContain("Comptable");
  });

  it("inclut les clauses optionnelles seulement si activées", () => {
    const sans = renderCddText(buildCddContract(sampleFields()));
    expect(sans).not.toContain("Clauses particulières");
    const avec = renderCddText(
      buildCddContract(sampleFields({ clause_confidentialite: true })),
    );
    expect(avec).toContain("Clauses particulières");
    expect(avec).toContain("Confidentialité");
  });
});
