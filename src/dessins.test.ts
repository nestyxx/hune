import { describe, expect, it } from "vitest";
import { distanceSegment, indiceDepuisTemps, prixFibonacci, prolongement, tempsDepuisIndice } from "./dessins";
import { niveauxPortefeuille, type Position } from "./portefeuille";

const T = [1000, 1100, 1200, 1300]; // bougies toutes les 100 s

describe("temps ↔ indice", () => {
  it("retrouve l'indice d'une bougie et interpole entre deux", () => {
    expect(indiceDepuisTemps(T, 1200, 100)).toBe(2);
    expect(indiceDepuisTemps(T, 1150, 100)).toBe(1.5);
  });
  it("extrapole au pas hors des bougies (futur et passé)", () => {
    expect(indiceDepuisTemps(T, 1500, 100)).toBe(5);
    expect(indiceDepuisTemps(T, 800, 100)).toBe(-2);
  });
  it("l'aller-retour est exact, y compris hors des bougies", () => {
    for (const t of [800, 1000, 1100, 1250, 1300, 1700]) expect(tempsDepuisIndice(T, indiceDepuisTemps(T, t, 100), 100)).toBe(t);
  });
  it("gère une liste vide", () => {
    expect(indiceDepuisTemps([], 5, 100)).toBe(0);
    expect(tempsDepuisIndice([], 3, 100)).toBe(0);
  });
});

describe("géométrie", () => {
  it("distance à un segment : sur la droite, au-delà de l'extrémité, point confondu", () => {
    expect(distanceSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distanceSegment(13, 4, 0, 0, 10, 0)).toBe(5);
    expect(distanceSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
  it("prolonge un rayon vers le bord dans le sens du tracé", () => {
    expect(prolongement(0, 100, 10, 90, 110)).toEqual({ x: 110, y: -10 });
    expect(prolongement(100, 0, 90, 10, 110)).toEqual({ x: 0, y: 100 });
    expect(prolongement(5, 5, 5, 20, 110)).toEqual({ x: 5, y: 20 });
  });
  it("Fibonacci : 0 au point d'arrivée, 1 au point de départ", () => {
    const a = { temps: 1, prix: 100 };
    const b = { temps: 2, prix: 200 };
    expect(prixFibonacci(a, b, 0)).toBe(200);
    expect(prixFibonacci(a, b, 1)).toBe(100);
    expect(prixFibonacci(a, b, 0.5)).toBe(150);
  });
});

describe("niveauxPortefeuille", () => {
  const lot = (p: Partial<Position>): Position => ({ id: Math.random().toString(), cle: "binance:X", ...p });
  it("rien à tracer sans PAMP, objectif ni mouvement", () => {
    expect(niveauxPortefeuille([lot({ quantite: 1 })])).toBeNull();
    expect(niveauxPortefeuille([])).toBeNull();
  });
  it("PAMP pondéré, objectif, un niveau d'achat par lot sans historique", () => {
    const n = niveauxPortefeuille([lot({ quantite: 1, pamp: 100, plateforme: "A", objectif: 300 }), lot({ quantite: 3, pamp: 200 })])!;
    expect(n.pamp).toBe(175);
    expect(n.objectif).toBe(300);
    expect(n.achats).toEqual([{ prix: 100, quantite: 1, plateforme: "A" }, { prix: 200, quantite: 3, plateforme: undefined }]);
  });
  it("un lot unique n'ajoute pas de niveau d'achat (confondu avec le PAMP)", () => {
    const n = niveauxPortefeuille([lot({ quantite: 1, pamp: 100, plateforme: "A" })])!;
    expect(n.pamp).toBe(100);
    expect(n.achats).toEqual([]);
  });
  it("un lot avec historique n'ajoute pas de niveau d'achat mais ses mouvements, triés", () => {
    const m = (date: number) => ({ date, sens: "achat" as const, quantite: 1, prix: 10 });
    const n = niveauxPortefeuille([lot({ quantite: 2, pamp: 10, mouvements: [m(5), m(1)] }), lot({ quantite: 1, pamp: 12, mouvements: [m(3)] })])!;
    expect(n.achats).toEqual([]);
    expect(n.mouvements.map((x) => x.date)).toEqual([1, 3, 5]);
  });
});
