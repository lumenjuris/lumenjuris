import { describe, expect, it } from "vitest";
import { appliquerSuggestion } from "./appliquerSuggestion";

describe("appliquerSuggestion", () => {
  const contrat = "Article 3.\nLa cession  est consentie pour 5 ans.\nArticle 4.";

  it("remplace le passage cité, malgré des espaces différents", () => {
    expect(appliquerSuggestion(contrat, "La cession est consentie pour 5 ans.", "La cession est consentie pour 24 mois."))
      .toBe("Article 3.\nLa cession est consentie pour 24 mois.\nArticle 4.");
  });

  it("tolère les apostrophes typographiques", () => {
    expect(appliquerSuggestion("L’artiste cède.", "L'artiste cède.", "X")).toBe("X");
  });

  it("ne touche à rien si le passage est introuvable", () => {
    expect(appliquerSuggestion(contrat, "Cession pour 99 ans.", "X")).toBeNull();
    expect(appliquerSuggestion(contrat, "", "X")).toBeNull();
  });
});
