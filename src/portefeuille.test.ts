import { describe, expect, it } from "vitest";
import type { Actif, Cotation } from "./donnees/types";
import { agreger, repartition, totaux, TRI_PORTEFEUILLE_PAR_DEFAUT, triPortefeuilleValide, valeurLotEur, versDevise, type Position } from "./portefeuille";

describe("devise d'affichage", () => {
  it("l'euro est inchangé, le dollar divise par le taux (valeur en euros d'un dollar)", () => {
    expect(versDevise(1000, "EUR", { EUR: 1 })).toBe(1000);
    expect(versDevise(800, "USD", { EUR: 1, USD: 0.8 })).toBe(1000);
    expect(versDevise(-80, "USD", { EUR: 1, USD: 0.8 })).toBe(-100);
  });
  it("renvoie null (affiché « — ») si le taux manque ou si le montant est inconnu", () => {
    expect(versDevise(1000, "USD", { EUR: 1 })).toBeNull();
    expect(versDevise(null, "USD", { EUR: 1, USD: 0.8 })).toBeNull();
    expect(versDevise(null, "EUR", { EUR: 1 })).toBeNull();
  });
});

describe("tri mémorisé du portefeuille", () => {
  it("accepte un tri valide relu du fichier", () => {
    expect(triPortefeuilleValide({ col: "pnlPct", sens: 1 })).toEqual({ col: "pnlPct", sens: 1 });
  });
  it("retombe sur le tri par défaut pour toute valeur inattendue", () => {
    for (const mauvais of [undefined, null, 5, {}, { col: "inconnue", sens: 1 }, { col: "poids", sens: 2 }, { col: "poids" }]) {
      expect(triPortefeuilleValide(mauvais)).toEqual(TRI_PORTEFEUILLE_PAR_DEFAUT);
    }
  });
});

const ada: Actif = { source: "binance", symbole: "ADAUSDC", nom: "ADA/USDC" };
const bnb: Actif = { source: "binance", symbole: "BNBUSDC", nom: "BNB/USDC" };
const lvmh: Actif = { source: "yahoo", symbole: "MC.PA", nom: "LVMH" };
const cot = (symbole: string, prix: number): Cotation => ({ symbole, prix, variationPct: 0 });

const entrees = {
  actifs: { "binance:ADAUSDC": ada, "binance:BNBUSDC": bnb, "yahoo:MC.PA": lvmh },
  cotations: { "binance:ADAUSDC": cot("ADAUSDC", 0.5), "binance:BNBUSDC": cot("BNBUSDC", 600), "yahoo:MC.PA": cot("MC.PA", 400) },
  devises: { "binance:ADAUSDC": "USD", "binance:BNBUSDC": "USD", "yahoo:MC.PA": "EUR" },
  taux: { EUR: 1, USD: 0.9 },
};

const lot = (id: string, cle: string, quantite: number, extra: Partial<Position> = {}): Position => ({ id, cle, quantite, ...extra });

describe("agreger", () => {
  const lignes = agreger(
    [
      lot("1", "binance:ADAUSDC", 1000, { pamp: 0.4, objectif: 2, plateforme: "ledger" }),
      lot("2", "binance:ADAUSDC", 3000, { pamp: 0.2, plateforme: "meria" }),
      lot("3", "binance:BNBUSDC", 1, { objectif: 700 }), // pas de PAMP
      lot("4", "yahoo:MC.PA", 2),
    ],
    entrees,
  );
  const ligne = (cle: string) => lignes.find((l) => l.cle === cle)!;

  it("somme les quantités et pondère le PAMP par les quantités", () => {
    const l = ligne("binance:ADAUSDC");
    expect(l.quantite).toBe(4000);
    expect(l.pamp).toBeCloseTo((1000 * 0.4 + 3000 * 0.2) / 4000, 10); // 0,25
    expect(l.plateformes.sort()).toEqual(["ledger", "meria"]);
  });
  it("valorise en euros avec le taux de la devise", () => {
    expect(ligne("binance:ADAUSDC").valeurEur).toBeCloseTo(4000 * 0.5 * 0.9, 10); // 1 800 €
    expect(ligne("yahoo:MC.PA").valeurEur).toBeCloseTo(800, 10);
  });
  it("calcule le P&L latent en % du coût et en euros", () => {
    const l = ligne("binance:ADAUSDC");
    // coût 1000×0,4 + 3000×0,2 = 1000 $ ; valeur 2000 $ → +100 % ; +1000 $ × 0,9 = 900 €
    expect(l.pnlPct).toBeCloseTo(100, 8);
    expect(l.pnlEur).toBeCloseTo(900, 8);
  });
  it("sans PAMP : pas de P&L, mais la valeur et l'objectif restent disponibles", () => {
    const l = ligne("binance:BNBUSDC");
    expect(l.pamp).toBeNull();
    expect(l.pnlPct).toBeNull();
    expect(l.valeurEur).toBeCloseTo(540, 10);
    expect(l.versObjectifPct).toBeCloseTo(((700 - 600) / 600) * 100, 8);
  });
  it("calcule le poids de chaque ligne (somme = 1)", () => {
    expect(lignes.reduce((s, l) => s + (l.poids ?? 0), 0)).toBeCloseTo(1, 10);
    expect(ligne("binance:ADAUSDC").poids).toBeCloseTo(1800 / (1800 + 540 + 800), 10);
  });
  it("ignore les lots d'un actif qui n'est plus suivi", () => {
    expect(agreger([lot("9", "binance:XRPUSDC", 5)], entrees)).toEqual([]);
  });
  it("laisse la valeur à null si le taux de change manque (pas de total faux)", () => {
    const sansTaux = agreger([lot("1", "binance:ADAUSDC", 10)], { ...entrees, taux: { EUR: 1 } });
    expect(sansTaux[0].valeurEur).toBeNull();
    expect(totaux(sansTaux).nonValorisees).toBe(1);
  });
});

describe("totaux et répartition", () => {
  it("additionne les valeurs et le P&L sur les lignes valorisées", () => {
    const l = agreger([lot("1", "binance:ADAUSDC", 1000, { pamp: 0.25 }), lot("2", "yahoo:MC.PA", 1)], entrees);
    const t = totaux(l);
    expect(t.valeurEur).toBeCloseTo(450 + 400, 8);
    expect(t.pnlEur).toBeCloseTo((1000 * 0.5 - 250) * 0.9, 8); // 225 €
    expect(t.pnlPct).toBeCloseTo(100, 8);
  });
  it("répartit par critère, en ordre décroissant, en ignorant les valeurs nulles", () => {
    const r = repartition([
      { nom: "ledger", valeurEur: 300 },
      { nom: "meria", valeurEur: 100 },
      { nom: "ledger", valeurEur: 100 },
      { nom: "x", valeurEur: null },
    ]);
    expect(r.map((p) => p.nom)).toEqual(["ledger", "meria"]);
    expect(r[0].part).toBeCloseTo(0.8, 10);
  });
  it("valorise un lot isolé (répartition par plateforme)", () => {
    expect(valeurLotEur(lot("1", "binance:ADAUSDC", 100), entrees)).toBeCloseTo(45, 10);
    expect(valeurLotEur({ id: "2", cle: "binance:ADAUSDC" }, entrees)).toBeNull();
  });
});
