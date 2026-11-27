import { describe, expect, it } from "vitest";
import { categorieDe, deplacerCategorie, grouper, CATEGORIES_PAR_DEFAUT } from "./categories";
import type { Actif, Cotation } from "./donnees/types";

const btc: Actif = { source: "binance", symbole: "BTCUSDT", nom: "BTC/USDT" };
const eth: Actif = { source: "binance", symbole: "ETHUSDT", nom: "ETH/USDT" };
const lvmh: Actif = { source: "yahoo", symbole: "MC.PA", nom: "LVMH" };
const cot = (symbole: string, variationPct: number | null): Cotation => ({ symbole, prix: 1, variationPct });

describe("catégories", () => {
  it("classe par défaut selon la source", () => {
    expect(categorieDe(btc, CATEGORIES_PAR_DEFAUT)).toBe("Cryptos");
    expect(categorieDe(lvmh, CATEGORIES_PAR_DEFAUT)).toBe("Non classé");
  });
  it("respecte la catégorie choisie, et retombe sur le défaut si elle a été supprimée", () => {
    const perso = { ...lvmh, categorie: "Luxe" };
    expect(categorieDe(perso, [...CATEGORIES_PAR_DEFAUT, "Luxe"])).toBe("Luxe");
    expect(categorieDe(perso, CATEGORIES_PAR_DEFAUT)).toBe("Non classé");
  });
  it("conserve les catégories vides, dans l'ordre", () => {
    const g = grouper([btc], ["Cryptos", "Non classé", "Luxe"], "manuel", {});
    expect(g.map((x) => `${x.nom}:${x.actifs.length}`)).toEqual(["Cryptos:1", "Non classé:0", "Luxe:0"]);
  });
  it("trie par symbole ou par variation décroissante, dans chaque catégorie", () => {
    const cotations = { "binance:BTCUSDT": cot("BTCUSDT", -2), "binance:ETHUSDT": cot("ETHUSDT", 3) };
    expect(grouper([btc, eth], CATEGORIES_PAR_DEFAUT, "variation", cotations)[0].actifs.map((a) => a.symbole)).toEqual(["ETHUSDT", "BTCUSDT"]);
    expect(grouper([eth, btc], CATEGORIES_PAR_DEFAUT, "symbole", {})[0].actifs.map((a) => a.symbole)).toEqual(["BTCUSDT", "ETHUSDT"]);
  });
  it("déplace une catégorie devant une autre ou à la fin", () => {
    const o = ["A", "B", "C"];
    expect(deplacerCategorie(o, "C", "A")).toEqual(["C", "A", "B"]);
    expect(deplacerCategorie(o, "A", null)).toEqual(["B", "C", "A"]);
    expect(deplacerCategorie(o, "B", "C")).toBeNull();
    expect(deplacerCategorie(o, "B", "B")).toBeNull();
    expect(deplacerCategorie(o, "Z", "A")).toBeNull();
  });
});
