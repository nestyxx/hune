import { describe, expect, it } from "vitest";
import { natureYahoo, nomConnu, symboleAffiche } from "./noms-affiches";

const y = (symbole: string) => ({ source: "yahoo" as const, symbole });

describe("noms affichés", () => {
  it("retire les codes techniques des symboles", () => {
    expect(symboleAffiche(y("^FCHI"))).toBe("FCHI");
    expect(symboleAffiche(y("GC=F"))).toBe("GC");
    expect(symboleAffiche(y("EURUSD=X"))).toBe("EUR/USD");
    expect(symboleAffiche(y("MC.PA"))).toBe("MC.PA");
    expect(symboleAffiche({ source: "binance", symbole: "BTCUSDT" })).toBe("BTCUSDT");
  });
  it("connaît le nom des indices et matières premières courants", () => {
    expect(nomConnu(y("^FCHI"))).toBe("CAC 40");
    expect(nomConnu(y("GC=F"))).toBe("Or");
    expect(nomConnu(y("AAPL"))).toBeNull();
  });
  it("distingue la nature d'un symbole", () => {
    expect(natureYahoo(y("^GSPC"))).toBe("indice");
    expect(natureYahoo(y("CL=F"))).toBe("matiere");
    expect(natureYahoo(y("EURUSD=X"))).toBe("devise");
    expect(natureYahoo(y("BTC-USD"))).toBe("crypto");
    expect(natureYahoo(y("AAPL"))).toBe("titre");
  });
});
