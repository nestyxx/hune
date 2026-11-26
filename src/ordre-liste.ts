import { categorieDe } from "./categories";
import { cleActif, type Actif } from "./donnees/types";

/**
 * Déplace un actif dans la liste : devant `avantCle` (ou à la fin de la catégorie `groupe` si null), et le range dans cette catégorie.
 * `ordre` est l'ordre affiché (toutes catégories confondues) : l'ordre manuel est celui de ce tableau.
 * Renvoie le nouveau tableau, ou null si rien ne change.
 */
export function deplacerActif(ordre: Actif[], categories: string[], cle: string, avantCle: string | null, groupe: string): Actif[] | null {
  const source = ordre.find((a) => cleActif(a) === cle);
  if (!source || cle === avantCle) return null;
  const sansSource = ordre.filter((a) => cleActif(a) !== cle);
  const deplace: Actif = categorieDe(source, categories) === groupe ? source : { ...source, categorie: groupe };
  let index: number;
  if (avantCle !== null) {
    index = sansSource.findIndex((a) => cleActif(a) === avantCle);
    if (index < 0) return null;
  } else {
    // Fin de la catégorie : juste après son dernier actif, à défaut à la fin de la liste.
    let dernier = -1;
    sansSource.forEach((a, i) => {
      if (categorieDe(a, categories) === groupe) dernier = i;
    });
    index = dernier < 0 ? sansSource.length : dernier + 1;
  }
  const suite = [...sansSource.slice(0, index), deplace, ...sansSource.slice(index)];
  const identique = suite.length === ordre.length && suite.every((a, i) => cleActif(a) === cleActif(ordre[i]) && a.categorie === ordre[i].categorie);
  return identique ? null : suite;
}
