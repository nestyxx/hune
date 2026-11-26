import { describe, expect, it } from "vitest";
import { baseCrypto, initiales, teinte } from "./icones";

const binance = (symbole: string, nom: string) => ({ source: "binance" as const, symbole, nom });
const yahoo = (symbole: string, nom = symbole) => ({ source: "yahoo" as const, symbole, nom });

describe("baseCrypto", () => {
  it("Binance : lit la base dans le nom « BASE/QUOTE »", () => {
    expect(baseCrypto(binance("BTCUSDC", "BTC/USDC"))).toBe("BTC");
    expect(baseCrypto(binance("ETHEUR", "ETH/EUR"))).toBe("ETH");
  });
  it("Binance : à défaut de nom exploitable, retire la devise de cotation", () => {
    expect(baseCrypto(binance("SOLUSDT", "Solana"))).toBe("SOL");
    expect(baseCrypto(binance("FETFDUSD", "x"))).toBe("FET");
    expect(baseCrypto(binance("USDT", "USDT"))).toBe("USDT"); // rien à retirer sans vider le symbole
  });
  it("Yahoo : reconnaît les paires crypto, pas les actions", () => {
    expect(baseCrypto(yahoo("BTC-USD"))).toBe("BTC");
    expect(baseCrypto(yahoo("CAPS-USD"))).toBe("CAPS");
    for (const action of ["AAPL", "MC.PA", "BRK-B", "OR.PA"]) expect(baseCrypto(yahoo(action))).toBeNull();
  });
});

describe("pastilles de repli", () => {
  it("initiales : 2 lettres pour un symbole court, 1 pour un long, sans le suffixe de place", () => {
    expect(initiales(yahoo("MC.PA", "LVMH"))).toBe("MC");
    expect(initiales(yahoo("AAPL"))).toBe("AA");
    expect(initiales(binance("ZZZZZZUSDT", "ZZZZZZ/USDT"))).toBe("Z");
  });
  it("la teinte est stable et dans [0, 360[", () => {
    expect(teinte("BTCUSDC")).toBe(teinte("BTCUSDC"));
    for (const s of ["", "A", "MC.PA", "FDJU.PA"]) expect(teinte(s)).toBeGreaterThanOrEqual(0);
    for (const s of ["", "A", "MC.PA", "FDJU.PA"]) expect(teinte(s)).toBeLessThan(360);
    expect(teinte("AAPL")).not.toBe(teinte("MSFT"));
  });
});
