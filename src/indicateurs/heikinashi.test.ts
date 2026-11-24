import { describe, expect, it } from "vitest";
import type { Bougie } from "../donnees/types";
import { heikinAshi } from "./heikinashi";

const b = (temps: number, o: number, h: number, l: number, c: number): Bougie => ({ temps, ouverture: o, haut: h, bas: l, cloture: c, volume: 1 });

describe("Heikin-Ashi", () => {
  it("calcule clôture = moyenne OHLC et ouverture = milieu de la bougie HA précédente", () => {
    const r = heikinAshi([b(0, 10, 14, 8, 12), b(1, 12, 16, 11, 15)]);
    expect(r[0].cloture).toBeCloseTo((10 + 14 + 8 + 12) / 4, 10); // 11
    expect(r[0].ouverture).toBeCloseTo(11, 10); // (10+12)/2
    expect(r[1].ouverture).toBeCloseTo((r[0].ouverture + r[0].cloture) / 2, 10); // 11
    expect(r[1].cloture).toBeCloseTo((12 + 16 + 11 + 15) / 4, 10); // 13,5
  });
  it("haut et bas englobent toujours le corps", () => {
    for (const x of heikinAshi([b(0, 10, 11, 9, 10.5), b(1, 10.5, 10.6, 8, 8.2), b(2, 8.2, 12, 8.1, 11.9)])) {
      expect(x.haut).toBeGreaterThanOrEqual(Math.max(x.ouverture, x.cloture));
      expect(x.bas).toBeLessThanOrEqual(Math.min(x.ouverture, x.cloture));
    }
  });
});
