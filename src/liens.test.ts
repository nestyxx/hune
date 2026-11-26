import { describe, expect, it } from "vitest";
import { liensExternes } from "./liens";

describe("liensExternes", () => {
  it("action Yahoo : actualités et fiche Yahoo Finance, symbole encodé", () => {
    const l = liensExternes({ source: "yahoo", symbole: "MC.PA", nom: "LVMH" });
    expect(l.map((x) => x.url)).toEqual(["https://finance.yahoo.com/quote/MC.PA/news/", "https://finance.yahoo.com/quote/MC.PA/"]);
  });

  it("crypto Binance connue : actualités Yahoo (BASE-USD) et fiche CoinMarketCap", () => {
    const l = liensExternes({ source: "binance", symbole: "FETUSDC", nom: "FET/USDC" });
    expect(l[0].url).toBe("https://finance.yahoo.com/quote/FET-USD/news/");
    expect(l[1]).toMatchObject({ libelle: "CoinMarketCap", url: "https://coinmarketcap.com/currencies/artificial-superintelligence-alliance/" });
  });

  it("crypto inconnue : recherche CoinGecko à défaut de fiche", () => {
    const l = liensExternes({ source: "binance", symbole: "ZZZUSDC", nom: "ZZZ/USDC" });
    expect(l[1].url).toBe("https://www.coingecko.com/en/search?query=ZZZ");
  });

  it("crypto Yahoo (BTC-USD) traitée comme une crypto", () => {
    const l = liensExternes({ source: "yahoo", symbole: "BTC-USD", nom: "Bitcoin USD" });
    expect(l[1].url).toBe("https://coinmarketcap.com/currencies/bitcoin/");
  });
});
