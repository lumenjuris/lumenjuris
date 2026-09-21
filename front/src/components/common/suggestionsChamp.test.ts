import { describe, expect, it } from "vitest";
import { dateLongue, lireDate, suggestionsPourChamp } from "./suggestionsChamp";
import { estFermee, tvaIntracom, villeDeLAdresse } from "./prefill";
import type { CompanyResult } from "../../types/companySearch";

// Lundi 21 septembre 2026.
const auj = new Date(2026, 8, 21);
const ctx = (valeurs: Record<string, string> = {}, villeUtilisateur: string | null = "Paris") => ({
  valeurs, villeUtilisateur, aujourdHui: auj,
});
const valeurs = (id: string, label: string, c = ctx()) => suggestionsPourChamp(id, label, c).map((p) => p.valeur);

describe("suggestionsPourChamp", () => {
  it("date de signature : aujourd'hui", () => {
    expect(valeurs("date_signature", "Date de signature")).toEqual(["21 septembre 2026"]);
  });

  it("date de début : aujourd'hui, 1er du mois prochain, lundi suivant", () => {
    expect(valeurs("date_debut", "Date de début")).toEqual(["21 septembre 2026", "1er octobre 2026", "28 septembre 2026"]);
  });

  it("date de fin calculée depuis la date de début (veille de l'échéance)", () => {
    expect(valeurs("date_fin", "Date de fin", ctx({ date_debut: "1er octobre 2026" }))).toEqual([
      "31 mars 2027", "30 septembre 2027", "30 septembre 2028",
    ]);
    expect(valeurs("date_fin", "Date de fin")).toEqual([]);
  });

  it("lieu et tribunal à partir de la ville de l'utilisateur, rien sans elle", () => {
    expect(valeurs("lieu_signature", "Fait à")).toEqual(["Paris"]);
    expect(valeurs("tribunal_competent", "Tribunal compétent")[0]).toBe("Tribunal de commerce de Paris");
    expect(valeurs("tribunal_competent", "Tribunal compétent", ctx({}, null))).toEqual([]);
  });

  it("TTC calculé depuis le HT", () => {
    expect(valeurs("montant_ttc", "Montant TTC", ctx({ montant_ht: "1 500 €" }))).toEqual(["1 800 €"]);
  });

  it("délais de paiement dans les plafonds légaux, période d'essai CDI", () => {
    expect(valeurs("delai_paiement", "Délai de paiement")).toEqual(["30 jours", "45 jours fin de mois", "60 jours"]);
    expect(valeurs("periode_essai", "Période d'essai")).toEqual(["2 mois", "3 mois", "4 mois"]);
  });

  it("aucune suggestion pour un champ inconnu", () => {
    expect(valeurs("client_email", "E-mail du client")).toEqual([]);
  });
});

describe("dates", () => {
  it("lit les formats courants", () => {
    expect(dateLongue(lireDate("01/10/2026")!)).toBe("1er octobre 2026");
    expect(dateLongue(lireDate("2026-10-01")!)).toBe("1er octobre 2026");
    expect(lireDate("bientôt")).toBeNull();
  });
});

describe("données déduites", () => {
  it("TVA intracommunautaire à partir du SIREN", () => {
    expect(tvaIntracom("552032534")).toBe("FR27552032534");
    expect(tvaIntracom("12")).toBeNull();
  });

  it("ville extraite de l'adresse, en casse lisible", () => {
    expect(villeDeLAdresse("1 RUE X 78100 SAINT-GERMAIN-EN-LAYE")).toBe("Saint-Germain-en-Laye");
    expect(villeDeLAdresse("1 rue X")).toBeNull();
  });

  it("société fermée", () => {
    expect(estFermee({ etat_administratif: "C" } as CompanyResult)).toBe(true);
    expect(estFermee({ etat_administratif: "A", siege: { etat_administratif: "A" } } as CompanyResult)).toBe(false);
  });
});
