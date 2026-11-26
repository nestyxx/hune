import type { Actif } from "./donnees/types";

/** Quotes à retirer d'un symbole de paire (BTCUSDT → BTC). Les plus longues d'abord. */
const QUOTES = ["FDUSD", "USDT", "USDC", "BUSD", "TUSD", "EUR", "USD", "BTC", "ETH", "BNB"];

/**
 * Jeton de base d'un actif crypto (« BTC » pour BTCUSDC ou BTC-USD) ; null pour une action ou un autre titre.
 * Binance : `nom` vaut « BASE/QUOTE » ; à défaut on retire la devise de cotation du symbole.
 */
export function baseCrypto(actif: Pick<Actif, "source" | "symbole" | "nom">): string | null {
  if (actif.source === "binance") {
    const base = actif.nom.split("/")[0];
    if (/^[A-Z0-9]{1,12}$/.test(base) && actif.nom.includes("/")) return base;
    const q = QUOTES.find((c) => actif.symbole.endsWith(c) && actif.symbole.length > c.length);
    return q ? actif.symbole.slice(0, -q.length) : actif.symbole;
  }
  // Yahoo : les cryptos sont des paires « BTC-USD » ; tout le reste (AAPL, MC.PA…) est un titre.
  const m = /^([A-Z0-9]{2,10})-(USD|EUR)$/.exec(actif.symbole);
  return m ? m[1] : null;
}

/** Lettres de la pastille quand il n'y a pas d'icône : 1 ou 2 caractères du symbole (hors suffixe de place). */
export function initiales(actif: Pick<Actif, "source" | "symbole" | "nom">): string {
  const base = baseCrypto(actif) ?? actif.symbole.split(".")[0];
  const lettres = base.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return lettres.slice(0, lettres.length > 4 ? 1 : 2) || "?";
}

/** Teinte stable (0–359) déduite du texte : un même actif garde toujours la même couleur de pastille. */
export function teinte(texte: string): number {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return h % 360;
}
