import { cleActif, type Actif, type Cotation } from "./donnees/types";

/** Catégorie des actifs ajoutés sans choix : à ranger ensuite (par glisser-déposer ou par le menu ⋯). */
export const NON_CLASSE = "Non classé";

/** Catégories créées au premier lancement ; l'utilisateur peut en ajouter, renommer, supprimer. */
export const CATEGORIES_PAR_DEFAUT = ["Cryptos", NON_CLASSE];

/** Catégorie par défaut d'un actif ajouté sans choix explicite : selon sa source. */
export const categorieParDefaut = (a: Pick<Actif, "source">) => (a.source === "binance" ? "Cryptos" : NON_CLASSE);

/** Catégorie effective : celle choisie si elle existe encore, sinon la catégorie par défaut. */
export function categorieDe(a: Actif, categories: string[]): string {
  return a.categorie && categories.includes(a.categorie) ? a.categorie : categorieParDefaut(a);
}

export type Tri = "manuel" | "symbole" | "variation";
export const LIBELLE_TRI: Record<Tri, string> = { manuel: "Mon ordre", symbole: "A → Z", variation: "Variation" };

export interface Groupe {
  nom: string;
  actifs: Actif[];
}

/**
 * Regroupe les actifs par catégorie (dans l'ordre des catégories) et applique le tri à l'intérieur.
 * Une catégorie vide est conservée (pour pouvoir y déplacer des actifs), sauf la catégorie par défaut
 * qui n'existerait que par accident (ex. « Non classé » supprimée mais encore utilisée).
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

/** Déplace une catégorie devant `avant` (ou à la fin si null). `ordre` : noms dans l'ordre affiché. Null si rien ne change. */
export function deplacerCategorie(ordre: string[], nom: string, avant: string | null): string[] | null {
  if (!ordre.includes(nom) || nom === avant) return null;
  const sans = ordre.filter((n) => n !== nom);
  const i = avant === null ? sans.length : sans.indexOf(avant);
  if (i < 0) return null;
  const suite = [...sans.slice(0, i), nom, ...sans.slice(i)];
  return suite.every((n, k) => n === ordre[k]) ? null : suite;
}
