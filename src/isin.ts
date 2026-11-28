import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Actif } from "./donnees/types";
import { natureYahoo } from "./noms-affiches";

/**
 * ISIN d'un titre, pour vérifier d'un coup d'œil qu'on suit bien la bonne ligne.
 * Yahoo ne le fournit pas : Hune le déduit de Wikidata (base publique, une requête par titre, gardée sur ce poste) ou
 * le reçoit de vous (clic sur la pastille). Un ISIN déduit est donné « à vérifier » : seul celui que vous saisissez fait foi.
 */
export interface IsinConnu {
  isin: string;
  source: "manuel" | "wikidata" | "symbole";
}

const CLE = "hune.isin";
const CLE_ABSENTS = "hune.isinAbsents";
const SEMAINE_MS = 7 * 24 * 3600_000;

/** Forme d'un ISIN : deux lettres (pays), neuf caractères, un chiffre de contrôle. */
const FORME = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** Contrôle de l'ISIN : forme + clé de Luhn sur les lettres converties en nombres (A = 10 … Z = 35). */
export function estIsinValide(s: string): boolean {
  if (!FORME.test(s)) return false;
  const chiffres = [...s].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join("");
  let somme = 0;
  let double = false;
  for (let i = chiffres.length - 1; i >= 0; i--) {
    let d = Number(chiffres[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somme += d;
    double = !double;
  }
  return somme % 10 === 0;
}

/** Pays attendu d'un ISIN d'après la place de cotation (suffixe Yahoo) ; plusieurs possibles (ETF irlandais ou luxembourgeois à Paris…). */
function paysAttendus(symbole: string): string[] | null {
  const m = /\.([A-Z]{1,2})$/.exec(symbole);
  if (!m) return ["US"];
  const t: Record<string, string[]> = { PA: ["FR", "IE", "LU", "NL", "BE"], AS: ["NL", "IE", "LU"], BR: ["BE", "FR"], MI: ["IT", "IE", "LU"], MC: ["ES"], DE: ["DE", "IE", "LU"], F: ["DE", "IE", "LU", "US"], L: ["GB", "IE", "JE"], SW: ["CH"], HK: ["HK", "KY", "CN", "BM"], T: ["JP"], TO: ["CA"] };
  return t[m[1]] ?? null;
}

function lireCache(): Record<string, IsinConnu> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, IsinConnu>;
    return Object.fromEntries(Object.entries(brut).filter(([, v]) => v && estIsinValide(v.isin)));
  } catch {
    return {};
  }
}
let cache = lireCache();
const abonnes = new Set<() => void>();
let version = 0;
const enCours = new Set<string>();
const prevenir = () => {
  version++;
  abonnes.forEach((f) => f());
};
function ecrireCache() {
  try {
    localStorage.setItem(CLE, JSON.stringify(cache));
  } catch {
    // stockage indisponible : l'ISIN sera redemandé à la prochaine ouverture
  }
}

/** ISIN d'un actif déjà connu (sans réseau) : saisi, mémorisé, ou symbole qui est lui-même un ISIN. */
export function isinConnu(a: Pick<Actif, "source" | "symbole">): IsinConnu | null {
  const base = a.symbole.replace(/\.[A-Z]{1,2}$/, "");
  if (a.source === "yahoo" && estIsinValide(base)) return { isin: base, source: "symbole" };
  return cache[`${a.source}:${a.symbole}`] ?? null;
}

/** Cherche l'ISIN sur Wikidata : tickers boursiers de la ligne, ISIN valides, pays cohérent avec la place ; un seul candidat, sinon rien. */
export async function chercherIsinWikidata(symbole: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const ticker = symbole.replace(/\.[A-Z]{1,2}$/, "");
  if (!/^[A-Z0-9-]{1,12}$/.test(ticker)) return null;
  const requete = `SELECT DISTINCT ?isin WHERE { ?i wdt:P946 ?isin . ?i p:P414 ?s . ?s pq:P249 "${ticker}" } LIMIT 12`;
  const rep = await fetchFn(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(requete)}`, { headers: { Accept: "application/sparql-results+json" } });
  if (!rep.ok) return null;
  const json = (await rep.json()) as { results?: { bindings?: { isin?: { value?: string } }[] } };
  const pays = paysAttendus(symbole);
  const candidats = [...new Set((json.results?.bindings ?? []).map((b) => b.isin?.value ?? "").filter(estIsinValide))].filter((i) => !pays || pays.includes(i.slice(0, 2)));
  return candidats.length === 1 ? candidats[0] : null;
}

async function resoudre(a: Actif): Promise<void> {
  const cle = `${a.source}:${a.symbole}`;
  if (natureYahoo(a) !== "titre" || isinConnu(a) || enCours.has(cle)) return;
  let absents: Record<string, number> = {};
  try {
    absents = JSON.parse(localStorage.getItem(CLE_ABSENTS) ?? "{}") as Record<string, number>;
  } catch {
    absents = {};
  }
  if (Date.now() - (absents[cle] ?? 0) < SEMAINE_MS) return;
  enCours.add(cle);
  try {
    const isin = await chercherIsinWikidata(a.symbole);
    if (isin) {
      cache = { ...cache, [cle]: { isin, source: "wikidata" } };
      ecrireCache();
      prevenir();
    } else {
      absents[cle] = Date.now();
      localStorage.setItem(CLE_ABSENTS, JSON.stringify(absents));
    }
  } catch {
    // hors ligne ou service indisponible : on réessaiera à la prochaine ouverture
  } finally {
    enCours.delete(cle);
  }
}

/** ISIN de l'actif affiché (résolu en arrière-plan) et fonction pour le saisir (null : oublier). */
export function useIsin(actif: Actif): { isin: IsinConnu | null; definir: (isin: string | null) => boolean } {
  useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => version,
  );
  const [, rafraichir] = useState(0);
  useEffect(() => {
    void resoudre(actif).then(() => rafraichir((n) => n + 1));
  }, [actif.source, actif.symbole]); // eslint-disable-line react-hooks/exhaustive-deps
  const definir = useCallback(
    (saisie: string | null) => {
      const cle = `${actif.source}:${actif.symbole}`;
      if (saisie === null) {
        const { [cle]: _, ...reste } = cache;
        cache = reste;
      } else {
        const isin = saisie.replace(/\s/g, "").toUpperCase();
        if (!estIsinValide(isin)) return false;
        cache = { ...cache, [cle]: { isin, source: "manuel" } };
      }
      ecrireCache();
      prevenir();
      return true;
    },
    [actif.source, actif.symbole],
  );
  return { isin: isinConnu(actif), definir };
}
