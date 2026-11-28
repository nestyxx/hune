import { useEffect, useSyncExternalStore } from "react";
import { getJson } from "./donnees/http";
import type { Actif } from "./donnees/types";
import { baseCrypto } from "./icones";
import { detailTitre, nomConnu } from "./noms-affiches";

/**
 * Vrais noms des cryptos (BTC → Bitcoin). Binance ne les fournit pas : on les lit une fois par jeton dans la recherche
 * Yahoo Finance (« BTC-USD » → « Bitcoin USD »), puis on les garde sur ce poste. Seul le symbole du jeton est envoyé.
 */
const CLE = "hune.nomsCryptos";
const BASE = "https://query2.finance.yahoo.com";

let noms: Record<string, string> = lire();
const abonnes = new Set<() => void>();
let version = 0;
const enCours = new Set<string>();
const echecs = new Map<string, number>();

function lire(): Record<string, string> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(brut).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** « Bitcoin USD » → « Bitcoin ». */
export function nettoyerNom(nom: string): string {
  return nom.replace(/\s+(USD|USDT|EUR)$/i, "").trim();
}

/** Nom d'une crypto connu pour ce jeton (null tant qu'il n'est pas chargé ou s'il est introuvable). */
export function nomCrypto(base: string): string | null {
  return noms[base] ?? null;
}

/**
 * Nom à afficher pour un actif : pour une crypto, son vrai nom (Bitcoin) s'il est connu, sinon le libellé de la source ;
 * pour un titre, le nom fourni par la source.
 */
export function nomAffiche(actif: Pick<Actif, "source" | "symbole" | "nom">): string {
  const base = baseCrypto(actif);
  return (base && noms[base]) || nomConnu(actif) || actif.nom;
}

/** Vrai quand le libellé de la source n'est que la paire (BTC/USDC) et n'apporte rien en plus du symbole. */
export function nomEstUnePaire(nom: string): boolean {
  return /^[A-Z0-9]+\/[A-Z0-9]+$/.test(nom);
}

/** Parmi les résultats d'une recherche CoinGecko, le jeton de ce symbole le mieux classé en capitalisation (les homonymes sans rang sont écartés). */
export function choisirCoin(coins: { name?: string; symbol?: string; market_cap_rank?: number | null }[], base: string): string | null {
  const candidats = coins.filter((c) => c.name && c.symbol?.toUpperCase() === base.toUpperCase() && c.market_cap_rank != null);
  candidats.sort((a, b) => a.market_cap_rank! - b.market_cap_rank!);
  return candidats[0]?.name ?? null;
}

/** Repli quand Yahoo ne connaît pas le jeton : recherche publique CoinGecko (seul le symbole du jeton est envoyé). */
async function nomCoinGecko(base: string): Promise<string | null> {
  const rep = await getJson<{ coins?: { name?: string; symbol?: string; market_cap_rank?: number | null }[] }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(base)}`);
  return choisirCoin(rep.coins ?? [], base);
}

async function charger(base: string): Promise<void> {
  if (enCours.has(base) || noms[base]) return;
  if ((echecs.get(base) ?? 0) >= 2) return;
  enCours.add(base);
  try {
    const symbole = `${base}-USD`;
    const rep = await getJson<{ quotes?: { symbol: string; shortname?: string; longname?: string }[] }>(`${BASE}/v1/finance/search?q=${encodeURIComponent(symbole)}&quotesCount=3&newsCount=0`);
    const q = rep.quotes?.find((x) => x.symbol === symbole);
    let nom = nettoyerNom(q?.shortname ?? q?.longname ?? "");
    if (!nom || nom.toUpperCase() === base) nom = (await nomCoinGecko(base).catch(() => null)) ?? "";
    if (nom && nom.toUpperCase() !== base) {
      noms = { ...noms, [base]: nom };
      try {
        localStorage.setItem(CLE, JSON.stringify(noms));
      } catch {
        // stockage indisponible : le nom sera relu à la prochaine ouverture
      }
      version++;
      abonnes.forEach((f) => f());
    } else echecs.set(base, (echecs.get(base) ?? 0) + 1);
  } catch {
    echecs.set(base, (echecs.get(base) ?? 0) + 1);
  } finally {
    enCours.delete(base);
  }
}

/** Charge (deux requêtes à la fois au plus) les noms manquants des cryptos de la liste. */
async function chargerManquants(bases: string[]): Promise<void> {
  const file = bases.filter((b) => !noms[b]);
  const travailleur = async () => {
    for (let b = file.shift(); b !== undefined; b = file.shift()) await charger(b);
  };
  await Promise.all([travailleur(), travailleur()]);
}

/** À appeler dans un composant qui affiche des noms : charge ceux qui manquent et se réaffiche quand ils arrivent. */
export function useNomsCryptos(actifs: Pick<Actif, "source" | "symbole" | "nom">[]): void {
  useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => version,
  );
  const cle = actifs
    .map((a) => baseCrypto(a))
    .filter((b): b is string => !!b)
    .join(",");
  useEffect(() => {
    if (cle) void chargerManquants([...new Set(cle.split(","))]);
  }, [cle]);
}

/** Deuxième ligne d'un actif : « OVH.PA · Paris » pour un titre, sinon son nom (Bitcoin, Or, CAC 40…). */
export function libelleSecondaire(actif: Pick<Actif, "source" | "symbole" | "nom">): string {
  return detailTitre(actif) ?? nomAffiche(actif);
}
