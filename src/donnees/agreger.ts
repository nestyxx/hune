import type { Bougie } from "./types";

/**
 * Regroupe des bougies fines en bougies plus larges (ex. 1 h → 4 h) en alignant les paquets sur
 * des multiples de `pasSecondes` (UTC). Yahoo ne propose pas le 4 h : on le fabrique à partir du 1 h.
 * Pour les actions, les paquets ne suivent pas les heures de séance de la place : c'est une approximation.
 */
export function agreger(bougies: Bougie[], pasSecondes: number): Bougie[] {
  const sortie: Bougie[] = [];
  for (const b of bougies) {
    const debut = Math.floor(b.temps / pasSecondes) * pasSecondes;
    const derniere = sortie[sortie.length - 1];
    if (derniere && derniere.temps === debut) {
      derniere.haut = Math.max(derniere.haut, b.haut);
      derniere.bas = Math.min(derniere.bas, b.bas);
      derniere.cloture = b.cloture;
      derniere.volume += b.volume;
    } else {
      sortie.push({ ...b, temps: debut });
    }
  }
  return sortie;
}
