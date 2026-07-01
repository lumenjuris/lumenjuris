import { describe, expect, it } from "vitest";
import type { CompanyResult } from "../types/companySearch";
import {
  buildSearchUrl,
  detectLookupMode,
  formatConventionFromCompany,
  formeJuridiqueLabel,
  pickIdcc,
  isValidSiren,
  isValidSiret,
  luhnCheck,
  mapCompanyToContractParty,
  mapCompanyToEnterprise,
  nafLabel,
  normalizeDigits,
  pickEtablissement,
} from "./companyLookup";

describe("normalizeDigits", () => {
  it("ne garde que les chiffres", () => {
    expect(normalizeDigits("552 032 534 00703")).toBe("55203253400703");
    expect(normalizeDigits("abc")).toBe("");
  });
});

describe("luhnCheck", () => {
  it("valide un SIREN réel (Danone)", () => {
    expect(luhnCheck("552032534")).toBe(true);
  });
  it("rejette une clé de contrôle invalide", () => {
    expect(luhnCheck("123456789")).toBe(false);
  });
});

describe("isValidSiren", () => {
  it("exige 9 chiffres + Luhn", () => {
    expect(isValidSiren("552032534")).toBe(true);
    expect(isValidSiren("55203253")).toBe(false); // trop court
    expect(isValidSiren("123456789")).toBe(false); // Luhn KO
  });
  it("accepte le SIREN La Poste (exception)", () => {
    expect(isValidSiren("356000000")).toBe(true);
  });
});

describe("isValidSiret", () => {
  it("exige 14 chiffres + Luhn", () => {
    expect(isValidSiret("55203253400703")).toBe(true);
    expect(isValidSiret("552032534")).toBe(false); // trop court
    expect(isValidSiret("55203253400704")).toBe(false); // Luhn KO
  });
  it("tolère les espaces de saisie", () => {
    expect(isValidSiret("552 032 534 00703")).toBe(true);
  });
  it("accepte un SIRET La Poste via la règle « somme % 5 » (et pas Luhn)", () => {
    // SIREN 356000000 + NIC 00001 : somme des chiffres = 15 (multiple de 5).
    expect(isValidSiret("35600000000001")).toBe(true);
    expect(luhnCheck("35600000000001")).toBe(false);
  });
});

describe("detectLookupMode", () => {
  it("détecte le SIRET quand 14 chiffres (espaces tolérés)", () => {
    expect(detectLookupMode("552 032 534 00703")).toBe("siret");
  });
  it("retombe sur le nom sinon", () => {
    expect(detectLookupMode("Danone")).toBe("name");
    expect(detectLookupMode("5520")).toBe("name");
  });
});

describe("buildSearchUrl", () => {
  it("encode une recherche par nom avec pagination", () => {
    const url = buildSearchUrl("Café Lumen", "name");
    expect(url).toContain("q=Caf%C3%A9+Lumen");
    expect(url).toContain("per_page=10");
  });
  it("normalise le SIRET (chiffres uniquement)", () => {
    expect(buildSearchUrl("552 032 534 00703", "siret")).toContain(
      "q=55203253400703",
    );
  });
});

describe("libellés", () => {
  it("résout la forme juridique", () => {
    expect(formeJuridiqueLabel("5710")?.startsWith("SAS")).toBe(true);
    expect(formeJuridiqueLabel("0000-inexistant")).toBeNull();
    expect(formeJuridiqueLabel(null)).toBeNull();
  });
  it("résout le libellé NAF (format 2008)", () => {
    expect(nafLabel("62.01Z")).toBe("Programmation informatique");
    expect(nafLabel("62.01z")).toBe("Programmation informatique"); // casse
    expect(nafLabel("99.99Z")).toBeNull();
  });
});

const danone: CompanyResult = {
  siren: "552032534",
  nom_complet: "DANONE",
  nom_raison_sociale: "DANONE",
  nature_juridique: "5710",
  activite_principale: "70.10Z",
  siege: {
    siret: "55203253400703",
    adresse: "59-61 RUE LA FAYETTE 75009 PARIS",
    code_postal: "75009",
    libelle_commune: "PARIS",
    activite_principale: "70.10Z",
    est_siege: true,
  },
  matching_etablissements: [
    {
      siret: "55203253400123",
      adresse: "1 RUE DE L USINE 35000 RENNES",
      code_postal: "35000",
      libelle_commune: "RENNES",
      activite_principale: "10.51A",
    },
  ],
};

describe("pickEtablissement", () => {
  it("retourne le siège par défaut", () => {
    expect(pickEtablissement(danone)?.siret).toBe("55203253400703");
  });
  it("cible l'établissement correspondant au SIRET demandé", () => {
    expect(pickEtablissement(danone, "552 032 534 00123")?.siret).toBe(
      "55203253400123",
    );
  });
});

describe("mapCompanyToEnterprise", () => {
  it("mappe les champs depuis le siège par défaut", () => {
    const r = mapCompanyToEnterprise(danone);
    expect(r.name).toBe("DANONE");
    expect(r.siren).toBe("552032534");
    expect(r.codeNaf).toBe("70.10Z");
    expect(r.intituleNaf).toBe("Activités des sièges sociaux");
    expect(r.statusJuridiqueCode).toBe("5710");
    expect(r.statusJuridique?.startsWith("SAS")).toBe(true);
    expect(r.address).toEqual({
      address: "59-61 RUE LA FAYETTE 75009 PARIS",
      codePostal: "75009",
      pays: "France",
    });
  });

  it("utilise l'établissement ciblé par SIRET pour le NAF et l'adresse", () => {
    const r = mapCompanyToEnterprise(danone, "55203253400123");
    expect(r.codeNaf).toBe("10.51A");
    expect(r.address?.codePostal).toBe("35000");
  });

  it("recompose l'adresse quand le champ agrégé est absent", () => {
    const r = mapCompanyToEnterprise({
      siren: "111222333",
      nom_complet: "TEST",
      siege: {
        siret: "11122233300011",
        numero_voie: "10",
        type_voie: "RUE",
        libelle_voie: "DES LILAS",
        code_postal: "75010",
        libelle_commune: "PARIS",
      },
    });
    expect(r.address?.address).toBe("10 RUE DES LILAS, 75010 PARIS");
  });
});

describe("conventions collectives (IDCC, open data)", () => {
  const withIdcc: CompanyResult = {
    siren: "111222333",
    nom_complet: "TEST",
    siege: { siret: "11122233300011", liste_idcc: ["1486", "9999"] },
  };
  it("extrait les IDCC en ignorant 9999 (sans convention)", () => {
    expect(pickIdcc(withIdcc)).toEqual(["1486"]);
  });
  it("résout le libellé officiel d'un IDCC connu (open data DILA)", () => {
    const r = formatConventionFromCompany(withIdcc);
    expect(r).toContain("IDCC 1486");
    expect(r?.toLowerCase()).toContain("bureaux");
  });
  it("retombe sur « IDCC xxxx » pour un code inconnu", () => {
    expect(
      formatConventionFromCompany({ siege: { liste_idcc: ["0001"] } }),
    ).toBe("IDCC 0001");
  });
  it("renvoie null quand aucune convention", () => {
    expect(
      formatConventionFromCompany({ siege: { liste_idcc: ["9999"] } }),
    ).toBeNull();
  });
});

describe("mapCompanyToContractParty", () => {
  const withDirigeant: CompanyResult = {
    ...danone,
    dirigeants: [
      {
        nom: "BERNARD DE SAINT AFFRIQUE",
        prenoms: "ANTOINE",
        qualite: "Directeur Général",
        type_dirigeant: "personne physique",
      },
    ],
  };

  it("mappe les champs d'une partie au contrat (siège)", () => {
    const p = mapCompanyToContractParty(withDirigeant);
    expect(p.nom).toBe("DANONE");
    expect(p.siren).toBe("552032534");
    expect(p.forme_juridique?.startsWith("SAS")).toBe(true);
    expect(p.code_postal).toBe("75009");
    expect(p.ville).toBe("PARIS");
    expect(p.rcs_ville).toBe("PARIS");
  });

  it("formate le représentant légal et sa qualité depuis les dirigeants", () => {
    const p = mapCompanyToContractParty(withDirigeant);
    expect(p.representant).toBe("Antoine Bernard De Saint Affrique");
    expect(p.qualite).toBe("Directeur Général");
  });

  it("renvoie null pour représentant/qualité sans dirigeant", () => {
    const p = mapCompanyToContractParty(danone);
    expect(p.representant).toBeNull();
    expect(p.qualite).toBeNull();
  });

  it("cible l'établissement par SIRET (ville/CP)", () => {
    const p = mapCompanyToContractParty(danone, "55203253400123");
    expect(p.code_postal).toBe("35000");
    expect(p.ville).toBe("RENNES");
  });
});
