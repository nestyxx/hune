import type { Bougie, Intervalle } from "./types";

/**
 * Profondeur d'historique demandée au-delà de la valeur standard. Elle n'a de sens que pour les intervalles
 * journalier et plus : en intraday, les sources plafonnent elles-mêmes (Yahoo : 60 jours en 15 min, ~2 ans en 1 h).
 */
export type Profondeur = "standard" | "5a" | "max";
export const PROFONDEURS: Profondeur[] = ["standard", "5a", "max"];
export const LIBELLE_PROFONDEUR: Record<Profondeur, string> = { standard: "Standard", "5a": "5 ans", max: "Max" };

/** Intervalles pour lesquels le choix de la profondeur est proposé. */
export const PROFONDEUR_DISPONIBLE: Intervalle[] = ["1d", "1w", "1M"];

/** Nombre de bougies visé côté Binance (Infinity = tout l'historique disponible, par pages). */
export function barresVisees(intervalle: Intervalle, profondeur: Profondeur): number {
  if (!PROFONDEUR_DISPONIBLE.includes(intervalle) || profondeur === "standard") return 500;
  if (profondeur === "max") return Infinity;
  const cinqAns: Partial<Record<Intervalle, number>> = { "1d": 1826, "1w": 261, "1M": 60 };
  return cinqAns[intervalle] ?? 500;
}

/** Réunit des pages de bougies (dans n'importe quel ordre) : sans doublon, de la plus ancienne à la plus récente. */
export function fusionnerPages(pages: Bougie[][]): Bougie[] {
  const parTemps = new Map<number, Bougie>();
  for (const page of pages) for (const b of page) parTemps.set(b.temps, b);
  return [...parTemps.values()].sort((a, b) => a.temps - b.temps);
}

/** Intervalle et période demandés à Yahoo. Le 4 h n'existe pas chez lui : il est reconstruit à partir du 1 h. */
export function paramsYahoo(intervalle: Intervalle, profondeur: Profondeur): { interval: string; range: string } {
  const p = PROFONDEUR_DISPONIBLE.includes(intervalle) ? profondeur : "standard";
  switch (intervalle) {
    case "15m":
      return { interval: "15m", range: "1mo" };
    case "1h":
    case "4h":
      return { interval: "60m", range: "6mo" };
    case "1d":
      return { interval: "1d", range: p === "max" ? "max" : p === "5a" ? "5y" : "2y" };
    case "1w":
      return { interval: "1wk", range: p === "max" ? "max" : "5y" };
    case "1M":
      return { interval: "1mo", range: p === "max" ? "max" : p === "5a" ? "5y" : "10y" };
  }
}

/**
 * Fragment d'URL Yahoo pour une période. « max » n'utilise PAS `range=max` : Yahoo dégrade alors silencieusement la
 * granularité (BTC : 147 points « journaliers » au lieu de 4 400). `period1=0` garantit la vraie résolution depuis l'origine.
 */
export function periodeYahoo(range: string): string {
  return range === "max" ? "period1=0&period2=9999999999" : `range=${range}`;
}
