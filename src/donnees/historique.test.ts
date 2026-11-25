import { describe, expect, it } from "vitest";
import { barresVisees, fusionnerPages, paramsYahoo, periodeYahoo } from "./historique";
import type { Bougie } from "./types";

const b = (temps: number, cloture = 1): Bougie => ({ temps, ouverture: cloture, haut: cloture, bas: cloture, cloture, volume: 0 });

describe("barresVisees", () => {
  it("reste à 500 bougies en standard et en intraday, quelle que soit la profondeur demandée", () => {
    expect(barresVisees("1d", "standard")).toBe(500);
    expect(barresVisees("15m", "max")).toBe(500);
    expect(barresVisees("4h", "5a")).toBe(500);
  });
  it("vise 5 ans ou tout l'historique pour les intervalles journaliers et plus", () => {
    expect(barresVisees("1d", "5a")).toBe(1826);
    expect(barresVisees("1w", "5a")).toBe(261);
    expect(barresVisees("1M", "5a")).toBe(60);
    expect(barresVisees("1d", "max")).toBe(Infinity);
  });
});

describe("fusionnerPages", () => {
  it("supprime les doublons entre pages qui se chevauchent et trie du plus ancien au plus récent", () => {
    const recente = [b(30), b(40), b(50)];
    const ancienne = [b(10), b(20), b(30)];
    expect(fusionnerPages([recente, ancienne]).map((x) => x.temps)).toEqual([10, 20, 30, 40, 50]);
  });
  it("garde la version la plus récemment fournie d'une bougie en double", () => {
    expect(fusionnerPages([[b(10, 1)], [b(10, 2)]])[0].cloture).toBe(2);
  });
  it("renvoie une liste vide sans page", () => {
    expect(fusionnerPages([])).toEqual([]);
  });
});

describe("paramsYahoo", () => {
  it("intraday : valeurs fixes, la profondeur est ignorée", () => {
    expect(paramsYahoo("15m", "max")).toEqual({ interval: "15m", range: "1mo" });
    expect(paramsYahoo("4h", "max")).toEqual({ interval: "60m", range: "6mo" });
  });
  it("journalier : 2 ans, 5 ans ou max", () => {
    expect(paramsYahoo("1d", "standard").range).toBe("2y");
    expect(paramsYahoo("1d", "5a").range).toBe("5y");
    expect(paramsYahoo("1d", "max").range).toBe("max");
  });
  it("hebdomadaire et mensuel : intervalles propres à Yahoo", () => {
    expect(paramsYahoo("1w", "max")).toEqual({ interval: "1wk", range: "max" });
    expect(paramsYahoo("1M", "standard")).toEqual({ interval: "1mo", range: "10y" });
  });
});

describe("periodeYahoo", () => {
  it("n'utilise jamais range=max (granularité dégradée) mais period1=0", () => {
    expect(periodeYahoo("max")).toBe("period1=0&period2=9999999999");
    expect(periodeYahoo("max")).not.toContain("range");
  });
  it("garde range pour les autres périodes", () => {
    expect(periodeYahoo("5y")).toBe("range=5y");
    expect(periodeYahoo("1mo")).toBe("range=1mo");
  });
});
