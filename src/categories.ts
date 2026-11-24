import { cleActif, type Actif, type Cotation } from "./donnees/types";

/** Catégories créées au premier lancement ; l'utilisateur peut en ajouter, renommer, supprimer. */
export const CATEGORIES_PAR_DEFAUT = ["Cryptos", "Actions"];

/** Catégorie par défaut d'un actif ajouté sans choix explicite : selon sa source. */
export const categorieParDefaut = (a: Pick<Actif, "source">) => (a.source === "binance" ? "Cryptos" : "Actions");

/** Catégorie effective : celle choisie si elle existe encore, sinon la catégorie par défaut. */
export function categorieDe(a: Actif, categories: string[]): string {
  return a.categorie && categories.includes(a.categorie) ? a.categorie : categorieParDefaut(a);
}

export type Tri = "manuel" | "symbole" | "variation";
export const LIBELLE_TRI: Record<Tri, string> = { manuel: "Ordre d'ajout", symbole: "A → Z", variation: "Variation" };

export interface Groupe {
  nom: string;
  actifs: Actif[];
}

/**
 * Regroupe les actifs par catégorie (dans l'ordre des catégories) et applique le tri à l'intérieur.
 * Une catégorie vide est conservée (pour pouvoir y déplacer des actifs), sauf la catégorie par défaut
 * qui n'existerait que par accident (ex. « Actions » supprimée mais encore utilisée).
 */
export function grouper(actifs: Actif[], categories: string[], tri: Tri, cotations: Record<string, Cotation>): Groupe[] {
  const noms = [...categories];
  for (const a of actifs) {
    const c = categorieDe(a, categories);
    if (!noms.includes(c)) noms.push(c);
  }
  const variation = (a: Actif) => cotations[cleActif(a)]?.variationPct ?? -Infinity;
  return noms.map((nom) => {
    const liste = actifs.filter((a) => categorieDe(a, categories) === nom);
    if (tri === "symbole") liste.sort((a, b) => a.symbole.localeCompare(b.symbole, "fr"));
    if (tri === "variation") liste.sort((a, b) => variation(b) - variation(a));
    return { nom, actifs: liste };
  });
}
