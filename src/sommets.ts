/**
 * Sommets et creux à étiqueter sur le graphique (comme les valeurs de plus haut et de plus bas de ProRealTime) : un plus haut
 * est « dominant » s'il dépasse tous les plus hauts des `fenetre` bougies avant et après lui (idem à l'envers pour un plus bas).
 * La fenêtre grandit quand on dézoome, pour que les étiquettes restent lisibles et ne se chevauchent pas.
 */

export interface Sommet {
  /** Indice de la bougie dans la liste. */
  indice: number;
  prix: number;
  /** true : plus haut (étiquette au-dessus) ; false : plus bas (étiquette en dessous). */
  haut: boolean;
}

/** Fenêtre (en bougies) adaptée à l'écart horizontal entre deux bougies : environ 40 px de part et d'autre, bornée à [2, 60]. */
export function fenetreSommets(pixelsParBougie: number): number {
  if (!(pixelsParBougie > 0)) return 60;
  return Math.max(2, Math.min(60, Math.round(40 / pixelsParBougie)));
}

/**
 * Sommets et creux des bougies `de`…`a` (inclus). Une bougie dont la fenêtre de droite dépasse la dernière donnée n'est pas
 * retenue : elle changerait à chaque nouveau prix. Le plus haut et le plus bas de la plage affichée sont toujours étiquetés.
 */
export function detecterSommets(hauts: number[], bas: number[], fenetre: number, de: number, a: number): Sommet[] {
  const n = hauts.length;
  if (!n || bas.length !== n) return [];
  const debut = Math.max(0, Math.floor(de));
  const fin = Math.min(n - 1, Math.ceil(a));
  const f = Math.max(1, Math.floor(fenetre));
  const trouves = new Map<string, Sommet>();
  const ajouter = (s: Sommet) => trouves.set(`${s.indice}:${s.haut}`, s);

  for (let i = debut; i <= fin; i++) {
    if (i + f > n - 1) continue; // fenêtre de droite incomplète : bougie encore en mouvement
    let hautDominant = true;
    let basDominant = true;
    for (let k = Math.max(0, i - f); k <= i + f && (hautDominant || basDominant); k++) {
      if (k === i) continue;
      // À égalité, on garde la première bougie (la plus à gauche).
      if (k < i ? hauts[k] >= hauts[i] : hauts[k] > hauts[i]) hautDominant = false;
      if (k < i ? bas[k] <= bas[i] : bas[k] < bas[i]) basDominant = false;
    }
    if (hautDominant) ajouter({ indice: i, prix: hauts[i], haut: true });
    if (basDominant) ajouter({ indice: i, prix: bas[i], haut: false });
  }

  // Extrêmes de la plage affichée.
  if (fin >= debut) {
    let iMax = debut;
    let iMin = debut;
    for (let i = debut; i <= fin; i++) {
      if (hauts[i] > hauts[iMax]) iMax = i;
      if (bas[i] < bas[iMin]) iMin = i;
    }
    ajouter({ indice: iMax, prix: hauts[iMax], haut: true });
    ajouter({ indice: iMin, prix: bas[iMin], haut: false });
  }
  return [...trouves.values()].sort((x, y) => x.indice - y.indice);
}
