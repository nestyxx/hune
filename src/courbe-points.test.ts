import { describe, expect, it } from "vitest";
import { courbeMonte, pointsCourbe } from "./courbe-points";

describe("pointsCourbe", () => {
  it("place le minimum en bas et le maximum en haut du cadre, avec une marge", () => {
    // Cadre 10 × 10, marge 2 : x de 2 à 8, y de 8 (min) à 2 (max).
    expect(pointsCourbe([0, 5, 10], 10, 10)).toBe("2.0,8.0 5.0,5.0 8.0,2.0");
  });
  it("une courbe plate est tracée au milieu", () => {
    expect(pointsCourbe([3, 3, 3], 10, 10)).toBe("2.0,5.0 5.0,5.0 8.0,5.0");
  });
  it("trop peu de points ou valeurs invalides : rien à tracer", () => {
    expect(pointsCourbe([], 10, 10)).toBe("");
    expect(pointsCourbe([1], 10, 10)).toBe("");
    expect(pointsCourbe([1, NaN], 10, 10)).toBe("");
  });
});

describe("courbeMonte", () => {
  it("compare la fin au début", () => {
    expect(courbeMonte([1, 5, 2])).toBe(true);
    expect(courbeMonte([5, 9, 4])).toBe(false);
    expect(courbeMonte([4, 4])).toBe(true);
    expect(courbeMonte([])).toBe(true);
  });
});
