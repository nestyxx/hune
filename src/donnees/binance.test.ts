import { afterEach, describe, expect, it, vi } from "vitest";
import { Binance } from "./binance";

/** Remplace `fetch` : renvoie un ticker par symbole demandé et garde la trace des URL appelées. */
function simulerBinance() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const symboles = JSON.parse(new URL(url).searchParams.get("symbols")!) as string[];
      const pct = url.includes("/tradingDay") ? "2.5" : "5.5";
      return { ok: true, json: async () => symboles.map((symbol) => ({ symbol, lastPrice: "10", priceChangePercent: pct })) };
    }),
  );
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Binance.cotations : définition de la variation", () => {
  it("24h glissantes par défaut (/ticker/24hr)", async () => {
    const urls = simulerBinance();
    const [c] = await new Binance().cotations(["AAAUSDT"]);
    expect(urls[0]).toContain("/ticker/24hr");
    expect(c.variationPct).toBe(5.5);
  });

  it("« jour » : depuis l'ouverture du jour UTC (/ticker/tradingDay)", async () => {
    const urls = simulerBinance();
    const [c] = await new Binance().cotations(["BBBUSDT"], "jour");
    expect(urls[0]).toContain("/ticker/tradingDay");
    expect(c.variationPct).toBe(2.5);
  });

  it("découpe les listes de plus de 100 symboles (limite de l'API) sans en perdre", async () => {
    const urls = simulerBinance();
    const symboles = Array.from({ length: 230 }, (_, i) => `S${String(i).padStart(3, "0")}USDT`);
    const rep = await new Binance().cotations(symboles, "jour");
    expect(urls).toHaveLength(3);
    expect(rep.map((c) => c.symbole).sort()).toEqual([...symboles].sort());
  });
});
