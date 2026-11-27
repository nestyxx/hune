import { gainsRealises, versDevise, type DeviseAffichage, type LignePortefeuille, type Mouvement } from "./portefeuille";

/**
 * Export CSV pour tableur (Excel français en tête) : séparateur « ; », décimales avec virgule, fins de ligne Windows et
 * BOM UTF-8 pour que les accents s'affichent. Un texte qui commencerait comme une formule (= + @ …) est neutralisé :
 * un symbole ou un nom venu d'une source tierce ne doit jamais s'exécuter dans le tableur.
 */

export type Cellule = string | number | null | undefined;

const nombre = (v: number) => (Number.isFinite(v) ? v.toLocaleString("fr-FR", { useGrouping: false, maximumFractionDigits: 10 }) : "");

export function cellule(v: Cellule): string {
  if (v == null) return "";
  if (typeof v === "number") return nombre(v);
  let t = v;
  if (/^[=+@\t\r]/.test(t) || /^-\D/.test(t)) t = `'${t}`; // neutralise une formule (un nombre négatif est passé en number, pas ici)
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function construireCsv(entetes: string[], lignes: Cellule[][]): string {
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}

const arrondi = (v: number | null, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Lignes du portefeuille : montants convertis dans la devise d'affichage (vide si le taux manque). */
export function csvPositions(lignes: LignePortefeuille[], devise: DeviseAffichage, taux: Record<string, number>, categorie: (l: LignePortefeuille) => string): string {
  const m = (eur: number | null) => arrondi(versDevise(eur, devise, taux), 2);
  const cout = (l: LignePortefeuille) => {
    const t = l.devise ? taux[l.devise] : undefined;
    const avec = l.lots.filter((x) => x.pamp != null && x.quantite);
    return t != null && avec.length ? m(avec.reduce((s, x) => s + x.quantite! * x.pamp!, 0) * t) : null;
  };
  return construireCsv(
    ["Symbole", "Nom", "Source", "Catégorie", "Plateforme(s)", "Quantité", "PAMP", "Devise de cotation", "Prix", `Valeur (${devise})`, `Coût d'achat (${devise})`, `P&L (${devise})`, "P&L (%)", "Poids (%)", "Objectif (TP)", "Stop loss"],
    lignes.map((l) => [
      l.actif.symbole,
      l.actif.nom,
      l.actif.source === "binance" ? "Binance" : "Yahoo",
      categorie(l),
      l.plateformes.join(", "),
      arrondi(l.quantite, 8),
      arrondi(l.pamp, 6),
      l.devise,
      arrondi(l.prix, 8),
      m(l.valeurEur),
      cout(l),
      m(l.pnlEur),
      arrondi(l.pnlPct, 2),
      l.poids == null ? null : arrondi(l.poids * 100, 2),
      l.objectif,
      l.stop,
    ]),
  );
}

export interface LigneTransaction extends Mouvement {
  symbole: string;
  devise: string | null;
  plateforme?: string;
}

/**
 * Transactions importées, avec le gain réalisé de chaque vente (méthode du prix moyen, hors frais), dans la devise de
 * cotation de l'actif. `lots` regroupe les mouvements par lot pour que le prix moyen soit calculé lot par lot.
 */
export function csvTransactions(lots: { symbole: string; devise: string | null; plateforme?: string; mouvements: Mouvement[] }[]): string {
  const lignes: Cellule[][] = [];
  for (const lot of lots) {
    const gains = new Map(gainsRealises(lot.mouvements).map((g) => [g.date, g.gain]));
    for (const mv of [...lot.mouvements].sort((a, b) => b.date - a.date)) {
      lignes.push([new Date(mv.date).toISOString().slice(0, 19).replace("T", " "), lot.symbole, mv.sens === "achat" ? "Achat" : "Vente", arrondi(mv.quantite, 8), arrondi(mv.prix, 8), arrondi(mv.prix * mv.quantite, 2), lot.devise, mv.sens === "vente" ? arrondi(gains.get(mv.date) ?? null, 2) : null, lot.plateforme]);
    }
  }
  lignes.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return construireCsv(["Date (UTC)", "Symbole", "Type", "Quantité", "Prix", "Montant", "Devise", "Gain réalisé", "Plateforme"], lignes);
}
