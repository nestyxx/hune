import type { Capitalisation } from "./donnees/capitalisation";
import { ecrire, lire } from "./stockage";

/**
 * Historique local de la capitalisation, constitué au fil des ouvertures de Hune (l'API gratuite ne donne que la valeur du moment) :
 * un point au plus tous les 15 minutes, gardé 30 jours. Il alimente les mini-courbes et les variations des cartes du Marché.
 */
export interface PointCapitalisation {
  temps: number;
  total: number;
  dominanceBtc: number;
  total2: number;
  total3: number;
}

const CLE = "capitalisationHistorique";
export const ECART_POINTS_MS = 15 * 60_000;
export const DUREE_GARDEE_MS = 30 * 24 * 3600_000;

/** Ajoute un point si le dernier date de plus de `ecartMs`, et oublie les points trop anciens. */
export function ajouterPoint(historique: PointCapitalisation[], c: Capitalisation, maintenantMs: number, ecartMs = ECART_POINTS_MS, dureeMs = DUREE_GARDEE_MS): PointCapitalisation[] {
  const dernier = historique[historique.length - 1];
  const garde = historique.filter((p) => maintenantMs - p.temps <= dureeMs);
  if (dernier && maintenantMs - dernier.temps < ecartMs) return garde.length === historique.length ? historique : garde;
  return [...garde, { temps: maintenantMs, total: c.total, dominanceBtc: c.dominanceBtc, total2: c.total2, total3: c.total3 }];
}

/** Valeur du point le plus proche de « maintenant − ilYaMs », à condition que l'historique remonte au moins aussi loin (sinon null). */
export function valeurIlYa(historique: PointCapitalisation[], cle: keyof Omit<PointCapitalisation, "temps">, maintenantMs: number, ilYaMs: number, tolerance = 0.2): number | null {
  if (!historique.length) return null;
  const cible = maintenantMs - ilYaMs;
  if (historique[0].temps > cible + ilYaMs * tolerance) return null;
  let meilleur = historique[0];
  for (const p of historique) if (Math.abs(p.temps - cible) < Math.abs(meilleur.temps - cible)) meilleur = p;
  return Math.abs(meilleur.temps - cible) <= ilYaMs * tolerance ? meilleur[cle] : null;
}

export async function lireHistorique(): Promise<PointCapitalisation[]> {
  const brut = await lire<unknown>(CLE, []);
  return Array.isArray(brut) ? brut.filter((p): p is PointCapitalisation => !!p && typeof p === "object" && typeof (p as PointCapitalisation).temps === "number" && typeof (p as PointCapitalisation).total === "number") : [];
}

export async function ecrireHistorique(h: PointCapitalisation[]): Promise<void> {
  await ecrire(CLE, h);
}
