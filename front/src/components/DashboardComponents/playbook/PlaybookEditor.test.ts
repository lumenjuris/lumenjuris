import { describe, expect, it } from "vitest";
import { texteVersHtml } from "./PlaybookEditor";

describe("texteVersHtml", () => {
  const texte = "Article 2 — Durée\nLa cession est consentie pour 5 ans.\n\nFin.";

  it("une ligne = un paragraphe, les titres d'article deviennent des intertitres", () => {
    const html = texteVersHtml(texte, [], null);
    expect(html).toBe("<h2>Article 2 — Durée</h2><p>La cession est consentie pour 5 ans.</p><p></p><p>Fin.</p>");
  });

  it("surligne le passage de la règle, cliquable par son identifiant", () => {
    const debut = texte.indexOf("5 ans");
    const html = texteVersHtml(texte, [{ debut, fin: debut + 5, ruleId: "r1", couleur: "rouge" }], null);
    expect(html).toContain('<span data-pb-rule="r1"');
    expect(html).toContain(">5 ans</span>");
  });

  it("un passage sur deux lignes est surligné sur chacune", () => {
    const debut = texte.indexOf("Durée");
    const fin = texte.indexOf("consentie");
    const html = texteVersHtml(texte, [{ debut, fin, ruleId: "r2", couleur: "bleu" }], null);
    expect(html.match(/data-pb-rule="r2"/g)?.length).toBe(2);
  });

  it("échappe le HTML du contrat", () => {
    expect(texteVersHtml("a < b & c", [], null)).toBe("<p>a &lt; b &amp; c</p>");
  });
});
