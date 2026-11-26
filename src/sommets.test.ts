import { describe, expect, it } from "vitest";
import { detecterSommets, fenetreSommets } from "./sommets";

describe("fenetreSommets", () => {
  it("plus on dézoome (peu de pixels par bougie), plus la fenêtre est large ; bornée", () => {
    expect(fenetreSommets(20)).toBe(2);
    expect(fenetreSommets(8)).toBe(5);
    expect(fenetreSommets(2)).toBe(20);
    expect(fenetreSommets(0.1)).toBe(60);
    expect(fenetreSommets(0)).toBe(60);
  });
});

describe("detecterSommets", () => {
  // Une montagne puis une vallée : plus haut en 3 (10), plus bas en 8 (1).
  const hauts = [1, 3, 7, 10, 7, 4, 3, 2, 2, 4, 6, 8, 9, 9, 9, 9];
  const bas = hauts.map((h) => h - 1);

  it("repère le plus haut et le plus bas dominants dans leur fenêtre", () => {
    const s = detecterSommets(hauts, bas, 2, 0, 15);
    expect(s.find((x) => x.haut && x.indice === 3)?.prix).toBe(10);
    expect(s.find((x) => !x.haut && x.indice === 7)?.prix).toBe(1); // creux au milieu des bougies à 2
  });

  it("n'étiquette pas une bougie dont la fenêtre de droite n'est pas encore complète", () => {
    const s = detecterSommets(hauts, bas, 2, 0, 15);
    expect(s.some((x) => x.haut && x.indice >= 14 && x.prix === 9 && x.indice !== 11)).toBe(false);
  });

  it("à égalité de plusieurs bougies, ne garde que la première", () => {
    const s = detecterSommets([5, 9, 9, 5, 1, 1, 1, 1], [4, 8, 8, 4, 0, 0, 0, 0], 2, 0, 7);
    expect(s.filter((x) => x.haut && x.prix === 9).map((x) => x.indice)).toEqual([1]);
  });

  it("étiquette toujours le plus haut et le plus bas de la plage affichée", () => {
    const s = detecterSommets(hauts, bas, 30, 0, 15); // fenêtre énorme : aucun pivot classique complet
    expect(s.find((x) => x.haut)?.prix).toBe(10);
    expect(s.find((x) => !x.haut)?.prix).toBe(0);
  });

  it("ne regarde que la plage demandée et gère les cas limites", () => {
    const s = detecterSommets(hauts, bas, 2, 8, 15);
    expect(s.every((x) => x.indice >= 8)).toBe(true);
    expect(detecterSommets([], [], 2, 0, 5)).toEqual([]);
    expect(detecterSommets([1, 2], [0, 1], 2, -5, 99).length).toBeGreaterThan(0);
  });
});
