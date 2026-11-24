import type { Bougie } from "../donnees/types";

/**
 * Bougies Heikin-Ashi : clôture = moyenne OHLC ; ouverture = milieu de la bougie HA précédente
 * (première : milieu ouverture/clôture réelles) ; haut/bas englobent le corps. Lissent la tendance.
 */
export function heikinAshi(bougies: Bougie[]): Bougie[] {
  const sortie: Bougie[] = [];
  for (const b of bougies) {
    const cloture = (b.ouverture + b.haut + b.bas + b.cloture) / 4;
    const prec = sortie[sortie.length - 1];
    const ouverture = prec ? (prec.ouverture + prec.cloture) / 2 : (b.ouverture + b.cloture) / 2;
    sortie.push({ temps: b.temps, ouverture, cloture, haut: Math.max(b.haut, ouverture, cloture), bas: Math.min(b.bas, ouverture, cloture), volume: b.volume });
  }
  return sortie;
}
