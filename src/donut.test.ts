import { describe, expect, it } from "vitest";
import { segmentsDonut } from "./donut";

describe("segmentsDonut", () => {
  it("répartit la circonférence au prorata et chaîne les segments", () => {
    const s = segmentsDonut([1, 1, 2], 100);
    expect(s.map((x) => x.longueur)).toEqual([25, 25, 50]);
    expect(s.map((x) => x.decalage)).toEqual([-0, -25, -50]);
  });
  it("un seul segment couvre tout l'anneau", () => {
    expect(segmentsDonut([42], 200)).toEqual([{ longueur: 200, decalage: -0 }]);
  });
  it("ignore les parts négatives et gère le total nul", () => {
    expect(segmentsDonut([-5, 5], 10).map((x) => x.longueur)).toEqual([0, 10]);
    expect(segmentsDonut([0, 0], 10)).toEqual([{ longueur: 0, decalage: 0 }, { longueur: 0, decalage: 0 }]);
    expect(segmentsDonut([], 10)).toEqual([]);
  });
});
