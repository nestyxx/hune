import { describe, expect, it } from "vitest";
import { espaceOrdinaire, formaterPrix } from "./format";

describe("espaceOrdinaire", () => {
  it("remplace les espaces insécables, fines ou non, par une espace ordinaire", () => {
    expect(espaceOrdinaire("24 196 €")).toBe("24 196 €");
  });
  it("ne touche pas au reste", () => {
    expect(espaceOrdinaire("1 253,50")).toBe("1 253,50");
  });
});

describe("formaterPrix", () => {
  it("n'utilise que des espaces ordinaires pour les milliers (toutes les polices les dessinent)", () => {
    const s = formaterPrix(59773.23);
    expect(s).toBe("59 773,23");
    expect(s).not.toMatch(/[  ]/);
  });
  it("adapte les décimales à l'ordre de grandeur", () => {
    expect(formaterPrix(0.00001234)).toContain("0,00001234");
    expect(formaterPrix(null)).toBe("—");
  });
});
