import { describe, expect, it } from "vitest";
import { bourseDe, detailTitre, natureYahoo, nomConnu, nomCourt, symboleAffiche } from "./noms-affiches";

const y = (symbole: string, nom?: string) => ({ source: "yahoo" as const, symbole, ...(nom ? { nom } : {}) });

describe("noms affichés", () => {
  it("retire les codes techniques des symboles", () => {
    expect(symboleAffiche(y("^FCHI"))).toBe("CAC 40");
    expect(symboleAffiche(y("^INCONNU"))).toBe("INCONNU");
    expect(symboleAffiche(y("EUR=X"))).toBe("USD/EUR");
    expect(symboleAffiche(y("GC=F"))).toBe("GC");
    expect(symboleAffiche(y("EURUSD=X"))).toBe("EUR/USD");
    expect(symboleAffiche({ source: "binance", symbole: "BTCUSDT" })).toBe("BTCUSDT");
  });
  it("affiche le nom court d'une action plutôt que son code", () => {
    expect(symboleAffiche(y("9868.HK", "XPeng Inc."))).toBe("XPeng");
    expect(symboleAffiche(y("OVH.PA", "OVH Groupe SA"))).toBe("OVHcloud");
    expect(symboleAffiche(y("KO", "The Coca-Cola Company"))).toBe("Coca-Cola");
    expect(symboleAffiche(y("BABA", "Alibaba Group (ADR)"))).toBe("Alibaba");
    expect(symboleAffiche(y("ANT", "Anthropic, PBC"))).toBe("Anthropic");
    expect(symboleAffiche(y("MC.PA"))).toBe("LVMH");
    expect(symboleAffiche(y("ZZZ.PA"))).toBe("ZZZ.PA"); // pas de nom connu : on garde le code
    expect(symboleAffiche(y("XYZ", "XYZ"))).toBe("XYZ");
  });
  it("nomCourt garde un nom qui n'a rien à retirer", () => {
    expect(nomCourt("Capgemini SE")).toBe("Capgemini");
    expect(nomCourt("La Française des Jeux")).toBe("La Française des Jeux");
    expect(nomCourt("Inc")).toBe("Inc");
  });
  it("explique le suffixe de place", () => {
    expect(bourseDe(y("OVH.PA"))?.court).toBe("Paris");
    expect(bourseDe(y("9868.HK"))?.nom).toBe("Bourse de Hong Kong");
    expect(bourseDe(y("AAPL"))).toBeNull();
    expect(detailTitre(y("OVH.PA"))).toBe("OVH.PA · Paris");
    expect(detailTitre(y("AAPL"))).toBe("AAPL");
    expect(detailTitre(y("^FCHI"))).toBeNull();
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
