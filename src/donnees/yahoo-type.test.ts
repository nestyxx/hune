import { describe, expect, it } from "vitest";
import { libelleType } from "./yahoo";

describe("libelleType (recherche Yahoo)", () => {
  it("garde actions, ETF et indices", () => {
    expect(libelleType("EQUITY", "AAPL")).toBe("Action");
    expect(libelleType("ETF", "CAC.PA")).toBe("ETF");
    expect(libelleType("INDEX", "^FCHI")).toBe("Indice");
  });
  it("matières premières et devises : symboles continus seulement", () => {
    expect(libelleType("FUTURE", "GC=F")).toBe("Matière première");
    expect(libelleType("FUTURE", "M6EZ26.CME")).toBeNull();
    expect(libelleType("CURRENCY", "EURUSD=X")).toBe("Devise");
    expect(libelleType("CURRENCY", "EURUSD")).toBeNull();
  });
  it("ignore le reste (cryptos, fonds, inconnu)", () => {
    expect(libelleType("CRYPTOCURRENCY", "BTC-USD")).toBeNull();
    expect(libelleType("MUTUALFUND", "XXX")).toBeNull();
    expect(libelleType(undefined, "X")).toBeNull();
  });
});
