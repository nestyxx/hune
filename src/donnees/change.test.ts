import { beforeEach, describe, expect, it, vi } from "vitest";

const yahoo = { cotations: vi.fn() };
const binance = { cotations: vi.fn() };
vi.mock("./index", () => ({ fournisseur: (s: string) => (s === "yahoo" ? yahoo : binance) }));

import { tauxVersEur } from "./change";

beforeEach(() => {
  yahoo.cotations.mockReset();
  binance.cotations.mockReset();
});

describe("tauxVersEur", () => {
  it("lit les taux de Yahoo et déduit les pence (GBp) de la livre", async () => {
    yahoo.cotations.mockResolvedValue([
      { symbole: "USDEUR=X", prix: 0.9, variationPct: null },
      { symbole: "GBPEUR=X", prix: 1.2, variationPct: null },
    ]);
    const t = await tauxVersEur(["USD", "GBP", "EUR"]);
    expect(t).toMatchObject({ EUR: 1, USD: 0.9, GBP: 1.2 });
    expect(t.GBp).toBeCloseTo(0.012);
    expect(binance.cotations).not.toHaveBeenCalled();
  });

  it("Yahoo en panne : le dollar se déduit de la paire EUR/USDC de Binance", async () => {
    yahoo.cotations.mockRejectedValue(new Error("CORS"));
    binance.cotations.mockResolvedValue([{ symbole: "EURUSDC", prix: 1.25, variationPct: 0 }]);
    const t = await tauxVersEur(["USD"]);
    expect(t.USD).toBeCloseTo(0.8);
    expect(binance.cotations).toHaveBeenCalledWith(["EURUSDC"]);
  });

  it("sans aucune source, la devise reste absente (le portefeuille affiche « — » au lieu d'un faux total)", async () => {
    yahoo.cotations.mockRejectedValue(new Error("CORS"));
    binance.cotations.mockRejectedValue(new Error("réseau"));
    expect(await tauxVersEur(["USD", "GBP"])).toEqual({ EUR: 1 });
  });

  it("n'interroge personne quand il n'y a que l'euro", async () => {
    expect(await tauxVersEur(["EUR"])).toEqual({ EUR: 1 });
    expect(yahoo.cotations).not.toHaveBeenCalled();
  });
});
