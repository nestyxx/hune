import { describe, expect, it } from "vitest";
import { bollinger, ema, macd, rsi, sma, stochastique } from "./indicateurs";

/** Compare deux séries à `chiffres` décimales près (null doit rester null). */
function proche(obtenu: (number | null)[], attendu: (number | null)[], chiffres = 2) {
  expect(obtenu).toHaveLength(attendu.length);
  attendu.forEach((a, i) => {
    if (a === null) expect(obtenu[i], `indice ${i}`).toBeNull();
    else expect(obtenu[i], `indice ${i}`).toBeCloseTo(a, chiffres);
  });
}

describe("SMA", () => {
  it("calcule la moyenne glissante, null pendant l'amorçage", () => {
    proche(sma([1, 2, 3, 4, 5, 6], 3), [null, null, 2, 3, 4, 5]);
  });
  it("renvoie que des null si la série est plus courte que la période", () => {
    proche(sma([1, 2], 3), [null, null]);
  });
});

describe("EMA", () => {
  it("s'amorce avec la SMA puis applique 2/(n+1)", () => {
    // période 3 : k = 0,5. Amorce = (1+2+3)/3 = 2 ; puis 4×0,5+2×0,5 = 3 ; 5×0,5+3×0,5 = 4
    proche(ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  });
  it("reste constante sur une série constante", () => {
    proche(ema([7, 7, 7, 7, 7, 7], 4), [null, null, null, 7, 7, 7]);
  });
});

describe("RSI (Wilder)", () => {
  // Série d'exemple classique (ChartSchool / StockCharts) : RSI(14) attendu 70,53 ; 66,32 ; 66,55 ; 69,41 ; 66,36 ; 57,97
  const cloturesChartSchool = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
  ];
  it("premier point = calcul à la main : gains 3,34 / pertes 1,40 sur 14 variations", () => {
    const r = rsi(cloturesChartSchool, 14);
    expect(r.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(r[14]).toBeCloseTo(100 - 100 / (1 + 3.34 / 1.4), 8); // 70,4641…
  });
  it("suit les valeurs de référence ChartSchool (à 0,1 près : leur feuille arrondit les moyennes)", () => {
    const r = rsi(cloturesChartSchool, 14);
    [70.53, 66.32, 66.55, 69.41, 66.36, 57.97].forEach((attendu, i) => {
      expect(Math.abs(r[14 + i]! - attendu)).toBeLessThan(0.1);
    });
  });
  it("vaut 100 sur une hausse continue et 0 sur une baisse continue", () => {
    const hausse = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(hausse, 14)[19]).toBe(100);
    expect(rsi([...hausse].reverse(), 14)[19]).toBe(0);
  });
  it("vaut 50 sur un marché plat", () => {
    expect(rsi(new Array(20).fill(5), 14)[19]).toBe(50);
  });
});

describe("MACD", () => {
  const serie = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10 + i * 0.3);
  it("= EMA12 − EMA26, définie à partir de l'indice 25", () => {
    const { macd: m } = macd(serie);
    const e12 = ema(serie, 12);
    const e26 = ema(serie, 26);
    expect(m.slice(0, 25).every((v) => v === null)).toBe(true);
    expect(m[25]).toBeCloseTo(e12[25]! - e26[25]!, 10);
    expect(m[59]).toBeCloseTo(e12[59]! - e26[59]!, 10);
  });
  it("signal = EMA9 du MACD (premier point à l'indice 33) et histogramme = MACD − signal", () => {
    const r = macd(serie);
    expect(r.signal.slice(0, 33).every((v) => v === null)).toBe(true);
    expect(r.signal[33]).not.toBeNull();
    // Amorce du signal = moyenne des 9 premières valeurs du MACD
    const neuf = r.macd.slice(25, 34) as number[];
    expect(r.signal[33]).toBeCloseTo(neuf.reduce((a, b) => a + b, 0) / 9, 10);
    expect(r.histogramme[40]).toBeCloseTo(r.macd[40]! - r.signal[40]!, 10);
  });
  it("est nul partout sur une série constante", () => {
    const r = macd(new Array(50).fill(10));
    expect(r.macd[49]).toBeCloseTo(0, 10);
    expect(r.signal[49]).toBeCloseTo(0, 10);
    expect(r.histogramme[49]).toBeCloseTo(0, 10);
  });
});

describe("Bandes de Bollinger", () => {
  it("SMA ± 2 écarts-types (population)", () => {
    // [1..5] : moyenne 3, variance population 2, σ = √2
    const b = bollinger([1, 2, 3, 4, 5], 5, 2);
    expect(b.milieu[4]).toBeCloseTo(3, 10);
    expect(b.haut[4]).toBeCloseTo(3 + 2 * Math.SQRT2, 10);
    expect(b.bas[4]).toBeCloseTo(3 - 2 * Math.SQRT2, 10);
    expect(b.haut.slice(0, 4).every((v) => v === null)).toBe(true);
  });
  it("les bandes se confondent avec la moyenne sur une série constante", () => {
    const b = bollinger(new Array(25).fill(8), 20, 2);
    expect(b.haut[24]).toBe(8);
    expect(b.bas[24]).toBe(8);
  });
});

describe("Stochastique", () => {
  const hauts = [10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9];
  const bas = hauts.map((h) => h - 2);
  const clotures = hauts.map((h) => h - 1);
  it("%K brut puis lissage, valeurs bornées entre 0 et 100", () => {
    const { k, d } = stochastique(hauts, bas, clotures, 5, 1, 1); // sans lissage : %K brut, %D = %K
    // indice 4 : plus haut 14, plus bas 8 (=10−2), clôture 13 → (13−8)/(14−8) = 83,33
    expect(k[4]).toBeCloseTo(83.333, 2);
    expect(k.slice(0, 4).every((v) => v === null)).toBe(true);
    expect(d[4]).toBeCloseTo(k[4]!, 10);
    for (const v of k) if (v != null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
  });
  it("lissage : %K lent défini à periodeK + lissage − 2, %D trois points plus loin", () => {
    const { k, d } = stochastique(hauts, bas, clotures, 5, 3, 3);
    expect(k.findIndex((v) => v != null)).toBe(6); // 4 + 3 − 1
    expect(d.findIndex((v) => v != null)).toBe(8);
  });
  it("vaut 50 sans amplitude", () => {
    const plat = new Array(10).fill(5);
    expect(stochastique(plat, plat, plat, 5, 1, 1).k[9]).toBe(50);
  });
});
