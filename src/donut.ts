/**
 * Segments d'un anneau SVG dessiné avec des cercles à trait en pointillés (pas de calcul d'arcs : un segment de 100 % ou de
 * 0,1 % se dessine pareil). Chaque segment est un cercle dont seul un tronçon de `longueur` est tracé, à partir de `decalage`.
 */
export interface SegmentDonut {
  /** Longueur tracée, en unités de circonférence. */
  longueur: number;
  /** Début du segment, à passer en `strokeDashoffset` (valeur négative : le tracé avance dans le sens horaire). */
  decalage: number;
}

export function segmentsDonut(parts: number[], circonference: number): SegmentDonut[] {
  const total = parts.reduce((s, p) => s + Math.max(0, p), 0);
  if (total <= 0) return parts.map(() => ({ longueur: 0, decalage: 0 }));
  let cumul = 0;
  return parts.map((p) => {
    const longueur = (Math.max(0, p) / total) * circonference;
    const segment = { longueur, decalage: -cumul };
    cumul += longueur;
    return segment;
  });
}
