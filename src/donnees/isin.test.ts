import { describe, expect, it } from "vitest";
import { isinValide, ressembleAIsin } from "./isin";

describe("ISIN", () => {
  it("accepte des ISIN réels (clé de contrôle correcte)", () => {
    for (const isin of ["FR0000121014", "US0378331005", "IE00B4L5Y983", "DE0007164600", "fr0000121014"]) expect(isinValide(isin), isin).toBe(true);
  });
  it("refuse une clé de contrôle fausse", () => {
    expect(isinValide("FR0000121015")).toBe(false);
    expect(isinValide("US0378331006")).toBe(false);
  });
  it("refuse ce qui n'a pas la forme d'un ISIN", () => {
    for (const s of ["BTC", "AAPL", "FR000012101", "1R0000121014", "FR00001210144"]) expect(isinValide(s), s).toBe(false);
  });
  it("détecte la forme sans vérifier la clé", () => {
    expect(ressembleAIsin(" fr0000121015 ")).toBe(true);
    expect(ressembleAIsin("MC.PA")).toBe(false);
  });
});
