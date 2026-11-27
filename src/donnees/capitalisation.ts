import { getJson } from "./http";
import { Requeteur } from "./requeteur";

/**
 * Capitalisation du marché crypto : total, dominance du Bitcoin, total sans Bitcoin (« TOTAL2 ») et sans Bitcoin ni Ethereum (« TOTAL3 »).
 * Source : l'API publique CoinGecko (une requête, sans clé ni compte). CoinGecko agrège plus de 20 000 jetons, alors que TradingView
 * s'arrête aux 125 premiers : les valeurs diffèrent de quelques pour cent, la tendance est la même.
 */
export interface Capitalisation {
  /** En dollars. */
  total: number;
  /** En % de la capitalisation totale. */
  dominanceBtc: number;
  dominanceEth: number;
  total2: number;
  total3: number;
  /** Variation de la capitalisation totale sur 24 h, en %. */
  variation24h: number | null;
  /** Instant de la donnée, en ms. */
  majLe: number;
}

interface ReponseGlobale {
  data?: {
    total_market_cap?: Record<string, number>;
    market_cap_percentage?: Record<string, number>;
    market_cap_change_percentage_24h_usd?: number;
    updated_at?: number;
  };
}

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Déduit TOTAL2 et TOTAL3 des parts de marché ; null si la réponse est incomplète. */
export function calculerCapitalisation(rep: ReponseGlobale, maintenantMs = Date.now()): Capitalisation | null {
  const d = rep.data;
  const total = d?.total_market_cap?.usd;
  const btc = d?.market_cap_percentage?.btc;
  const eth = d?.market_cap_percentage?.eth;
  if (!nombre(total) || !nombre(btc) || !nombre(eth) || total <= 0) return null;
  return {
    total,
    dominanceBtc: btc,
    dominanceEth: eth,
    total2: total * (1 - btc / 100),
    total3: total * (1 - (btc + eth) / 100),
    variation24h: nombre(d?.market_cap_change_percentage_24h_usd) ? d.market_cap_change_percentage_24h_usd : null,
    majLe: nombre(d?.updated_at) ? d.updated_at * 1000 : maintenantMs,
  };
}

const requeteur = new Requeteur();

export async function chargerCapitalisation(): Promise<Capitalisation> {
  const rep = await requeteur.obtenir("global", 5 * 60_000, () => getJson<ReponseGlobale>("https://api.coingecko.com/api/v3/global"));
  const c = calculerCapitalisation(rep);
  if (!c) throw new Error("Réponse CoinGecko inattendue.");
  return c;
}
