import { agreger } from "./agreger";
import type { DataProvider } from "./fournisseur";
import { getJson } from "./http";
import { Requeteur } from "./requeteur";
import { SECONDES_INTERVALLE, type Bougie, type Cotation, type Intervalle, type ResultatRecherche } from "./types";

// Endpoints NON officiels de Yahoo Finance : peuvent changer ou être limités sans préavis.
const BASE = "https://query1.finance.yahoo.com";

/** Intervalle Yahoo + profondeur d'historique demandée. Le 4 h n'existe pas : on agrège du 1 h. */
const PARAMS: Record<Intervalle, { interval: string; range: string }> = {
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "60m", range: "6mo" },
  "4h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "2y" },
};

interface ReponseChart {
  chart: {
    result?: {
      meta: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; currency?: string };
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

/** Actions : Yahoo Finance (non officiel). Données généralement différées d'environ 15 minutes selon la place. */
export class Yahoo implements DataProvider {
  readonly id = "yahoo" as const;
  readonly nom = "Yahoo Finance";
  readonly differe = true;
  readonly noteDonnees = "Données différées (souvent ~15 min selon la place de cotation). Source Yahoo Finance non officielle.";
  private requeteur = new Requeteur();

  async rechercher(requete: string): Promise<ResultatRecherche[]> {
    const q = requete.trim();
    if (!q) return [];
    const rep = await this.requeteur.obtenir(`s:${q.toLowerCase()}`, 5 * 60_000, () =>
      getJson<{ quotes?: { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }[] }>(
        `${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
      ),
    );
    return (rep.quotes ?? [])
      // Les cryptos sont gérées par Binance ; on ne garde ici que actions, ETF et indices.
      .filter((r) => ["EQUITY", "ETF", "INDEX"].includes(r.quoteType ?? ""))
      .map((r) => ({
        source: "yahoo" as const,
        symbole: r.symbol,
        nom: r.longname ?? r.shortname ?? r.symbol,
        detail: `${r.quoteType === "EQUITY" ? "Action" : r.quoteType === "ETF" ? "ETF" : "Indice"} · ${r.exchDisp ?? "?"}`,
      }));
  }

  private async chart(symbole: string, interval: string, range: string) {
    const rep = await this.requeteur.obtenir(`c:${symbole}:${interval}:${range}`, 30_000, () =>
      getJson<ReponseChart>(`${BASE}/v8/finance/chart/${encodeURIComponent(symbole)}?interval=${interval}&range=${range}&includePrePost=false`),
    );
    const res = rep.chart.result?.[0];
    if (!res) throw new Error(rep.chart.error?.description ?? `Symbole introuvable : ${symbole}`);
    return res;
  }

  async bougies(symbole: string, intervalle: Intervalle): Promise<Bougie[]> {
    const { interval, range } = PARAMS[intervalle];
    const res = await this.chart(symbole, interval, range);
    const q = res.indicators.quote[0];
    const sortie: Bougie[] = [];
    (res.timestamp ?? []).forEach((temps, i) => {
      // Yahoo renvoie des trous (null) hors séance : on les saute.
      if (q.open[i] == null || q.high[i] == null || q.low[i] == null || q.close[i] == null) return;
      sortie.push({ temps, ouverture: q.open[i]!, haut: q.high[i]!, bas: q.low[i]!, cloture: q.close[i]!, volume: q.volume[i] ?? 0 });
    });
    return intervalle === "4h" ? agreger(sortie, SECONDES_INTERVALLE["4h"]) : sortie;
  }

  /**
   * Cotations par paquets de 20 via l'endpoint groupé `spark` (sans cookie ni crumb) : une trentaine d'actions
   * coûtent 2 requêtes au lieu de 30, ce qui évite le rate limit. Un symbole inconnu est simplement absent de la réponse.
   */
  async cotations(symboles: string[]): Promise<Cotation[]> {
    const liste = [...new Set(symboles)].sort();
    const paquets: string[][] = [];
    for (let i = 0; i < liste.length; i += 20) paquets.push(liste.slice(i, i + 20));
    const reponses = await Promise.all(
      paquets.map((p) =>
        this.requeteur.obtenir(`q:${p.join(",")}`, 30_000, () =>
          getJson<Record<string, { close?: (number | null)[]; chartPreviousClose?: number | null; previousClose?: number | null }>>(
            `${BASE}/v8/finance/spark?symbols=${encodeURIComponent(p.join(","))}&range=1d&interval=1d`,
          ),
        ),
      ),
    );
    const sortie: Cotation[] = [];
    for (const rep of reponses) {
      for (const [symbole, d] of Object.entries(rep)) {
        // Dernier cours non nul de la séance (cohérent avec le graphique).
        const prix = [...(d.close ?? [])].reverse().find((v) => v != null);
        if (prix == null) continue;
        const ref = d.chartPreviousClose ?? d.previousClose;
        sortie.push({ symbole, prix, variationPct: ref ? ((prix - ref) / ref) * 100 : null });
      }
    }
    return sortie;
  }

  /** Devise de cotation lue dans les métadonnées du graphique (mise en cache 24 h : elle ne change pas). */
  async devise(symbole: string): Promise<string> {
    return this.requeteur.obtenir(`dev:${symbole}`, 24 * 3600_000, async () => {
      const { meta } = await this.chart(symbole, "1d", "5d");
      return meta.currency ?? "EUR";
    });
  }
}
