import type { Actif, Cotation } from "./donnees/types";
import { cleActif } from "./donnees/types";

/**
 * Un lot détenu : saisi à la main ou importé. Lecture seule vis-à-vis des marchés : rien n'est jamais envoyé
 * à un courtier, ces données ne servent qu'à valoriser et à calculer des écarts.
 */
export interface Position {
  id: string;
  /** Clé de l'actif suivi (`source:symbole`). */
  cle: string;
  quantite?: number;
  /** Montant en euros connu à l'import, quand on n'a pas la quantité : elle est alors estimée au premier prix reçu. */
  montantEur?: number;
  /** Prix d'achat moyen pondéré (PAMP), dans la devise de cotation de l'actif. */
  pamp?: number;
  /** Prix objectif (« take profit »), dans la devise de cotation. */
  objectif?: number;
  plateforme?: string;
  /** La quantité a été déduite de `montantEur` (donc approximative). */
  estimee?: boolean;
  /** Achats et ventes à l'origine du lot (import d'un historique de transactions), prix dans la devise de cotation. */
  mouvements?: Mouvement[];
}

/** Un achat ou une vente passé, pour le repérer sur le graphique. */
export interface Mouvement {
  /** Horodatage en ms. */
  date: number;
  sens: "achat" | "vente";
  quantite: number;
  /** Prix unitaire hors frais, dans la devise de cotation de l'actif. */
  prix: number;
}

/** Devise dans laquelle le portefeuille est présenté (les calculs restent en euros, la conversion se fait à l'affichage). */
export type DeviseAffichage = "EUR" | "USD";
export const SYMBOLE_DEVISE: Record<DeviseAffichage, string> = { EUR: "€", USD: "$" };

/** Colonnes triables du tableau du portefeuille et sens (-1 = décroissant). */
export type ColonnePortefeuille = "valeurEur" | "pnlPct" | "pnlEur" | "poids" | "versObjectifPct" | "symbole";
export interface TriPortefeuille {
  col: ColonnePortefeuille;
  sens: 1 | -1;
}
export const TRI_PORTEFEUILLE_PAR_DEFAUT: TriPortefeuille = { col: "valeurEur", sens: -1 };
const COLONNES_TRI: ColonnePortefeuille[] = ["valeurEur", "pnlPct", "pnlEur", "poids", "versObjectifPct", "symbole"];

/** Tri relu du fichier de données : toute valeur inattendue retombe sur le tri par défaut. */
export function triPortefeuilleValide(t: unknown): TriPortefeuille {
  const o = t as Partial<TriPortefeuille> | null | undefined;
  return o && COLONNES_TRI.includes(o.col as ColonnePortefeuille) && (o.sens === 1 || o.sens === -1) ? { col: o.col as ColonnePortefeuille, sens: o.sens } : TRI_PORTEFEUILLE_PAR_DEFAUT;
}

/** Montant en euros → devise d'affichage ; null si le taux de change manque. `taux` : valeur en euros d'une unité de chaque devise. */
export function versDevise(montantEur: number | null, devise: DeviseAffichage, taux: Record<string, number>): number | null {
  if (montantEur == null) return null;
  if (devise === "EUR") return montantEur;
  const t = taux[devise];
  return t ? montantEur / t : null;
}

/** Niveaux du portefeuille à tracer sur le graphique d'un actif. */
export interface NiveauxPortefeuille {
  pamp: number | null;
  objectif: number | null;
  /** Lots sans historique détaillé : un niveau d'achat par lot (leur PAMP). */
  achats: { prix: number; quantite: number; plateforme?: string }[];
  /** Achats et ventes connus, du plus ancien au plus récent. */
  mouvements: Mouvement[];
}

/** Niveaux à afficher pour les lots d'un même actif ; null si rien n'est à tracer. */
export function niveauxPortefeuille(lots: Position[]): NiveauxPortefeuille | null {
  const avecPamp = lots.filter((l) => l.pamp != null && l.quantite);
  const qPamp = avecPamp.reduce((s, l) => s + l.quantite!, 0);
  const pamp = qPamp > 0 ? avecPamp.reduce((s, l) => s + l.quantite! * l.pamp!, 0) / qPamp : null;
  const objectif = lots.find((l) => l.objectif != null)?.objectif ?? null;
  // Un seul lot : son niveau d'achat serait confondu avec le PAMP, on ne le trace pas deux fois.
  const lotsAchat = lots.filter((l) => l.pamp != null && l.quantite && !l.mouvements?.length);
  const achats = lotsAchat.length > 1 || (lotsAchat.length === 1 && lots.length > 1) ? lotsAchat.map((l) => ({ prix: l.pamp!, quantite: l.quantite!, plateforme: l.plateforme })) : [];
  const mouvements = lots.flatMap((l) => l.mouvements ?? []).sort((a, b) => a.date - b.date);
  return pamp == null && objectif == null && !achats.length && !mouvements.length ? null : { pamp, objectif, achats, mouvements };
}

export interface LignePortefeuille {
  cle: string;
  actif: Actif;
  quantite: number;
  pamp: number | null;
  /** Certains lots n'ont pas de PAMP : le P&L ne porte que sur les autres. */
  pampPartiel: boolean;
  estimee: boolean;
  prix: number | null;
  devise: string | null;
  valeurEur: number | null;
  /** P&L latent en euros et en % du coût, sur les lots qui ont un PAMP. */
  pnlEur: number | null;
  pnlPct: number | null;
  /** Part de la valeur totale (0–1), remplie par `ajouterPoids`. */
  poids: number | null;
  objectif: number | null;
  /** Distance du prix à l'objectif, en % du prix (positif = objectif au-dessus). */
  versObjectifPct: number | null;
  plateformes: string[];
  lots: Position[];
}

interface Entrees {
  actifs: Record<string, Actif>;
  cotations: Record<string, Cotation>;
  /** Devise de cotation par clé d'actif. */
  devises: Record<string, string>;
  /** Taux de conversion vers l'euro par devise. */
  taux: Record<string, number>;
}

/** Valeur en euros d'une quantité au prix donné ; null si le prix ou le taux manque. */
export function enEuros(montantDevise: number, devise: string | undefined, taux: Record<string, number>): number | null {
  const t = devise ? taux[devise] : undefined;
  return t == null ? null : montantDevise * t;
}

/** Regroupe les lots par actif et calcule valeur, P&L latent et écart à l'objectif. */
export function agreger(positions: Position[], e: Entrees): LignePortefeuille[] {
  const parActif = new Map<string, Position[]>();
  for (const p of positions) parActif.set(p.cle, [...(parActif.get(p.cle) ?? []), p]);

  const lignes: LignePortefeuille[] = [];
  for (const [cle, lots] of parActif) {
    const actif = e.actifs[cle];
    if (!actif) continue; // l'actif n'est plus suivi : ses lots restent stockés mais n'apparaissent pas
    const prix = e.cotations[cle]?.prix ?? null;
    const devise = e.devises[cle] ?? null;
    const quantite = lots.reduce((s, l) => s + (l.quantite ?? 0), 0);

    // PAMP pondéré par les quantités, sur les seuls lots qui en ont un.
    const avecPamp = lots.filter((l) => l.pamp != null && l.quantite);
    const qPamp = avecPamp.reduce((s, l) => s + l.quantite!, 0);
    const cout = avecPamp.reduce((s, l) => s + l.quantite! * l.pamp!, 0);
    const pamp = qPamp > 0 ? cout / qPamp : null;

    const valeurEur = prix != null ? enEuros(quantite * prix, devise ?? undefined, e.taux) : null;
    const pnlDevise = prix != null && pamp != null ? qPamp * prix - cout : null;
    const pnlEur = pnlDevise != null ? enEuros(pnlDevise, devise ?? undefined, e.taux) : null;
    const objectif = lots.find((l) => l.objectif != null)?.objectif ?? null;

    lignes.push({
      cle,
      actif,
      quantite,
      pamp,
      pampPartiel: avecPamp.length > 0 && avecPamp.length < lots.filter((l) => l.quantite).length,
      estimee: lots.some((l) => l.estimee),
      prix,
      devise,
      valeurEur,
      pnlEur,
      pnlPct: pnlDevise != null && cout > 0 ? (pnlDevise / cout) * 100 : null,
      poids: null,
      objectif,
      versObjectifPct: objectif != null && prix ? ((objectif - prix) / prix) * 100 : null,
      plateformes: [...new Set(lots.map((l) => l.plateforme).filter((x): x is string => !!x))],
      lots,
    });
  }
  return ajouterPoids(lignes);
}

/** Calcule la part de chaque ligne dans la valeur totale (les lignes sans valeur n'en ont pas). */
export function ajouterPoids(lignes: LignePortefeuille[]): LignePortefeuille[] {
  const total = lignes.reduce((s, l) => s + (l.valeurEur ?? 0), 0);
  return lignes.map((l) => ({ ...l, poids: l.valeurEur != null && total > 0 ? l.valeurEur / total : null }));
}

export interface Totaux {
  valeurEur: number;
  /** Coût et P&L ne portent que sur les lignes dont le PAMP est connu. */
  coutEur: number;
  pnlEur: number;
  pnlPct: number | null;
  /** Lignes non valorisées (prix ou taux de change manquant) : le total est alors partiel. */
  nonValorisees: number;
}

export function totaux(lignes: LignePortefeuille[]): Totaux {
  let valeurEur = 0;
  let pnlEur = 0;
  let coutEur = 0;
  let nonValorisees = 0;
  for (const l of lignes) {
    if (l.valeurEur == null) nonValorisees++;
    else valeurEur += l.valeurEur;
    if (l.pnlEur != null && l.pnlPct != null && l.pnlPct > -100) {
      pnlEur += l.pnlEur;
      coutEur += l.pnlEur / (l.pnlPct / 100) || 0;
    }
  }
  return { valeurEur, coutEur, pnlEur, pnlPct: coutEur > 0 ? (pnlEur / coutEur) * 100 : null, nonValorisees };
}

export interface PartRepartition {
  nom: string;
  valeurEur: number;
  part: number;
}

/** Répartition de la valeur selon un critère (catégorie, plateforme…), par ordre décroissant. */
export function repartition(elements: { nom: string; valeurEur: number | null }[]): PartRepartition[] {
  const somme = new Map<string, number>();
  for (const e of elements) if (e.valeurEur != null) somme.set(e.nom, (somme.get(e.nom) ?? 0) + e.valeurEur);
  const total = [...somme.values()].reduce((a, b) => a + b, 0);
  return [...somme.entries()].map(([nom, valeurEur]) => ({ nom, valeurEur, part: total > 0 ? valeurEur / total : 0 })).sort((a, b) => b.valeurEur - a.valeurEur);
}

/** Valeur en euros d'un lot (pour répartir par plateforme, car un actif peut être réparti sur plusieurs). */
export function valeurLotEur(l: Position, e: Entrees): number | null {
  const prix = e.cotations[l.cle]?.prix;
  if (prix == null || !l.quantite) return null;
  return enEuros(l.quantite * prix, e.devises[l.cle], e.taux);
}

export { cleActif };
