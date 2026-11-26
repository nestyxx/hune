/** Types communs aux sources de données. Tout est en lecture seule : aucune notion de compte ni d'ordre. */

/** Intervalles proposés dans le graphique. */
export type Intervalle = "15m" | "1h" | "4h" | "1d" | "1w" | "1M";
export const INTERVALLES: Intervalle[] = ["15m", "1h", "4h", "1d", "1w", "1M"];
export const LIBELLE_INTERVALLE: Record<Intervalle, string> = { "15m": "15 min", "1h": "1 h", "4h": "4 h", "1d": "1 j", "1w": "1 sem", "1M": "1 mois" };
/** Durée d'une bougie en secondes (le mois est approximé à 30 jours : il ne sert qu'aux calculs de clôture). */
export const SECONDES_INTERVALLE: Record<Intervalle, number> = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800, "1M": 2592000 };

/** Une bougie ; `temps` = ouverture, en secondes Unix (UTC). */
export interface Bougie {
  temps: number;
  ouverture: number;
  haut: number;
  bas: number;
  cloture: number;
  volume: number;
}

export type SourceId = "binance" | "yahoo";

/**
 * Définition de la variation affichée pour les cryptos : « 24h » = glissante sur les dernières 24 heures ;
 * « jour » = depuis l'ouverture du jour à 00:00 UTC (comme TradingView). Les actions (Yahoo) sont toujours
 * comparées à la clôture précédente.
 */
export type ModeVariation = "24h" | "jour";

/** Un actif suivi. `symbole` est celui de la source (BTCUSDT, AAPL, MC.PA…). */
export interface Actif {
  source: SourceId;
  symbole: string;
  nom: string;
  /** Catégorie choisie dans la watchlist ; absente = catégorie par défaut selon la source. */
  categorie?: string;
}

export const cleActif = (a: Pick<Actif, "source" | "symbole">) => `${a.source}:${a.symbole}`;

/** Dernier prix connu d'un actif. */
export interface Cotation {
  symbole: string;
  prix: number;
  /** Variation en % sur 24 h (crypto) ou depuis la clôture précédente (actions) ; null si inconnue. */
  variationPct: number | null;
}

/** Résultat de recherche. */
export interface ResultatRecherche extends Actif {
  /** Précision affichée : place de cotation, type d'instrument. */
  detail: string;
}
