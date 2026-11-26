import type { Bougie } from "./donnees/types";

/** Distance (en pixels) en deçà de laquelle un prix se cale sur la valeur d'une bougie. */
export const SEUIL_AIMANT_PX = 10;

/**
 * Aimant façon TradingView : ramène `prix` sur l'ouverture, le plus haut, le plus bas ou la clôture de la bougie
 * s'il en est à moins de `seuilPx` pixels à l'écran ; sinon le prix est laissé tel quel.
 * `versPixel` convertit un prix en ordonnée (null si l'échelle n'est pas prête).
 */
export function aimanter(bougie: Pick<Bougie, "ouverture" | "haut" | "bas" | "cloture"> | undefined, prix: number, versPixel: (prix: number) => number | null, seuilPx = SEUIL_AIMANT_PX): number {
  if (!bougie) return prix;
  const y = versPixel(prix);
  if (y == null) return prix;
  let meilleur = prix;
  let ecart = Infinity;
  for (const candidat of [bougie.ouverture, bougie.haut, bougie.bas, bougie.cloture]) {
    const yc = versPixel(candidat);
    if (yc == null) continue;
    const d = Math.abs(yc - y);
    if (d <= seuilPx && d < ecart) {
      ecart = d;
      meilleur = candidat;
    }
  }
  return meilleur;
}
