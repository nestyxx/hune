import { decrire, type Alerte } from "../alertes/moteur";
import { categorieDe } from "../categories";
import { cotationsActifs, fournisseur } from "../donnees";
import { chargerCapitalisation } from "../donnees/capitalisation";
import { tauxVersEur } from "../donnees/change";
import { chargerSentiment, libelleSentiment } from "../donnees/sentiment";
import { cleActif, type Actif, type ModeVariation } from "../donnees/types";
import { symboleAffiche } from "../noms-affiches";
import { agreger, ajouterPoids, extremesPerformance, totaux, variationPortefeuille, type DeviseAffichage, type Position } from "../portefeuille";
import type { DonneesRecap } from "./recap";

/** Ce que l'application sait à cet instant. */
export interface EntreesRecap {
  actifs: Actif[];
  positions: Position[];
  alertes: Alerte[];
  categories: string[];
  variation: ModeVariation;
  devise: DeviseAffichage;
  /** Instant du dernier récap (ms) : seules les alertes déclenchées depuis comptent ; 0 = les dernières 24 h. */
  depuisMs: number;
}

const seuilNiveau = 5;

/**
 * Rassemble les données du récap en les téléchargeant de nouveau : le récap doit fonctionner fenêtre fermée,
 * sans dépendre de l'onglet affiché. Une source en panne laisse simplement sa section de côté.
 */
export async function rassemblerDonnees(e: EntreesRecap, maintenant = new Date()): Promise<DonneesRecap> {
  const parCle = Object.fromEntries(e.actifs.map((a) => [cleActif(a), a]));
  const [cotations, fearGreed, capi] = await Promise.all([
    cotationsActifs(e.actifs, e.variation),
    chargerSentiment(2).then((p) => p[p.length - 1]).catch(() => undefined),
    chargerCapitalisation().catch(() => undefined),
  ]);

  const positions = e.positions.filter((p) => parCle[p.cle]);
  let portefeuille: DonneesRecap["portefeuille"] = null;
  let tauxDevise: number | null = e.devise === "EUR" ? 1 : null;
  const niveaux: DonneesRecap["niveaux"] = [];
  const clesDetenues = [...new Set(positions.map((p) => p.cle))];
  const devisesTableau = Object.fromEntries(
    (await Promise.allSettled(clesDetenues.map(async (c) => [c, await fournisseur(parCle[c].source).devise(parCle[c].symbole)] as const))).flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
  );
  const taux = await tauxVersEur([...new Set([...Object.values(devisesTableau), ...(e.devise === "USD" ? ["USD"] : [])])]).catch(() => ({ EUR: 1 }) as Record<string, number>);
  if (e.devise === "USD") tauxDevise = taux.USD ? 1 / taux.USD : null;

  if (positions.length) {
    const lignes = ajouterPoids(agreger(positions, { actifs: parCle, cotations, devises: devisesTableau, taux }));
    const tot = totaux(lignes);
    const ext = extremesPerformance(lignes);
    const nom = (l: (typeof lignes)[number]) => symboleAffiche(l.actif);
    portefeuille = {
      valeurEur: tot.valeurEur,
      nbLignes: lignes.length,
      nonValorisees: tot.nonValorisees,
      variationJour: variationPortefeuille(lignes, cotations),
      pnlEur: tot.coutEur > 0 ? tot.pnlEur : null,
      pnlPct: tot.pnlPct,
      lignes: [...lignes]
        .sort((a, b) => (b.poids ?? 0) - (a.poids ?? 0))
        .slice(0, 12)
        .map((l) => ({ symbole: nom(l), categorie: categorieDe(l.actif, e.categories), poids: l.poids, pnlPct: l.pnlPct, variationPct: cotations[l.cle]?.variationPct ?? null })),
      meilleure: ext ? { symbole: nom(ext.meilleure), pnlPct: ext.meilleure.pnlPct! } : null,
      pire: ext ? { symbole: nom(ext.pire), pnlPct: ext.pire.pnlPct! } : null,
    };
    for (const l of lignes) {
      if (l.versObjectifPct != null && l.versObjectifPct >= 0 && l.versObjectifPct <= seuilNiveau) niveaux.push({ symbole: nom(l), type: "TP", distancePct: l.versObjectifPct });
      if (l.versStopPct != null && l.versStopPct <= 0 && l.versStopPct >= -seuilNiveau) niveaux.push({ symbole: nom(l), type: "Stop", distancePct: l.versStopPct });
    }
    niveaux.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
  }

  const depuis = e.depuisMs > 0 ? e.depuisMs : maintenant.getTime() - 24 * 3600_000;
  return {
    quand: maintenant,
    devise: e.devise,
    tauxDevise,
    portefeuille,
    marche: e.actifs.flatMap((a) => {
      const c = cotations[cleActif(a)];
      return c ? [{ symbole: symboleAffiche(a), nom: a.nom, prix: c.prix, variationPct: c.variationPct, categorie: categorieDe(a, e.categories) }] : [];
    }),
    fearGreed: fearGreed ? { valeur: fearGreed.valeur, libelle: libelleSentiment(fearGreed.valeur) } : null,
    capitalisation: capi ? { totalMdUsd: capi.total / 1e9, dominanceBtc: capi.dominanceBtc, variation24h: capi.variation24h } : null,
    alertes: {
      declenchees: e.alertes
        .filter((a) => a.statut === "declenchee" && (a.declencheeLe ?? 0) >= depuis)
        .map((a) => ({ symbole: symboleAffiche(a.actif), libelle: decrire(a.condition), quandMs: a.declencheeLe ?? 0 }))
        .sort((a, b) => b.quandMs - a.quandMs),
      armees: e.alertes.filter((a) => a.statut === "armee").length,
    },
    niveaux,
  };
}
