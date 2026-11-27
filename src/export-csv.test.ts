import { describe, expect, it } from "vitest";
import { cellule, construireCsv, csvPositions, csvTransactions } from "./export-csv";
import { gainsRealises, gainsRealisesTotal, type LignePortefeuille, type Mouvement } from "./portefeuille";

const mv = (date: number, sens: "achat" | "vente", quantite: number, prix: number): Mouvement => ({ date, sens, quantite, prix });

describe("gainsRealises (prix moyen)", () => {
  it("gain = quantité vendue × (prix de vente − PAMP du moment)", () => {
    // 2 à 10, puis 2 à 20 : PAMP 15. Vente de 1 à 30 : gain 15. PAMP inchangé (15) pour la vente suivante de 3 à 12 : −9.
    const g = gainsRealises([mv(1, "achat", 2, 10), mv(2, "achat", 2, 20), mv(3, "vente", 1, 30), mv(4, "vente", 3, 12)]);
    expect(g).toEqual([{ date: 3, quantite: 1, gain: 15 }, { date: 4, quantite: 3, gain: -9 }]);
  });
  it("trie par date, plafonne une vente excédentaire et ignore une vente sans achat connu", () => {
    expect(gainsRealises([mv(5, "vente", 1, 9)])).toEqual([]);
    const g = gainsRealises([mv(3, "vente", 5, 20), mv(1, "achat", 2, 10)]);
    expect(g).toEqual([{ date: 3, quantite: 2, gain: 20 }]);
  });
  it("total en euros sur les lignes, null sans vente", () => {
    const ligne = (devise: string, mouvements: Mouvement[]) => ({ devise, lots: [{ id: "x", cle: "k", mouvements }] }) as unknown as LignePortefeuille;
    const lignes = [ligne("USD", [mv(1, "achat", 1, 10), mv(2, "vente", 1, 20)]), ligne("EUR", [mv(1, "achat", 1, 5), mv(2, "vente", 1, 6)])];
    expect(gainsRealisesTotal(lignes, { EUR: 1, USD: 0.5 })).toBeCloseTo(10 * 0.5 + 1, 10);
    expect(gainsRealisesTotal([ligne("EUR", [mv(1, "achat", 1, 5)])], { EUR: 1 })).toBeNull();
  });
});

describe("CSV", () => {
  it("séparateur « ; », virgule décimale, guillemets doublés, BOM et fins de ligne Windows", () => {
    const csv = construireCsv(["a", "b"], [["x;y", 1234.5], ['il dit "oui"', -0.00001234], [null, undefined]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toEqual(["﻿a;b", '"x;y";1234,5', '"il dit ""oui""";-0,00001234', ";", ""]);
  });
  it("neutralise les textes qui commencent comme une formule, pas les nombres négatifs", () => {
    expect(cellule("=1+1")).toBe("'=1+1");
    expect(cellule("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(cellule("-cmd")).toBe("'-cmd");
    expect(cellule("+33")).toBe("'+33");
    expect(cellule(-5)).toBe("-5");
    expect(cellule("normal")).toBe("normal");
  });
  it("positions : convertit dans la devise d'affichage et laisse vide ce qui manque", () => {
    const l = { actif: { source: "binance", symbole: "BTCUSDC", nom: "BTC/USDC" }, quantite: 2, pamp: 100, devise: "USD", prix: 150, valeurEur: 150, pnlEur: 50, pnlPct: 50, poids: 0.5, objectif: null, plateformes: ["A", "B"], lots: [{ id: "1", cle: "k", quantite: 2, pamp: 100 }] } as unknown as LignePortefeuille;
    const lignes = csvPositions([l], "USD", { EUR: 1, USD: 0.5 }, () => "Cryptos").split("\r\n");
    expect(lignes[0]).toContain("Valeur (USD)");
    expect(lignes[1]).toBe("BTCUSDC;BTC/USDC;Binance;Cryptos;A, B;2;100;USD;150;300;200;100;50;50;;"); // 150 € = 300 $ ; coût 200 $ natif
    expect(csvPositions([l], "USD", { EUR: 1 }, () => "C").split("\r\n")[1]).toContain(";;;;50;50;"); // sans taux USD : montants vides
  });
  it("transactions : gain réalisé sur chaque vente, plus récentes d'abord", () => {
    const csv = csvTransactions([{ symbole: "ETH", devise: "EUR", plateforme: "Ledger", mouvements: [mv(Date.UTC(2026, 0, 1), "achat", 2, 100), mv(Date.UTC(2026, 1, 1), "vente", 1, 130)] }]).split("\r\n");
    expect(csv[1]).toBe("2026-02-01 00:00:00;ETH;Vente;1;130;130;EUR;30;Ledger");
    expect(csv[2]).toBe("2026-01-01 00:00:00;ETH;Achat;2;100;200;EUR;;Ledger");
  });
});
