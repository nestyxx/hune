import { describe, expect, it } from "vitest";
import type { Bougie } from "../donnees/types";
import { evaluer, variationSur } from "./moteur";

const bougie = (temps: number, ouverture: number, cloture = ouverture): Bougie => ({ temps, ouverture, haut: Math.max(ouverture, cloture), bas: Math.min(ouverture, cloture), cloture, volume: 1 });

describe("alerte de prix", () => {
  it("au-dessus : se déclenche au seuil et au-delà", () => {
    const c = { type: "prix", sens: "au-dessus", seuil: 100 } as const;
    expect(evaluer(c, { prix: 99.99, maintenant: 0 }).declenche).toBe(false);
    expect(evaluer(c, { prix: 100, maintenant: 0 }).declenche).toBe(true);
  });
  it("en-dessous : se déclenche au seuil et en deçà", () => {
    const c = { type: "prix", sens: "en-dessous", seuil: 100 } as const;
    expect(evaluer(c, { prix: 100.01, maintenant: 0 }).declenche).toBe(false);
    expect(evaluer(c, { prix: 90, maintenant: 0 }).declenche).toBe(true);
  });
});

describe("alerte de variation", () => {
  // Bougies 15 min : à t=0 le prix ouvre à 100 ; une heure plus tard (t=3600) il ouvre à 104.
  const bougies = [bougie(0, 100), bougie(900, 101), bougie(1800, 102), bougie(2700, 103), bougie(3600, 104)];
  it("mesure la variation depuis l'ouverture de la bougie qui contient (maintenant − période)", () => {
    // maintenant = 3700 s, période 1 h → départ à 100 s → bougie de t=0 (ouverture 100)
    expect(variationSur(bougies, 105, 3600, 3700)).toBeCloseTo(5, 10);
  });
  it("hausse : déclenche à +X %, pas avant", () => {
    const c = { type: "variation", sens: "hausse", pct: 5, periode: "1h" } as const;
    expect(evaluer(c, { prix: 104.9, bougies15m: bougies, maintenant: 3700 }).declenche).toBe(false);
    expect(evaluer(c, { prix: 105, bougies15m: bougies, maintenant: 3700 }).declenche).toBe(true);
  });
  it("baisse : déclenche à −X %", () => {
    const c = { type: "variation", sens: "baisse", pct: 3, periode: "1h" } as const;
    expect(evaluer(c, { prix: 97, bougies15m: bougies, maintenant: 3700 }).declenche).toBe(true); // −3 %
    expect(evaluer(c, { prix: 98, bougies15m: bougies, maintenant: 3700 }).declenche).toBe(false); // −2 %
  });
  it("ne déclenche pas si l'historique est trop court", () => {
    const c = { type: "variation", sens: "hausse", pct: 1, periode: "24h" } as const;
    const r = evaluer(c, { prix: 200, bougies15m: bougies, maintenant: 3700 });
    expect(r).toEqual({ declenche: false, valeur: null });
  });
});

describe("alerte RSI", () => {
  const hausse = Array.from({ length: 30 }, (_, i) => bougie(i * 3600, 100 + i));
  const baisse = Array.from({ length: 30 }, (_, i) => bougie(i * 3600, 200 - i));
  it("RSI au-dessus du seuil sur une hausse continue (RSI = 100)", () => {
    const c = { type: "rsi", sens: "au-dessus", seuil: 70, intervalle: "1h" } as const;
    expect(evaluer(c, { prix: 130, bougiesIntervalle: hausse, maintenant: 0 })).toEqual({ declenche: true, valeur: 100 });
    expect(evaluer(c, { prix: 130, bougiesIntervalle: baisse, maintenant: 0 }).declenche).toBe(false);
  });
  it("RSI en-dessous du seuil sur une baisse continue (RSI = 0)", () => {
    const c = { type: "rsi", sens: "en-dessous", seuil: 30, intervalle: "1h" } as const;
    expect(evaluer(c, { prix: 170, bougiesIntervalle: baisse, maintenant: 0 }).declenche).toBe(true);
  });
  it("ne déclenche pas sans assez de bougies pour calculer le RSI", () => {
    const c = { type: "rsi", sens: "au-dessus", seuil: 70, intervalle: "1h" } as const;
    expect(evaluer(c, { prix: 1, bougiesIntervalle: hausse.slice(0, 5), maintenant: 0 }).declenche).toBe(false);
  });
});

describe("croisements et franchissements", () => {
  const H = 3600;
  /** Série en V : baisse puis hausse → le cours croise sa SMA 3 par le haut en remontant. */
  const cours = [10, 9, 8, 7, 6, 7, 9, 12, 13, 14];
  const serie = cours.map((c, i) => bougie(i * H, c));
  const maintenant = serie.length * H + 10; // toutes les bougies sont closes
  const franchit = { type: "franchissement", moyenne: "sma", periode: 3, sens: "au-dessus", intervalle: "1h" } as const;

  it("détecte le cours qui passe au-dessus de sa moyenne sur une bougie récente close", () => {
    // Fenêtre de 3 bougies : on réduit la série pour que le franchissement soit dans la fenêtre
    const b = serie.slice(0, 8); // se termine à 12 : franchissement vers l'indice 6 ou 7
    const r = evaluer(franchit, { prix: 12, bougiesIntervalle: b, maintenant: b.length * H + 10, creeeLe: 0 });
    expect(r.declenche).toBe(true);
  });
  it("ne déclenche pas pour un croisement antérieur à la création de l'alerte", () => {
    const b = serie.slice(0, 8);
    const creee = (b.length * H + 5) * 1000; // créée après la clôture de toutes ces bougies
    expect(evaluer(franchit, { prix: 12, bougiesIntervalle: b, maintenant: b.length * H + 10, creeeLe: creee }).declenche).toBe(false);
  });
  it("n'utilise pas la bougie en cours (non clôturée)", () => {
    const b = serie.slice(0, 8);
    // « maintenant » en plein milieu de la dernière bougie : elle est exclue du calcul
    const r = evaluer(franchit, { prix: 12, bougiesIntervalle: b, maintenant: 7 * H + 100, creeeLe: 0 });
    const sansDerniere = evaluer(franchit, { prix: 12, bougiesIntervalle: b.slice(0, 7), maintenant: 7 * H + 100, creeeLe: 0 });
    expect(r.declenche).toBe(sansDerniere.declenche);
  });
  it("sens inverse : pas de signal « sous la moyenne » pendant une remontée", () => {
    const sous = { ...franchit, sens: "en-dessous" } as const;
    expect(evaluer(sous, { prix: 14, bougiesIntervalle: serie.slice(0, 8), maintenant, creeeLe: 0 }).declenche).toBe(false);
  });
  it("golden cross : SMA 2 qui croise SMA 4 par le haut", () => {
    const c = { type: "croisement", modele: "moyennes", moyenne: "sma", rapide: 2, lente: 4, sens: "haussier", intervalle: "1h" } as const;
    expect(evaluer(c, { prix: 12, bougiesIntervalle: serie.slice(0, 8), maintenant: 8 * H + 10, creeeLe: 0 }).declenche).toBe(true);
    const death = { ...c, sens: "baissier" } as const;
    expect(evaluer(death, { prix: 12, bougiesIntervalle: serie.slice(0, 8), maintenant: 8 * H + 10, creeeLe: 0 }).declenche).toBe(false);
  });
  it("renvoie false sans assez de bougies", () => {
    expect(evaluer(franchit, { prix: 1, bougiesIntervalle: serie.slice(0, 2), maintenant, creeeLe: 0 }).declenche).toBe(false);
  });
});
