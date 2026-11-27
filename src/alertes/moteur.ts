import { SECONDES_INTERVALLE, type Actif, type Bougie, type Intervalle } from "../donnees/types";
import { ema, macd, rsi, sma, type Serie } from "../indicateurs/indicateurs";

/** Périodes proposées pour une alerte de variation, en secondes. */
export const PERIODES_VARIATION = { "1h": 3600, "4h": 14400, "24h": 86400 } as const;
export type PeriodeVariation = keyof typeof PERIODES_VARIATION;

export type SensCroisement = "haussier" | "baissier";
export type Moyenne = "sma" | "ema";

export type Condition =
  | { type: "prix"; sens: "au-dessus" | "en-dessous"; seuil: number }
  | { type: "variation"; sens: "hausse" | "baisse"; pct: number; periode: PeriodeVariation }
  | { type: "rsi"; sens: "au-dessus" | "en-dessous"; seuil: number; intervalle: Intervalle }
  /** MACD qui croise sa ligne de signal (haussier : par le haut). */
  | { type: "croisement"; modele: "macd"; sens: SensCroisement; intervalle: Intervalle }
  /** Moyenne rapide qui croise la moyenne lente (haussier = « golden cross », baissier = « death cross »). */
  | { type: "croisement"; modele: "moyennes"; moyenne: Moyenne; rapide: number; lente: number; sens: SensCroisement; intervalle: Intervalle }
  /** Le cours qui franchit une moyenne mobile. */
  | { type: "franchissement"; moyenne: Moyenne; periode: number; sens: "au-dessus" | "en-dessous"; intervalle: Intervalle };

/** Une alerte se déclenche une fois (« declenchee »), puis attend d'être réarmée à la main. */
export interface Alerte {
  id: string;
  actif: Actif;
  condition: Condition;
  statut: "armee" | "declenchee";
  creeeLe: number;
  declencheeLe?: number;
  /** Valeur mesurée au déclenchement (prix, % ou RSI), affichée dans la liste. */
  valeur?: number;
  /** Alerte créée automatiquement pour l'objectif (TP) de ce lot du portefeuille : elle suit l'objectif. */
  tpLot?: string;
  /** Idem pour le stop loss de ce lot (alerte « prix ≤ stop »). */
  slLot?: string;
}

/** Données dont l'évaluation a besoin ; seules celles de la condition sont lues. */
export interface Contexte {
  prix: number;
  /** Bougies 15 min récentes (variation). */
  bougies15m?: Bougie[];
  /** Bougies de l'intervalle de l'alerte (RSI, croisements, franchissements). */
  bougiesIntervalle?: Bougie[];
  /** Heure courante en secondes Unix. */
  maintenant: number;
  /** Création de l'alerte (ms) : un croisement antérieur à cet instant ne la déclenche pas. */
  creeeLe?: number;
}

/**
 * Variation en % entre le prix à (maintenant − période) et le prix actuel.
 * Référence = ouverture de la bougie 15 min qui contient l'instant de départ. Null si l'historique ne remonte pas assez loin.
 */
export function variationSur(bougies: Bougie[], prixActuel: number, periodeSecondes: number, maintenant: number): number | null {
  const depart = maintenant - periodeSecondes;
  let ref: Bougie | undefined;
  for (const b of bougies) {
    if (b.temps <= depart) ref = b;
    else break;
  }
  if (!ref || ref.ouverture === 0) return null;
  return ((prixActuel - ref.ouverture) / ref.ouverture) * 100;
}

/**
 * Cherche un croisement de `a` par rapport à `b` sur les dernières bougies **clôturées** (celle en cours est
 * ignorée : son indicateur peut encore bouger). Renvoie vrai si le croisement dans le sens demandé s'est produit
 * sur une bougie close après `apresS` (secondes Unix), parmi les `fenetre` dernières bougies.
 * `a` croise `b` par le haut : a ≤ b à la bougie précédente puis a > b.
 */
export function croisementRecent(
  a: Serie,
  b: Serie,
  bougies: Bougie[],
  intervalle: Intervalle,
  sens: "haut" | "bas",
  maintenant: number,
  apresS: number,
  fenetre = 3,
): boolean {
  const pas = SECONDES_INTERVALLE[intervalle];
  // Dernière bougie réellement close : son heure de fin est passée.
  let fin = bougies.length - 1;
  while (fin >= 0 && bougies[fin].temps + pas > maintenant) fin--;
  for (let i = fin; i > Math.max(0, fin - fenetre); i--) {
    if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
    const avant = a[i - 1]! - b[i - 1]!;
    const apres = a[i]! - b[i]!;
    const croise = sens === "haut" ? avant <= 0 && apres > 0 : avant >= 0 && apres < 0;
    if (croise && bougies[i].temps + pas > apresS) return true; // heure de clôture de la bougie du croisement
  }
  return false;
}

const moyenneMobile = (m: Moyenne, valeurs: number[], periode: number) => (m === "sma" ? sma(valeurs, periode) : ema(valeurs, periode));

/** Valeur mesurée pour la condition (prix, variation en % ou RSI), ou null si les données manquent. */
export function mesurer(c: Condition, ctx: Contexte): number | null {
  switch (c.type) {
    case "prix":
    case "croisement":
    case "franchissement":
      return ctx.prix;
    case "variation":
      return ctx.bougies15m ? variationSur(ctx.bougies15m, ctx.prix, PERIODES_VARIATION[c.periode], ctx.maintenant) : null;
    case "rsi": {
      if (!ctx.bougiesIntervalle?.length) return null;
      const r = rsi(ctx.bougiesIntervalle.map((b) => b.cloture), 14);
      return r[r.length - 1];
    }
  }
}

/** Dit si la condition est remplie. `valeur` est la mesure (null si indisponible : jamais de déclenchement). */
export function evaluer(c: Condition, ctx: Contexte): { declenche: boolean; valeur: number | null } {
  const valeur = mesurer(c, ctx);
  if (valeur == null || !Number.isFinite(valeur)) return { declenche: false, valeur: null };
  switch (c.type) {
    case "prix":
    case "rsi":
      return { declenche: c.sens === "au-dessus" ? valeur >= c.seuil : valeur <= c.seuil, valeur };
    case "variation":
      return { declenche: c.sens === "hausse" ? valeur >= c.pct : valeur <= -c.pct, valeur };
    case "croisement":
    case "franchissement": {
      const b = ctx.bougiesIntervalle;
      if (!b || b.length < 3) return { declenche: false, valeur };
      const cl = b.map((x) => x.cloture);
      const depuis = (ctx.creeeLe ?? 0) / 1000;
      let declenche = false;
      if (c.type === "franchissement") {
        // Le cours (clôtures) croise sa moyenne : « au-dessus » = par le haut.
        declenche = croisementRecent(cl, moyenneMobile(c.moyenne, cl, c.periode), b, c.intervalle, c.sens === "au-dessus" ? "haut" : "bas", ctx.maintenant, depuis);
      } else if (c.modele === "macd") {
        const m = macd(cl);
        declenche = croisementRecent(m.macd, m.signal, b, c.intervalle, c.sens === "haussier" ? "haut" : "bas", ctx.maintenant, depuis);
      } else {
        declenche = croisementRecent(
          moyenneMobile(c.moyenne, cl, c.rapide),
          moyenneMobile(c.moyenne, cl, c.lente),
          b,
          c.intervalle,
          c.sens === "haussier" ? "haut" : "bas",
          ctx.maintenant,
          depuis,
        );
      }
      return { declenche, valeur };
    }
  }
}

/** Phrase lisible décrivant la condition. */
export function decrire(c: Condition): string {
  const n = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 8 });
  const nomMoyenne = (m: Moyenne) => m.toUpperCase();
  switch (c.type) {
    case "prix":
      return `Prix ${c.sens === "au-dessus" ? "≥" : "≤"} ${n(c.seuil)}`;
    case "variation":
      return `${c.sens === "hausse" ? "Hausse" : "Baisse"} d'au moins ${n(c.pct)} % sur ${c.periode}`;
    case "rsi":
      return `RSI 14 (${c.intervalle}) ${c.sens === "au-dessus" ? "≥" : "≤"} ${n(c.seuil)}`;
    case "franchissement":
      return `Cours ${c.sens === "au-dessus" ? "passe au-dessus" : "passe sous"} ${nomMoyenne(c.moyenne)} ${c.periode} (${c.intervalle})`;
    case "croisement":
      return c.modele === "macd"
        ? `MACD croise son signal à la ${c.sens === "haussier" ? "hausse" : "baisse"} (${c.intervalle})`
        : `${nomMoyenne(c.moyenne)} ${c.rapide}/${c.lente} : croisement ${c.sens === "haussier" ? "haussier (golden cross)" : "baissier (death cross)"} (${c.intervalle})`;
  }
}
