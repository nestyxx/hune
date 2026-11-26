import { describe, expect, it } from "vitest";
import { nettoyerNom, nomAffiche, nomEstUnePaire } from "./noms-cryptos";

describe("noms des cryptos", () => {
  it("retire la devise de cotation du nom Yahoo", () => {
    expect(nettoyerNom("Bitcoin USD")).toBe("Bitcoin");
    expect(nettoyerNom("Artificial Superintelligence Alliance USD")).toBe("Artificial Superintelligence Alliance");
    expect(nettoyerNom("Solana")).toBe("Solana");
  });
  it("reconnaît un libellé qui n'est qu'une paire", () => {
    expect(nomEstUnePaire("BTC/USDC")).toBe(true);
    expect(nomEstUnePaire("Take-Two Interactive")).toBe(false);
  });
  it("garde le nom de la source tant que le vrai nom n'est pas connu, et pour les titres", () => {
    expect(nomAffiche({ source: "binance", symbole: "ZZZUSDC", nom: "ZZZ/USDC" })).toBe("ZZZ/USDC");
    expect(nomAffiche({ source: "yahoo", symbole: "AAPL", nom: "Apple" })).toBe("Apple");
  });
});
