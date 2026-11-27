import type { Actif, ResultatRecherche } from "./donnees/types";
import { cleActif } from "./donnees/types";
import type { Position } from "./portefeuille";

/**
 * Import d'un historique de transactions (CSV) : on reconstitue, token par token, la quantité détenue et le prix
 * d'achat moyen pondéré (PAMP) à partir des achats et des ventes. Tout se passe localement : le fichier n'est
 * lu que par cette page, rien n'est envoyé nulle part.
 */

export interface Transaction {
  /** Horodatage en ms (sert à ordonner ; le fuseau du fichier n'a pas d'importance ici). */
  date: number;
  token: string;
  sens: "achat" | "vente";
  quantite: number;
  /** Montant payé (achat) ou reçu (vente) hors frais, dans la devise du fichier. */
  total: number;
  /** Frais dans la devise du fichier (0 si inconnus ou dans une autre devise). */
  frais: number;
}

export interface AnalyseCsv {
  /** « CoinMarketCap » si les colonnes sont celles de son export, sinon « CSV générique ». */
  format: string;
  /** Devise des montants du fichier (lue dans l'en-tête de la colonne du prix, EUR à défaut). */
  devise: string;
  transactions: Transaction[];
  /** Lignes écartées, regroupées par motif (« transfert », « ligne illisible »…). */
  ignorees: { motif: string; nombre: number }[];
  avertissements: string[];
}

/** Découpe un CSV (séparateur `,` `;` ou tabulation, guillemets et BOM gérés) en lignes de cellules. */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/, 1)[0] ?? "";
  const hors = premiere.replace(/"[^"]*"/g, "");
  const sep = [",", ";", "\t"].map((s) => [s, hors.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      ligne.push(cellule);
      cellule = "";
      if (ligne.some((x) => x.trim())) lignes.push(ligne);
      ligne = [];
    } else cellule += c;
  }
  ligne.push(cellule);
  if (ligne.some((x) => x.trim())) lignes.push(ligne);
  return lignes;
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** « Price (EUR) » → « price » ; la devise entre parenthèses est lue à part. */
const nomColonne = (s: string) => sansAccents(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[_\s]+/g, " ").trim();
const deviseColonne = (s: string) => /\(([A-Za-z]{3,4})\)/.exec(s)?.[1]?.toUpperCase();

/** Noms de colonnes reconnus (après `nomColonne`), du plus précis au plus général. */
const COLONNES = {
  date: ["date", "date et heure", "datetime", "timestamp", "time", "horodatage", "date utc"],
  token: ["token", "symbol", "symbole", "asset", "actif", "coin", "crypto", "cryptomonnaie", "base asset", "ticker"],
  type: ["type", "side", "sens", "operation", "transaction type", "type de transaction", "action"],
  prix: ["price", "prix", "prix unitaire", "unit price", "spot price", "price per coin", "price at transaction"],
  quantite: ["amount", "quantity", "quantite", "qty", "quantity transacted", "executed", "filled"],
  total: ["total value", "total", "montant", "value", "total amount", "subtotal", "cost", "proceeds"],
  frais: ["fee", "fees", "frais", "commission"],
  deviseFrais: ["fee currency", "fee asset", "devise des frais", "devise frais"],
} as const;

type Champ = keyof typeof COLONNES;

function reperer(entete: string[]): Partial<Record<Champ, number>> {
  const noms = entete.map(nomColonne);
  const trouve: Partial<Record<Champ, number>> = {};
  for (const champ of Object.keys(COLONNES) as Champ[]) {
    for (const alias of COLONNES[champ]) {
      const i = noms.indexOf(alias);
      if (i >= 0 && !Object.values(trouve).includes(i)) {
        trouve[champ] = i;
        break;
      }
    }
  }
  return trouve;
}

/** Sépare-t-on les décimales par « . » ou par « , » ? Décidé une fois pour tout le fichier. */
function separateurDecimal(cellules: string[]): "." | "," {
  for (const brut of cellules) {
    const s = brut.replace(/[^\d.,]/g, "");
    const p = s.lastIndexOf("."), v = s.lastIndexOf(",");
    if (p >= 0 && v >= 0) return p > v ? "." : ",";
    if (v >= 0 && !/^\d{1,3}(,\d{3})+$/.test(s)) return ","; // « 0,98 » ou « 12,5 » : virgule décimale
    if (p >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(s)) return "."; // « 0.98 » ou « 3.4300 » : point décimal
  }
  return ".";
}

function nombre(brut: string | undefined, decimal: "." | ","): number {
  if (brut == null) return NaN;
  let s = brut.replace(/[^\d.,\-+eE]/g, "");
  if (!s) return NaN;
  s = decimal === "." ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

function date(brut: string): number {
  const s = brut.trim();
  const iso = Date.parse(s.replace(" ", "T"));
  if (Number.isFinite(iso)) return iso;
  const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +m[5] || 0, +m[6] || 0).getTime() : NaN;
}

const sensDe = (brut: string): Transaction["sens"] | null => {
  const t = sansAccents(brut).toLowerCase();
  if (/\b(buy|bought|achat|acheter|purchase|acquisition)\b/.test(t)) return "achat";
  if (/\b(sell|sold|vente|vendre)\b/.test(t)) return "vente";
  return null;
};

/** Anciens tickers renommés : le même actif sous deux noms ne doit pas former deux lignes. */
const RENOMMES: Record<string, string> = { MATIC: "POL" };

/**
 * Analyse un CSV de transactions. Lève une Error au message lisible si les colonnes indispensables
 * (date, token, type, quantité et prix ou total) ne sont pas reconnues.
 * `retirerDoublons` écarte les lignes strictement identiques (même instant, token, sens, quantité et montant),
 * typiques d'une migration de ticker (MATIC → POL) consignée deux fois.
 */
export function analyserCsv(texte: string, retirerDoublons = true): AnalyseCsv {
  const lignes = lireCsv(texte);
  if (lignes.length < 2) throw new Error("Le fichier ne contient aucune transaction.");
  const [entete, ...corps] = lignes;
  const col = reperer(entete);
  const manquants: string[] = [];
  if (col.date == null) manquants.push("date");
  if (col.token == null) manquants.push("token / symbole");
  if (col.type == null) manquants.push("type (achat/vente)");
  if (col.quantite == null) manquants.push("quantité");
  if (col.total == null && col.prix == null) manquants.push("prix ou total");
  if (manquants.length) throw new Error(`Colonnes non reconnues : ${manquants.join(", ")}. Colonnes trouvées : ${entete.join(", ")}.`);

  const format = ["date", "token", "type", "prix", "quantite", "total", "frais", "deviseFrais"].every((c) => col[c as Champ] != null) && /^date \(utc/i.test(entete[col.date!].trim()) ? "CoinMarketCap" : "CSV générique";
  const devise = (col.prix != null ? deviseColonne(entete[col.prix]) : undefined) ?? (col.total != null ? deviseColonne(entete[col.total]) : undefined) ?? "EUR";
  const decimal = separateurDecimal(corps.flatMap((l) => [col.prix, col.quantite, col.total, col.frais].flatMap((i) => (i != null && l[i] ? [l[i]] : []))));

  const avertissements: string[] = [];
  const ignorees = new Map<string, number>();
  const ignorer = (motif: string) => ignorees.set(motif, (ignorees.get(motif) ?? 0) + 1);
  const brutes: Transaction[] = [];
  let fraisAutreDevise = 0;
  for (const l of corps) {
    const typeBrut = (l[col.type!] ?? "").trim();
    const sens = sensDe(typeBrut);
    if (!sens) {
      ignorer(typeBrut ? `type « ${typeBrut} » (ni achat ni vente)` : "type vide");
      continue;
    }
    const brutToken = (l[col.token!] ?? "").trim().toUpperCase();
    const quantite = Math.abs(nombre(l[col.quantite!], decimal));
    const d = date(l[col.date!] ?? "");
    let total = col.total != null ? Math.abs(nombre(l[col.total], decimal)) : NaN;
    if (!Number.isFinite(total) && col.prix != null) total = quantite * Math.abs(nombre(l[col.prix], decimal));
    if (!brutToken || !(quantite > 0) || !Number.isFinite(d) || !Number.isFinite(total)) {
      ignorer("ligne illisible");
      continue;
    }
    let frais = col.frais != null ? Math.abs(nombre(l[col.frais], decimal)) || 0 : 0;
    const deviseFrais = col.deviseFrais != null ? (l[col.deviseFrais] ?? "").trim().toUpperCase() : devise;
    if (frais && deviseFrais && deviseFrais !== devise) {
      fraisAutreDevise++;
      frais = 0;
    }
    brutes.push({ date: d, token: RENOMMES[brutToken] ?? brutToken, sens, quantite, total, frais });
  }
  if (corps.some((l) => RENOMMES[(l[col.token!] ?? "").trim().toUpperCase()])) avertissements.push("MATIC est compté comme POL (renommage de 2024, 1 pour 1).");
  if (fraisAutreDevise) avertissements.push(`${fraisAutreDevise} frais exprimés dans une autre devise que ${devise} ne sont pas comptés.`);

  // Les exports listent souvent du plus récent au plus ancien : on remet dans l'ordre chronologique (à égalité, l'ordre du fichier fait foi).
  const descendant = corps.length > 1 && brutes.length > 1 && brutes[0].date > brutes[brutes.length - 1].date;
  const chrono = (descendant ? [...brutes].reverse() : brutes).map((t, i) => ({ t, i })).sort((a, b) => a.t.date - b.t.date || a.i - b.i).map((x) => x.t);

  let transactions = chrono;
  if (retirerDoublons) {
    const vues = new Set<string>();
    transactions = [];
    let doublons = 0;
    for (const t of chrono) {
      const cle = `${t.date}|${t.token}|${t.sens}|${t.quantite}|${t.total}`;
      if (vues.has(cle)) doublons++;
      else {
        vues.add(cle);
        transactions.push(t);
      }
    }
    if (doublons) avertissements.push(`${doublons} transaction${doublons > 1 ? "s" : ""} strictement identique${doublons > 1 ? "s" : ""} (même instant, même quantité, même montant) retirée${doublons > 1 ? "s" : ""}.`);
  }

  return { format, devise, transactions, ignorees: [...ignorees].map(([motif, nombre]) => ({ motif, nombre })), avertissements };
}

export interface LigneImport {
  token: string;
  /** Quantité restante après achats et ventes. */
  quantite: number;
  /** Prix d'achat moyen pondéré des unités restantes (frais d'achat inclus), devise du fichier. */
  pamp: number;
  /** Coût d'acquisition des unités restantes, devise du fichier. */
  cout: number;
  achats: number;
  ventes: number;
  /** Toutes les transactions du token (prix unitaire hors frais, devise du fichier), pour les repérer sur le graphique. */
  mouvements: { date: number; sens: "achat" | "vente"; quantite: number; prix: number }[];
}

export interface SyntheseTokens {
  lignes: LigneImport[];
  /** Tokens entièrement vendus : rien à suivre. */
  soldes: string[];
  avertissements: string[];
}

/**
 * Méthode du prix moyen pondéré : un achat ajoute quantité et coût (frais compris) ; une vente retire la quantité
 * au prix moyen du moment, ce qui laisse le PAMP inchangé. Une vente supérieure à la quantité connue (historique
 * incomplet) est plafonnée et signalée.
 */
export function synthetiser(transactions: Transaction[]): SyntheseTokens {
  const etat = new Map<string, { quantite: number; cout: number; acheteTotal: number; achats: number; ventes: number; mouvements: LigneImport["mouvements"] }>();
  const avertissements: string[] = [];
  const signales = new Set<string>();
  for (const t of transactions) {
    const e = etat.get(t.token) ?? { quantite: 0, cout: 0, acheteTotal: 0, achats: 0, ventes: 0, mouvements: [] };
    etat.set(t.token, e);
    e.mouvements.push({ date: t.date, sens: t.sens, quantite: t.quantite, prix: t.total / t.quantite });
    if (t.sens === "achat") {
      e.quantite += t.quantite;
      e.acheteTotal += t.quantite;
      e.cout += t.total + t.frais;
      e.achats++;
    } else {
      e.ventes++;
      if (t.quantite > e.quantite * (1 + 1e-9) && !signales.has(t.token)) {
        signales.add(t.token);
        avertissements.push(`${t.token} : une vente dépasse la quantité achetée dans le fichier (historique incomplet ?), elle est plafonnée.`);
      }
      const q = Math.min(t.quantite, e.quantite);
      if (e.quantite > 0) e.cout -= e.cout * (q / e.quantite);
      e.quantite -= q;
    }
  }
  const lignes: LigneImport[] = [];
  const soldes: string[] = [];
  for (const [token, e] of etat) {
    if (e.quantite <= e.acheteTotal * 1e-9) soldes.push(token);
    else lignes.push({ token, quantite: e.quantite, cout: e.cout, pamp: e.cout / e.quantite, achats: e.achats, ventes: e.ventes, mouvements: e.mouvements });
  }
  lignes.sort((a, b) => b.cout - a.cout);
  return { lignes, soldes, avertissements };
}

/** Plateforme déduite du nom du fichier : « TRADE_REPUBLIC_with_transaction_history.csv » → « Trade Republic ». */
export function plateformeDepuisNom(nomFichier: string): string {
  const base = nomFichier.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").toLowerCase();
  const coupe = base.split(/\b(?:with|transactions?|history|historique|export|portfolio|report|crypto)\b/)[0].trim();
  return coupe.replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export interface ResolutionToken {
  actif: Actif;
  /** L'actif est déjà dans la watchlist (aucun ajout). */
  existant: boolean;
  /** Devise de cotation de l'actif (le PAMP du fichier y est converti). */
  devise: string;
}

const DEVISES_PAIRES = ["EUR", "USDC", "USDT"];

/** Cherche, parmi les actifs déjà suivis, celui qui correspond au token (BTC → BTCUSDC, BTC-USD…). */
export function actifSuivi(token: string, actifs: Actif[]): Actif | undefined {
  const candidats = actifs.filter((a) => (a.source === "binance" && DEVISES_PAIRES.some((q) => a.symbole === token + q)) || (a.source === "yahoo" && /^[A-Z0-9]+-(USD|EUR)$/.test(a.symbole) && a.symbole.split("-")[0] === token));
  // Plusieurs possibles : on préfère ce que l'utilisateur suit déjà sur Binance (temps réel), puis l'ordre de la liste.
  return candidats.find((a) => a.source === "binance") ?? candidats[0];
}

export interface DependancesResolution {
  actifs: Actif[];
  rechercher: (requete: string) => Promise<ResultatRecherche[]>;
  devise: (a: Actif) => Promise<string>;
}

/** Associe chaque token à un actif : d'abord ce qui est déjà suivi, sinon une paire Binance (EUR, puis USDC, puis USDT). */
export async function resoudreTokens(tokens: string[], d: DependancesResolution): Promise<Map<string, ResolutionToken | null>> {
  const resultat = new Map<string, ResolutionToken | null>();
  for (const token of tokens) {
    try {
      let actif = actifSuivi(token, d.actifs);
      const existant = !!actif;
      if (!actif) {
        const paires = (await d.rechercher(token)).filter((r) => r.source === "binance" && r.nom.split("/")[0] === token);
        const choisie = DEVISES_PAIRES.map((q) => paires.find((r) => r.nom === `${token}/${q}`)).find(Boolean);
        if (choisie) actif = { source: choisie.source, symbole: choisie.symbole, nom: choisie.nom };
      }
      resultat.set(token, actif ? { actif, existant, devise: await d.devise(actif) } : null);
    } catch {
      resultat.set(token, null);
    }
  }
  return resultat;
}

export interface PlanImport {
  /** Actifs à ajouter à la watchlist. */
  actifs: Actif[];
  /** Positions à écrire (une par token). */
  positions: Position[];
  /** Positions existantes à retirer (anciennes lots de la même plateforme sur ces actifs, ou d'un import précédent). */
  remplacees: Position[];
}

/** Identifiant stable : réimporter le même fichier met à jour au lieu de dupliquer. */
export const idImport = (plateforme: string, token: string) => `tx-${sansAccents(plateforme).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "csv"}-${token}`;

const memePlateforme = (a: string | undefined, b: string) => sansAccents(a ?? "").trim().toLowerCase() === sansAccents(b).trim().toLowerCase();

/**
 * Construit les positions à partir de la synthèse. Les lots déjà saisis pour la même plateforme sur ces actifs
 * (ou issus d'un import précédent du même fichier) sont remplacés : le fichier fait foi pour cette plateforme.
 * Les lots des autres plateformes et les objectifs (TP) déjà saisis sont conservés.
 * `taux` : valeur en euros d'une unité de chaque devise (pour convertir le PAMP vers la devise de l'actif).
 */
export function planifierImport(synthese: SyntheseTokens, resolutions: Map<string, ResolutionToken | null>, plateforme: string, deviseFichier: string, taux: Record<string, number>, existantes: Position[], actifsSuivis: Actif[]): PlanImport {
  const actifs: Actif[] = [];
  const positions: Position[] = [];
  const cles = new Set<string>();
  for (const l of synthese.lignes) {
    const r = resolutions.get(l.token);
    if (!r) continue;
    const cle = cleActif(r.actif);
    cles.add(cle);
    if (!r.existant && !actifsSuivis.some((a) => cleActif(a) === cle) && !actifs.some((a) => cleActif(a) === cle)) actifs.push(r.actif);
    const tf = taux[deviseFichier];
    const ta = taux[r.devise];
    const pamp = tf != null && ta ? (l.pamp * tf) / ta : undefined;
    const mouvements = pamp != null ? l.mouvements.map((m) => ({ ...m, prix: (m.prix * tf!) / ta })) : undefined; // sans taux de change, pas de prix fiable à tracer
    positions.push({ id: idImport(plateforme, l.token), cle, quantite: l.quantite, ...(pamp != null ? { pamp } : {}), ...(mouvements ? { mouvements } : {}), plateforme: plateforme || undefined });
  }
  const prefixe = idImport(plateforme, "");
  const remplacees = existantes.filter((p) => p.id.startsWith(prefixe) || (memePlateforme(p.plateforme, plateforme) && cles.has(p.cle)));
  // Un objectif ou un stop déjà saisi sur l'actif n'est pas perdu.
  for (const p of positions) {
    const objectif = remplacees.find((x) => x.cle === p.cle && x.objectif != null)?.objectif;
    if (objectif != null) p.objectif = objectif;
    const stop = remplacees.find((x) => x.cle === p.cle && x.stop != null)?.stop;
    if (stop != null) p.stop = stop;
  }
  return { actifs, positions, remplacees };
}
