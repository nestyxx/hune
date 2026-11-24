import { describe, expect, it } from "vitest";
import { agreger } from "./agreger";
import type { Bougie } from "./types";

const b = (temps: number, o: number, h: number, l: number, c: number, volume = 1): Bougie => ({ temps, ouverture: o, haut: h, bas: l, cloture: c, volume });

describe("agreger", () => {
  it("regroupe 4 bougies d'1 h en une bougie de 4 h", () => {
    const H = 3600;
    const r = agreger([b(0, 10, 12, 9, 11), b(H, 11, 15, 10, 14), b(2 * H, 14, 14, 8, 9), b(3 * H, 9, 10, 9, 10, 2), b(4 * H, 10, 11, 10, 11)], 4 * H);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ temps: 0, ouverture: 10, haut: 15, bas: 8, cloture: 10, volume: 5 });
    expect(r[1].temps).toBe(4 * H);
  });
});
