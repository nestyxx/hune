import type { Profondeur } from "./donnees/historique";
import type { Bougie, Intervalle, SourceId } from "./donnees/types";
import type { Position } from "./portefeuille";

/**
 * Valeur du portefeuille dans le temps, reconstituée localement : pour chaque actif, quantité détenue × cours de clôture
 * des bougies de la source, converti en euros. Rien n'est envoyé nulle part (seuls les cours publics sont lus).
 *
 * Précision : la quantité à chaque instant vient de l'historique des transactions importé quand on l'a ; pour un lot sans
 * historique, la quantité actuelle est supposée détenue sur toute la période (le graphique montre alors « ce que valaient
 * vos positions actuelles »). Les conversions de devises utilisent le taux du jour.
 */

export type PeriodePortefeuille = "24h" | "7j" | "30j" | "90j" | "1a" | "tout";

export interface SpecPeriode {
  id: PeriodePortefeuille;
  libelle: string;
  /** Durée affichée en secondes (null = tout l'historique chargé). */
  duree: number | null;
  /** Granularité des bougies utilisées. */
  intervalle: Extract<Intervalle, "1h" | "1d">;
  profondeur: Profondeur;
}

const JOUR = 86400;
export const PERIODES_PORTEFEUILLE: SpecPeriode[] = [
  { id: "24h", libelle: "24 h", duree: JOUR, intervalle: "1h", profondeur: "standard" },
  { id: "7j", libelle: "7 j", duree: 7 * JOUR, intervalle: "1h", profondeur: "standard" },
  { id: "30j", libelle: "30 j", duree: 30 * JOUR, intervalle: "1d", profondeur: "standard" },
  { id: "90j", libelle: "90 j", duree: 90 * JOUR, intervalle: "1d", profondeur: "standard" },
  { id: "1a", libelle: "1 an", duree: 365 * JOUR, intervalle: "1d", profondeur: "standard" },
  { id: "tout", libelle: "Tout", duree: null, intervalle: "1d", profondeur: "5a" },
];

const PERIODES_VALIDES = PERIODES_PORTEFEUILLE.map((p) => p.id);
export const PERIODE_PORTEFEUILLE_PAR_DEFAUT: PeriodePortefeuille = "30j";
/** Période relue du fichier de données : toute valeur inattendue retombe sur la période par défaut. */
export const periodeValide = (p: unknown): PeriodePortefeuille => (PERIODES_VALIDES.includes(p as PeriodePortefeuille) ? (p as PeriodePortefeuille) : PERIODE_PORTEFEUILLE_PAR_DEFAUT);
export const specPeriode = (p: PeriodePortefeuille): SpecPeriode => PERIODES_PORTEFEUILLE.find((s) => s.id === p)!;

/** Actif détenu : ses lots et la devise dans laquelle sa source le cote. */
export interface EntreeHistorique {
  cle: string;
  source: SourceId;
  symbole: string;
  /** Devise de cotation (EUR, USD, GBp…) : sert à trouver le taux de conversion vers l'euro. */
  devise: string | null;
  lots: Position[];
}

/** Quantité détenue à l'instant `tMs` : historique des transactions du lot si on l'a, sinon la quantité actuelle. */
export function quantiteA(lots: Position[], tMs: number): number {
  let total = 0;
  for (const lot of lots) {
    if (lot.mouvements?.length) {
      let q = 0;
      for (const m of lot.mouvements) if (m.date <= tMs) q += m.sens === "achat" ? m.quantite : -m.quantite;
      total += Math.max(0, q);
    } else total += lot.quantite ?? 0;
  }
  return total;
}

export interface PointValeur {
  /** Secondes Unix. */
  temps: number;
  valeurEur: number;
}

export interface HistoriqueCalcule {
  points: PointValeur[];
  /** Actifs absents du graphique (pas de bougies reçues ou pas de taux de change) : le total est alors partiel. */
  ignores: string[];
  /** Vrai si au moins un lot n'a pas d'historique de transactions (quantité actuelle supposée constante). */
  quantitesSupposees: boolean;
}

/**
 * Valeur totale en euros à chaque bougie de la période. `bougies` : bougies par clé d'actif (triées). Entre deux bougies
 * d'un actif (marché fermé), son dernier cours est conservé ; avant sa première bougie, il ne compte pas.
 */
export function valeurDansLeTemps(entrees: EntreeHistorique[], bougies: Record<string, Bougie[]>, taux: Record<string, number>, debut: number | null, fin: number): HistoriqueCalcule {
  const ignores: string[] = [];
  const utiles: { entree: EntreeHistorique; barres: Bougie[]; t: number }[] = [];
  for (const e of entrees) {
    const barres = bougies[e.cle];
    const t = e.devise ? taux[e.devise] : undefined;
    if (!barres?.length || !t) ignores.push(e.symbole);
    else utiles.push({ entree: e, barres, t });
  }
  const instants = new Set<number>();
  for (const u of utiles) for (const b of u.barres) if ((debut == null || b.temps >= debut) && b.temps <= fin) instants.add(b.temps);
  const grille = [...instants].sort((a, b) => a - b);

  const curseurs = utiles.map(() => -1); // dernier indice de bougie ≤ instant courant, par actif
  const points: PointValeur[] = [];
  for (const temps of grille) {
    let total = 0;
    utiles.forEach((u, i) => {
      while (curseurs[i] + 1 < u.barres.length && u.barres[curseurs[i] + 1].temps <= temps) curseurs[i]++;
      if (curseurs[i] < 0) return;
      total += quantiteA(u.entree.lots, temps * 1000) * u.barres[curseurs[i]].cloture * u.t;
    });
    points.push({ temps, valeurEur: total });
  }
  const quantitesSupposees = entrees.some((e) => e.lots.some((l) => !l.mouvements?.length && (l.quantite ?? 0) > 0));
  // Le graphique commence à la première valeur non nulle (avant vos premiers achats, il n'y a rien à montrer ni de % à calculer).
  const premier = points.findIndex((p) => p.valeurEur > 0);
  return { points: premier < 0 ? [] : points.slice(premier), ignores, quantitesSupposees };
}

/**
 * Télécharge les bougies de chaque actif, `concurrence` à la fois (la watchlist peut compter des dizaines d'actifs : on ne
 * lance pas tous les appels en même temps). Un actif en échec est simplement absent du résultat.
 */
export async function recupererBougies(
  entrees: Pick<EntreeHistorique, "cle" | "source" | "symbole">[],
  periode: SpecPeriode,
  charger: (source: SourceId, symbole: string, intervalle: Intervalle, profondeur: Profondeur) => Promise<Bougie[]>,
  concurrence = 5,
): Promise<Record<string, Bougie[]>> {
  const sortie: Record<string, Bougie[]> = {};
  let prochain = 0;
  const travailleur = async () => {
    while (prochain < entrees.length) {
      const e = entrees[prochain++];
      try {
        sortie[e.cle] = await charger(e.source, e.symbole, periode.intervalle, periode.profondeur);
      } catch {
        /* source en erreur : cet actif sera signalé comme ignoré */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrence, entrees.length) }, travailleur));
  return sortie;
}
