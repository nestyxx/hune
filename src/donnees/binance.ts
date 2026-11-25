import type { DataProvider } from "./fournisseur";
import { barresVisees, fusionnerPages, type Profondeur } from "./historique";
import { getJson } from "./http";
import { Requeteur } from "./requeteur";
import type { Bougie, Cotation, Intervalle, ResultatRecherche } from "./types";

const REST = "https://api.binance.com/api/v3";
const WS = "wss://stream.binance.com:9443/ws";
/** Devises de cotation proposées dans la recherche (évite des milliers de paires exotiques). */
const DEVISES = ["USDT", "USDC", "EUR"];

interface InfoSymbole {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

/** Ligne de bougie Binance : [tempsOuvertureMs, o, h, l, c, volume, …]. */
type LigneKline = [number, string, string, string, string, string, ...unknown[]];

const versBougie = (l: LigneKline): Bougie => ({
  temps: Math.floor(l[0] / 1000),
  ouverture: +l[1],
  haut: +l[2],
  bas: +l[3],
  cloture: +l[4],
  volume: +l[5],
});

/** Crypto : API publique Binance (REST + WebSocket), sans clé, temps réel. */
export class Binance implements DataProvider {
  readonly id = "binance" as const;
  readonly nom = "Binance";
  readonly differe = false;
  readonly noteDonnees = "Prix en temps réel (API publique Binance, sans clé).";
  private requeteur = new Requeteur();

  async rechercher(requete: string): Promise<ResultatRecherche[]> {
    const q = requete.trim().toUpperCase();
    if (!q) return [];
    // La liste des paires est lourde : on la garde 6 h en cache.
    const info = await this.requeteur.obtenir("exchangeInfo", 6 * 3600_000, () =>
      getJson<{ symbols: InfoSymbole[] }>(`${REST}/exchangeInfo?permissions=SPOT`),
    );
    return info.symbols
      .filter((s) => s.status === "TRADING" && DEVISES.includes(s.quoteAsset) && (s.symbol.includes(q) || s.baseAsset.includes(q)))
      // Les symboles qui commencent par la saisie d'abord, puis USDT avant les autres devises.
      .sort((a, b) => +b.symbol.startsWith(q) - +a.symbol.startsWith(q) || DEVISES.indexOf(a.quoteAsset) - DEVISES.indexOf(b.quoteAsset) || a.symbol.length - b.symbol.length)
      .slice(0, 12)
      .map((s) => ({ source: "binance", symbole: s.symbol, nom: `${s.baseAsset}/${s.quoteAsset}`, detail: "Crypto · Binance" }));
  }

  /**
   * Tous les intervalles proposés existent tels quels chez Binance (15m, 1h, 4h, 1d, 1w, 1M). Au-delà de 1000 bougies,
   * on remonte dans le temps page par page (`endTime`), jusqu'au nombre visé ou jusqu'au début de la cotation.
   */
  async bougies(symbole: string, intervalle: Intervalle, profondeur: Profondeur = "standard"): Promise<Bougie[]> {
    const cible = barresVisees(intervalle, profondeur);
    const pages: Bougie[][] = [];
    let total = 0;
    let fin: number | undefined; // ouverture (ms) de la plus ancienne bougie déjà reçue, moins 1
    for (let n = 0; n < 15 && total < cible; n++) {
      const limite = Math.min(1000, cible - total);
      const url = `${REST}/klines?symbol=${encodeURIComponent(symbole)}&interval=${intervalle}&limit=${limite}${fin ? `&endTime=${fin}` : ""}`;
      // Les pages anciennes ne changent plus : on les garde longtemps en cache ; la page courante, quelques secondes.
      const lignes = await this.requeteur.obtenir(`k:${symbole}:${intervalle}:${limite}:${fin ?? "now"}`, fin ? 3600_000 : 10_000, () => getJson<LigneKline[]>(url));
      if (!lignes.length) break;
      pages.push(lignes.map(versBougie));
      total += lignes.length;
      fin = lignes[0][0] - 1;
      if (lignes.length < limite) break; // début de l'historique atteint
    }
    return fusionnerPages(pages);
  }

  async cotations(symboles: string[]): Promise<Cotation[]> {
    if (!symboles.length) return [];
    const liste = [...symboles].sort();
    const rep = await this.requeteur.obtenir(`t:${liste.join(",")}`, 10_000, () =>
      getJson<{ symbol: string; lastPrice: string; priceChangePercent: string }[]>(
        `${REST}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(liste))}`,
      ),
    );
    return rep.map((t) => ({ symbole: t.symbol, prix: +t.lastPrice, variationPct: +t.priceChangePercent }));
  }

  /** Devise déduite du symbole : paires en EUR, sinon dollar (USDT/USDC… sont indexés sur l'USD). */
  async devise(symbole: string): Promise<string> {
    return symbole.endsWith("EUR") ? "EUR" : "USD";
  }

  /** Flux WebSocket de la bougie en cours, avec reconnexion automatique (délai croissant). */
  abonner(symbole: string, intervalle: Intervalle, surBougie: (b: Bougie) => void): () => void {
    let ws: WebSocket | null = null;
    let arrete = false;
    let essais = 0;
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    const ouvrir = () => {
      ws = new WebSocket(`${WS}/${symbole.toLowerCase()}@kline_${intervalle}`);
      ws.onopen = () => (essais = 0);
      ws.onmessage = (e) => {
        const k = JSON.parse(e.data as string).k;
        if (k) surBougie({ temps: Math.floor(k.t / 1000), ouverture: +k.o, haut: +k.h, bas: +k.l, cloture: +k.c, volume: +k.v });
      };
      ws.onclose = () => {
        if (arrete) return;
        essais++;
        minuterie = setTimeout(ouvrir, Math.min(1000 * 2 ** essais, 30_000));
      };
    };
    ouvrir();
    return () => {
      arrete = true;
      clearTimeout(minuterie);
      ws?.close();
    };
  }
}
