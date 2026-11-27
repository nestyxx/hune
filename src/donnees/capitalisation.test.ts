import { describe, expect, it } from "vitest";
import { calculerCapitalisation } from "./capitalisation";

const reponse = { data: { total_market_cap: { usd: 2_000_000_000_000 }, market_cap_percentage: { btc: 58, eth: 10 }, market_cap_change_percentage_24h_usd: -3.8, updated_at: 1_700_000_000 } };

describe("calculerCapitalisation", () => {
  it("déduit le total sans Bitcoin et sans Bitcoin ni Ethereum des parts de marché", () => {
    const c = calculerCapitalisation(reponse)!;
    expect(c.total).toBe(2_000_000_000_000);
    expect(c.total2).toBeCloseTo(840_000_000_000, -3);
    expect(c.total3).toBeCloseTo(640_000_000_000, -3);
    expect(c.dominanceBtc).toBe(58);
    expect(c.variation24h).toBe(-3.8);
    expect(c.majLe).toBe(1_700_000_000_000);
  });
  it("renvoie null si la réponse est incomplète ou invalide", () => {
    expect(calculerCapitalisation({})).toBeNull();
    expect(calculerCapitalisation({ data: { total_market_cap: { usd: 0 }, market_cap_percentage: { btc: 50, eth: 10 } } })).toBeNull();
    expect(calculerCapitalisation({ data: { total_market_cap: { usd: 1e12 }, market_cap_percentage: { btc: 50 } } })).toBeNull();
  });
  it("tolère l'absence de variation sur 24 h", () => {
    const { market_cap_change_percentage_24h_usd: _, ...reste } = reponse.data;
    expect(calculerCapitalisation({ data: reste })?.variation24h).toBeNull();
  });
});
