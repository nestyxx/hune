import { Binance } from "./binance";
import type { DataProvider } from "./fournisseur";
import { isinValide, ressembleAIsin } from "./isin";
import { Yahoo } from "./yahoo";
import type { Actif, Cotation, ModeVariation, ResultatRecherche, SourceId } from "./types";

/** Registre des sources. Pour en ajouter ou en remplacer une, c'est ici (et uniquement ici). */
const fournisseurs: Record<SourceId, DataProvider> = {
  binance: new Binance(),
  yahoo: new Yahoo(),
};

export const fournisseur = (source: SourceId): DataProvider => fournisseurs[source];

/**
 * Recherche dans toutes les sources en parallèle ; une source en échec n'empêche pas les autres.
 * Un ISIN (FR0000121014…) n'existe que pour les titres cotés : on le valide (clé de contrôle) puis on
 * n'interroge que Yahoo, qui sait le résoudre ; les cryptos n'ont pas d'ISIN.
 */
export async function rechercherTout(requete: string): Promise<{ resultats: ResultatRecherche[]; erreurs: string[]; note?: string }> {
  let sources = Object.values(fournisseurs);
  let note: string | undefined;
  if (ressembleAIsin(requete)) {
    if (!isinValide(requete)) return { resultats: [], erreurs: [], note: "Cet ISIN n'est pas valide (clé de contrôle incorrecte) : vérifiez la saisie." };
    sources = [fournisseurs.yahoo];
    note = "Recherche par ISIN : Yahoo ne renvoie que la ou les places de cotation qu'il connaît pour ce titre.";
  }
  const reponses = await Promise.allSettled(sources.map((f) => f.rechercher(requete)));
  const erreurs: string[] = [];
  const resultats = reponses.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    erreurs.push(`${sources[i].nom} : ${r.reason?.message ?? r.reason}`);
    return [];
  });
  return { resultats, erreurs, note };
}

/** Cotations d'une liste d'actifs, regroupées par source. Renvoie une table `source:symbole` → cotation. */
export async function cotationsActifs(actifs: Actif[], variation: ModeVariation = "24h"): Promise<Record<string, Cotation>> {
  const sortie: Record<string, Cotation> = {};
  await Promise.all(
    (Object.keys(fournisseurs) as SourceId[]).map(async (source) => {
      const symboles = actifs.filter((a) => a.source === source).map((a) => a.symbole);
      if (!symboles.length) return;
      try {
        for (const c of await fournisseurs[source].cotations(symboles, variation)) sortie[`${source}:${c.symbole}`] = c;
      } catch {
        /* Source en erreur ou en pause : on garde simplement les prix précédents côté interface. */
      }
    }),
  );
  return sortie;
}
