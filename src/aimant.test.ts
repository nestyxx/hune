import { describe, expect, it } from "vitest";
import { aimanter } from "./aimant";

// Échelle de test : 1 unité de prix = 2 pixels (l'ordonnée décroît quand le prix monte, sans importance ici).
const versPixel = (p: number) => 1000 - p * 2;
const bougie = { ouverture: 100, haut: 110, bas: 95, cloture: 105 };

describe("aimanter", () => {
  it("se cale sur la valeur la plus proche si elle est à moins de 10 px", () => {
    expect(aimanter(bougie, 108, versPixel)).toBe(110); // 4 px du plus haut, 6 px de la clôture
    expect(aimanter(bougie, 96.5, versPixel)).toBe(95); // 3 px du plus bas
  });
  it("garde le prix hors de portée de l'aimant", () => {
    expect(aimanter(bougie, 120, versPixel)).toBe(120);
    expect(aimanter(bougie, 102.5, versPixel)).toBe(100); // 5 px de l'ouverture, 5 px de la clôture : l'ouverture, testée en premier
  });
  it("ne fait rien sans bougie ou sans échelle", () => {
    expect(aimanter(undefined, 108, versPixel)).toBe(108);
    expect(aimanter(bougie, 108, () => null)).toBe(108);
  });
});
