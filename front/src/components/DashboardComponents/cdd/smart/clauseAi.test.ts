import { describe, expect, it } from "vitest";
import { clauseInstructionPrompt, conventionPrompt } from "./clauseAi";

describe("clauseInstructionPrompt", () => {
  it("inclut la clause et la consigne libre", () => {
    const p = clauseInstructionPrompt("Texte de la clause", "ajoute un préavis de 8 jours");
    expect(p).toContain("Texte de la clause");
    expect(p).toContain("ajoute un préavis de 8 jours");
    expect(p).toContain("UNIQUEMENT avec le texte de la clause");
  });
  it("conserve la consigne de conformité légale", () => {
    const p = clauseInstructionPrompt("X", "reformule");
    expect(p).toContain("conformité légale");
  });
});

describe("conventionPrompt", () => {
  it("inclut convention, poste et NAF", () => {
    const p = conventionPrompt("Syntec", "Développeur", "62.01Z");
    expect(p).toContain("Syntec");
    expect(p).toContain("Développeur");
    expect(p).toContain("62.01Z");
  });
  it("gère les champs manquants proprement", () => {
    const p = conventionPrompt("", "", "");
    expect(p).toContain("non précisée");
    expect(p).toContain("non précisé");
  });
});
