/**
 * Tracés de l'utilisateur sur un graphique (lignes, tendances, Fibonacci). Ils sont rattachés à un actif et gardés
 * dans le fichier de données ; chaque point est un couple (instant, prix), donc indépendant de l'intervalle affiché.
 */

export type TypeDessin = "horizontale" | "tendance" | "rayon" | "fibonacci";

export interface PointDessin {
  /** Secondes Unix (UTC). */
  temps: number;
  prix: number;
}

export interface Dessin {
  id: string;
  type: TypeDessin;
  a: PointDessin;
  /** Second point (absent pour la ligne horizontale). */
  b?: PointDessin;
}

export const LIBELLE_DESSIN: Record<TypeDessin, string> = {
  horizontale: "Ligne horizontale",
  tendance: "Ligne de tendance",
  rayon: "Rayon (tendance prolongée)",
  fibonacci: "Retracement de Fibonacci",
};

/** Nombre de clics nécessaires pour tracer chaque outil. */
export const POINTS_REQUIS: Record<TypeDessin, 1 | 2> = { horizontale: 1, tendance: 2, rayon: 2, fibonacci: 2 };

/** Niveaux de retracement : 0 au point d'arrivée, 1 au point de départ. */
export const NIVEAUX_FIBONACCI = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export const prixFibonacci = (a: PointDessin, b: PointDessin, niveau: number) => b.prix + (a.prix - b.prix) * niveau;

/**
 * Position fractionnaire d'un instant parmi les bougies (`temps` trié, une valeur par bougie). En dehors des bougies
 * connues (futur, ou passé non chargé), on extrapole au pas de l'intervalle : un tracé reste donc exact même si l'on
 * charge plus d'historique ensuite.
 */
export function indiceDepuisTemps(temps: number[], t: number, pas: number): number {
  const n = temps.length;
  if (!n) return 0;
  if (t <= temps[0]) return (t - temps[0]) / pas;
  if (t >= temps[n - 1]) return n - 1 + (t - temps[n - 1]) / pas;
  let bas = 0;
  let haut = n - 1;
  while (haut - bas > 1) {
    const milieu = (bas + haut) >> 1;
    if (temps[milieu] <= t) bas = milieu;
    else haut = milieu;
  }
  const ecart = temps[haut] - temps[bas];
  return bas + (ecart > 0 ? (t - temps[bas]) / ecart : 0);
}

/** Opération inverse : instant d'une position (entière = une bougie ; hors bougies, extrapolé au pas). */
export function tempsDepuisIndice(temps: number[], indice: number, pas: number): number {
  const n = temps.length;
  if (!n) return 0;
  if (indice <= 0) return Math.round(temps[0] + indice * pas);
  if (indice >= n - 1) return Math.round(temps[n - 1] + (indice - (n - 1)) * pas);
  const bas = Math.floor(indice);
  return Math.round(temps[bas] + (indice - bas) * (temps[bas + 1] - temps[bas]));
}

/** Distance (px) d'un point à un segment. */
export function distanceSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const carre = dx * dx + dy * dy;
  const t = carre === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / carre));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Extrémité d'un rayon : prolonge (x1,y1)→(x2,y2) jusqu'au bord du graphique, dans le sens de la tendance. */
export function prolongement(x1: number, y1: number, x2: number, y2: number, largeur: number): { x: number; y: number } {
  const dx = x2 - x1;
  if (Math.abs(dx) < 1e-9) return { x: x2, y: y2 };
  const xFin = dx > 0 ? largeur : 0;
  return { x: xFin, y: y1 + ((xFin - x1) / dx) * (y2 - y1) };
}
