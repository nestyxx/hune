import type { Actif } from "./types";
import { baseCrypto } from "../icones";
import { getJson } from "./http";
import { Requeteur } from "./requeteur";

const BASE = "https://query2.finance.yahoo.com";

export interface Actualite {
  titre: string;
  editeur: string;
  /** Publication, en secondes Unix. */
  date: number;
  lien: string;
}

interface BrutActualite {
  title?: string;
  publisher?: string;
  providerPublishTime?: number;
  link?: string;
  relatedTickers?: string[];
}

/** Garde les actualités qui concernent vraiment le symbole (Yahoo renvoie aussi des articles seulement proches), les plus récentes d'abord. */
export function actualitesPertinentes(brutes: BrutActualite[], symboleYahoo: string): Actualite[] {
  return brutes
    .filter((n) => n.title && n.providerPublishTime && (n.relatedTickers ?? []).includes(symboleYahoo))
    .map((n) => ({ titre: n.title!, editeur: n.publisher ?? "", date: n.providerPublishTime!, lien: n.link ?? "" }))
    .sort((a, b) => b.date - a.date);
}

/**
 * Une actualité est « nouvelle » si elle date de moins de `delaiS` secondes et n'a pas été vue :
 * `vuLe` est l'instant (ms) de la dernière ouverture des actualités de cet actif.
 */
export function actualiteNouvelle(actus: Actualite[], vuLe: number, maintenantMs: number, delaiS = 24 * 3600): Actualite | null {
  const recente = actus[0];
  if (!recente) return null;
  const ms = recente.date * 1000;
  return maintenantMs - ms <= delaiS * 1000 && ms > vuLe ? recente : null;
}

/** Nombre d'actualités nouvelles (même règle que `actualiteNouvelle`) : récentes et publiées après la dernière consultation. */
export function nombreNouvelles(actus: Actualite[], vuLe: number, maintenantMs: number, delaiS = 24 * 3600): number {
  return actus.filter((a) => maintenantMs - a.date * 1000 <= delaiS * 1000 && a.date * 1000 > vuLe).length;
}

const requeteur = new Requeteur();

async function chercher(q: string): Promise<BrutActualite[]> {
  const rep = await requeteur.obtenir(`n:${q.toLowerCase()}`, 10 * 60_000, () =>
    getJson<{ news?: BrutActualite[] }>(`${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=10`),
  );
  return rep.news ?? [];
}

/**
 * Actualités récentes d'un actif, via la recherche Yahoo Finance (déjà utilisée pour les cours ; aucune donnée vous concernant n'est envoyée).
 * Titres et symbole Yahoo : pour une crypto, la recherche par symbole ne renvoie rien, on passe par son nom (« Bitcoin USD » → « Bitcoin »).
 */
export async function actualitesActif(actif: Pick<Actif, "source" | "symbole" | "nom">): Promise<Actualite[]> {
  const base = baseCrypto(actif);
  if (!base) return actualitesPertinentes(await chercher(actif.symbole), actif.symbole);
  const symboleYahoo = `${base}-USD`;
  const rep = await requeteur.obtenir(`nom:${symboleYahoo}`, 24 * 3600_000, () =>
    getJson<{ quotes?: { symbol: string; shortname?: string; longname?: string }[] }>(`${BASE}/v1/finance/search?q=${encodeURIComponent(symboleYahoo)}&quotesCount=3&newsCount=0`),
  );
  const nom = rep.quotes?.find((q) => q.symbol === symboleYahoo);
  const mot = (nom?.shortname ?? nom?.longname ?? "").replace(/\s+USD$/i, "").trim();
  return mot ? actualitesPertinentes(await chercher(mot), symboleYahoo) : [];
}
