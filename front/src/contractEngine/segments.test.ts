import { describe, expect, it } from "vitest";
import { splitSegments } from "./segments";

describe("splitSegments", () => {
  it("sépare texte et variables inline", () => {
    expect(splitSegments("Bonjour {{nom}}, à {{ville}}.")).toEqual([
      { type: "text", text: "Bonjour " },
      { type: "var", name: "nom" },
      { type: "text", text: ", à " },
      { type: "var", name: "ville" },
      { type: "text", text: "." },
    ]);
  });
  it("gère l'absence de variable", () => {
    expect(splitSegments("Texte simple")).toEqual([{ type: "text", text: "Texte simple" }]);
  });
  it("gère une variable en tête", () => {
    expect(splitSegments("{{x}} suite")).toEqual([
      { type: "var", name: "x" },
      { type: "text", text: " suite" },
    ]);
  });
});
