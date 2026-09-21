import { describe, expect, it } from "vitest";
import { trouverParties, valeurPourChamp, valeursDuProfil, valeursSirene } from "./prefill";
import type { UserData } from "../../types/userData";
import type { CompanyResult } from "../../types/companySearch";

describe("trouverParties", () => {
  it("reconnaît les parties d'un contrat rédigé par l'IA (convention <role>_<donnee>)", () => {
    const parties = trouverParties([
      { id: "prestataire_denomination" }, { id: "prestataire_siret" }, { id: "prestataire_adresse" },
      { id: "client_denomination" }, { id: "client_siren" }, { id: "client_email" },
      { id: "date_signature" }, { id: "montant_mensuel" },
    ]);
    expect(parties.map((p) => p.prefixe)).toEqual(["prestataire", "client"]);
    expect(parties[0].libelle).toBe("Prestataire");
    expect(parties[1].champs.map((c) => c.donnee)).toEqual(["denomination", "siren", "email"]);
  });

  it("reconnaît les anciens modèles à champs fixes, y compris rcs_ville (et pas « ville »)", () => {
    const [partie] = trouverParties([
      { id: "partie_1_nom" }, { id: "partie_1_rcs_ville" }, { id: "partie_1_ville" }, { id: "partie_1_code_postal" },
    ]);
    expect(partie.libelle).toBe("La première partie");
    expect(partie.champs.map((c) => c.donnee)).toEqual(["denomination", "rcs", "ville", "code_postal"]);
  });

  it("ignore un groupe sans identité d'entreprise (pas de recherche sur une date ou un tribunal)", () => {
    expect(trouverParties([{ id: "tribunal_ville" }, { id: "tribunal_adresse" }])).toEqual([]);
  });
});

describe("valeurPourChamp", () => {
  const [g] = trouverParties([{ id: "client_denomination" }, { id: "client_adresse" }, { id: "client_code_postal" }]);
  const adresse = g.champs.find((c) => c.donnee === "adresse")!;

  it("retire le code postal et la ville de l'adresse quand ils ont leurs propres champs", () => {
    expect(valeurPourChamp(g, adresse, { adresse: "17 BD HAUSSMANN, 75009 PARIS", code_postal: "75009" })).toBe("17 BD HAUSSMANN");
  });

  it("garde l'adresse complète quand le contrat n'a qu'un champ adresse", () => {
    const [seul] = trouverParties([{ id: "client_denomination" }, { id: "client_adresse" }]);
    const champ = seul.champs.find((c) => c.donnee === "adresse")!;
    expect(valeurPourChamp(seul, champ, { adresse: "17 BD HAUSSMANN, 75009 PARIS", code_postal: "75009" })).toBe("17 BD HAUSSMANN, 75009 PARIS");
  });
});

describe("valeursDuProfil", () => {
  it("reprend la fiche entreprise, le nom de l'utilisateur comme représentant, son e-mail et son téléphone", () => {
    const user = {
      enterprise: { name: "Lumen Juris", statusJuridique: "SAS", siren: "123456789", address: { address: "1 rue X", codePostal: "75001", pays: "FRANCE" } },
      profile: { prenom: "Geoffrey", nom: "Pin", email: "g@example.fr" },
    } as unknown as UserData;
    expect(valeursDuProfil(user, "01 23 45 67 89")).toEqual({
      denomination: "Lumen Juris", forme_juridique: "SAS", siren: "123456789", adresse: "1 rue X",
      code_postal: "75001", representant: "Geoffrey Pin", email: "g@example.fr", telephone: "01 23 45 67 89",
    });
  });

  it("n'invente rien quand la fiche est vide", () => {
    expect(valeursDuProfil(null, null)).toEqual({});
  });
});

describe("valeursSirene", () => {
  it("reprend SIRET du siège, adresse, ville, greffe et dirigeant", () => {
    const danone = {
      siren: "552032534", nom_complet: "DANONE", nature_juridique: "5599",
      siege: { siret: "55203253400703", adresse: "17 BD HAUSSMANN 75009 PARIS", code_postal: "75009", libelle_commune: "PARIS" },
      dirigeants: [{ nom: "SAINT-AFFRIQUE", prenoms: "ANTOINE", qualite: "Directeur Général", type_dirigeant: "personne physique" }],
    } as CompanyResult;
    const v = valeursSirene(danone);
    expect(v.siret).toBe("55203253400703");
    expect(v.ville).toBe("PARIS");
    expect(v.rcs).toBe("PARIS");
    expect(v.representant).toBe("Antoine Saint-Affrique");
    expect(v.qualite).toBe("Directeur Général");
  });
});
