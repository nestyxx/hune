import { describe, expect, it } from "vitest";
import type { Bougie } from "./donnees/types";
import { PERIODES_PORTEFEUILLE, periodeValide, quantiteA, recupererBougies, specPeriode, valeurDansLeTemps, type EntreeHistorique } from "./historique-portefeuille";
import type { Position } from "./portefeuille";

const b = (temps: number, cloture: number): Bougie => ({ temps, ouverture: cloture, haut: cloture, bas: cloture, cloture, volume: 0 });
const lot = (p: Partial<Position>): Position => ({ id: "x", cle: "binance:A", ...p });
const entree = (cle: string, devise: string | null, lots: Position[]): EntreeHistorique => ({ cle, source: "binance", symbole: cle.toUpperCase(), devise, lots });

describe("quantiteA", () => {
  it("lot sans historique : la quantité actuelle, constante", () => {
    expect(quantiteA([lot({ quantite: 2 }), lot({ quantite: 1 })], 0)).toBe(3);
  });
  it("lot avec historique : cumule achats et ventes jusqu'à l'instant", () => {
    const l = lot({ quantite: 1, mouvements: [{ date: 1000, sens: "achat", quantite: 3, prix: 1 }, { date: 2000, sens: "vente", quantite: 2, prix: 1 }] });
    expect(quantiteA([l], 500)).toBe(0);
    expect(quantiteA([l], 1000)).toBe(3);
    expect(quantiteA([l], 2500)).toBe(1);
  });
  it("ne descend jamais sous zéro (historique incomplet)", () => {
    expect(quantiteA([lot({ mouvements: [{ date: 1, sens: "vente", quantite: 5, prix: 1 }] })], 10)).toBe(0);
  });
});

describe("valeurDansLeTemps", () => {
  it("somme quantité × cours × taux, avec dernier cours conservé entre deux bougies", () => {
    const e = [entree("a", "USD", [lot({ quantite: 2 })]), entree("b", "EUR", [lot({ quantite: 10 })])];
    // a : bougies à 100 et 300 ; b : bougies à 100, 200, 300. Taux : 1 USD = 0,5 €.
    const bougies = { a: [b(100, 10), b(300, 20)], b: [b(100, 1), b(200, 2), b(300, 3)] };
    const r = valeurDansLeTemps(e, bougies, { EUR: 1, USD: 0.5 }, null, 1000);
    expect(r.points).toEqual([
      { temps: 100, valeurEur: 2 * 10 * 0.5 + 10 * 1 },
      { temps: 200, valeurEur: 2 * 10 * 0.5 + 10 * 2 }, // a garde son cours de 100
      { temps: 300, valeurEur: 2 * 20 * 0.5 + 10 * 3 },
    ]);
    expect(r.ignores).toEqual([]);
  });

  it("un actif ne compte pas avant sa première bougie", () => {
    const r = valeurDansLeTemps([entree("a", "EUR", [lot({ quantite: 1 })]), entree("b", "EUR", [lot({ quantite: 1 })])], { a: [b(100, 5), b(200, 5)], b: [b(200, 7)] }, { EUR: 1 }, null, 1000);
    expect(r.points.map((p) => p.valeurEur)).toEqual([5, 12]);
  });

  it("respecte la fenêtre [debut, fin]", () => {
    const r = valeurDansLeTemps([entree("a", "EUR", [lot({ quantite: 1 })])], { a: [b(100, 1), b(200, 2), b(300, 3)] }, { EUR: 1 }, 150, 250);
    expect(r.points.map((p) => p.temps)).toEqual([200]);
  });

  it("signale les actifs sans bougies ou sans taux de change au lieu de fausser le total", () => {
    const r = valeurDansLeTemps([entree("a", "EUR", [lot({ quantite: 1 })]), entree("b", "USD", [lot({ quantite: 1 })]), entree("c", null, [lot({ quantite: 1 })])], { a: [b(100, 1)], b: [b(100, 1)], c: [b(100, 1)] }, { EUR: 1 }, null, 1000);
    expect(r.ignores.sort()).toEqual(["B", "C"]);
    expect(r.points[0].valeurEur).toBe(1);
  });

  it("utilise l'historique des transactions : la valeur suit les achats", () => {
    const l = lot({ quantite: 2, mouvements: [{ date: 200_000, sens: "achat", quantite: 2, prix: 1 }] });
    const r = valeurDansLeTemps([entree("a", "EUR", [l])], { a: [b(100, 10), b(300, 10)] }, { EUR: 1 }, null, 1000);
    // La première bougie (t = 100 s) précède l'achat (t = 200 s) : valeur nulle, donc écartée du graphique.
    expect(r.points).toEqual([{ temps: 300, valeurEur: 20 }]);
    expect(r.quantitesSupposees).toBe(false);
  });

  it("indique quand des quantités actuelles sont supposées constantes", () => {
    expect(valeurDansLeTemps([entree("a", "EUR", [lot({ quantite: 1 })])], { a: [b(100, 1)] }, { EUR: 1 }, null, 1000).quantitesSupposees).toBe(true);
  });
});

describe("recupererBougies", () => {
  it("limite la concurrence, garde les actifs réussis et ignore les échecs", async () => {
    let enCours = 0;
    let max = 0;
    const entrees = Array.from({ length: 12 }, (_, i) => ({ cle: `k${i}`, source: "binance" as const, symbole: `S${i}` }));
    const r = await recupererBougies(
      entrees,
      specPeriode("30j"),
      async (_s, symbole) => {
        enCours++;
        max = Math.max(max, enCours);
        await new Promise((ok) => setTimeout(ok, 5));
        enCours--;
        if (symbole === "S3") throw new Error("HTTP 500");
        return [b(1, 1)];
      },
      4,
    );
    expect(max).toBeLessThanOrEqual(4);
    expect(Object.keys(r)).toHaveLength(11);
    expect(r.k3).toBeUndefined();
  });
});

describe("périodes", () => {
  it("valide la période relue du fichier", () => {
    expect(periodeValide("90j")).toBe("90j");
    for (const mauvais of [undefined, null, "2a", 7]) expect(periodeValide(mauvais)).toBe("30j");
  });
  it("24 h et 7 j utilisent des bougies horaires, le reste des bougies journalières", () => {
    expect(PERIODES_PORTEFEUILLE.filter((p) => p.intervalle === "1h").map((p) => p.id)).toEqual(["24h", "7j"]);
    expect(specPeriode("tout").profondeur).toBe("5a");
  });
});
