import { cleActif, type Actif } from "../donnees/types";
import type { Position } from "../portefeuille";
import type { Alerte } from "./moteur";

/**
 * Alertes créées automatiquement pour les niveaux d'un lot du portefeuille :
 *  - l'objectif (TP) : alerte « prix ≥ objectif » ;
 *  - le stop loss : alerte « prix ≤ stop ».
 * À chaque modification des positions, l'alerte d'un lot suit son niveau : créée quand on saisit un niveau pas encore atteint,
 * remplacée quand on le change, retirée quand on l'efface ou qu'on supprime le lot. Seules les alertes encore armées et liées
 * au lot (`tpLot` / `slLot`) sont touchées. Un niveau déjà atteint ne crée rien (l'alerte se déclencherait aussitôt pour rien),
 * et une alerte manuelle identique évite le doublon.
 */
interface Genre {
  champ: "objectif" | "stop";
  /** Propriété de l'alerte qui la relie au lot. */
  lien: "tpLot" | "slLot";
  sens: "au-dessus" | "en-dessous";
  prefixe: string;
}
const TP: Genre = { champ: "objectif", lien: "tpLot", sens: "au-dessus", prefixe: "tp" };
const STOP: Genre = { champ: "stop", lien: "slLot", sens: "en-dessous", prefixe: "sl" };

/** Clé d'ignorance d'un lot pour un genre d'alerte : l'identifiant du lot pour le TP, `sl:` + identifiant pour le stop. */
export const cleIgnoreStop = (lotId: string) => `sl:${lotId}`;
const cleIgnore = (g: Genre, lotId: string) => (g === STOP ? cleIgnoreStop(lotId) : lotId);

/** Identifiant stable : deux appareils qui créent la même alerte produisent le même enregistrement (pas de doublon à la synchronisation). */
const idAlerte = (g: Genre, lotId: string, niveau: number) => `${g.prefixe}:${lotId}:${niveau}`;

/** Le niveau n'est pas encore atteint par le prix connu (ou le prix est inconnu). */
const pasAtteint = (g: Genre, niveau: number, prix: number | undefined) => prix == null || (g === TP ? niveau > prix : niveau < prix);

function synchroniser(g: Genre, avant: Position[], apres: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, maintenant: number): Alerte[] {
  const avantParId = new Map(avant.map((p) => [p.id, p]));
  const apresIds = new Set(apres.map((p) => p.id));
  let resultat = alertes;
  const retirer = (lotId: string) => {
    resultat = resultat.filter((a) => !(a[g.lien] === lotId && a.statut === "armee"));
  };

  for (const lot of avant) if (!apresIds.has(lot.id)) retirer(lot.id);

  for (const lot of apres) {
    const ancien = avantParId.get(lot.id);
    if (ancien && ancien[g.champ] === lot[g.champ] && ancien.cle === lot.cle) continue;
    retirer(lot.id);
    const niveau = lot[g.champ];
    if (niveau == null || !(niveau > 0)) continue;
    if (!pasAtteint(g, niveau, prixDe(lot.cle))) continue;
    const actif = actifs.find((a) => cleActif(a) === lot.cle);
    if (!actif) continue;
    const doublon = resultat.some((a) => a.statut === "armee" && a.condition.type === "prix" && a.condition.sens === g.sens && a.condition.seuil === niveau && cleActif(a.actif) === lot.cle);
    if (doublon) continue;
    resultat = [...resultat, { id: idAlerte(g, lot.id, niveau), actif, condition: { type: "prix", sens: g.sens, seuil: niveau }, statut: "armee", creeeLe: maintenant, [g.lien]: lot.id }];
  }
  return resultat;
}

export const synchroniserAlertesTp = (avant: Position[], apres: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, maintenant: number) => synchroniser(TP, avant, apres, alertes, actifs, prixDe, maintenant);
export const synchroniserAlertesStop = (avant: Position[], apres: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, maintenant: number) => synchroniser(STOP, avant, apres, alertes, actifs, prixDe, maintenant);

/** TP et stop loss d'un coup. */
export function synchroniserAlertesNiveaux(avant: Position[], apres: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, maintenant: number): Alerte[] {
  return synchroniserAlertesStop(avant, apres, synchroniserAlertesTp(avant, apres, alertes, actifs, prixDe, maintenant), actifs, prixDe, maintenant);
}

const CLE_IGNORES = "hune.tpIgnores";

/** Ancien stockage des lots ignorés (localStorage), lu une fois pour reprendre les choix déjà faits. */
export function lireAnciensIgnoresTp(): string[] {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_IGNORES) ?? "[]") as unknown;
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function manquantes(g: Genre, positions: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, ignores: ReadonlySet<string>, maintenant: number): Alerte[] {
  const sortie: Alerte[] = [];
  for (const lot of positions) {
    const niveau = lot[g.champ];
    if (niveau == null || !(niveau > 0) || ignores.has(cleIgnore(g, lot.id))) continue;
    const prix = prixDe(lot.cle);
    if (prix == null || !pasAtteint(g, niveau, prix)) continue;
    const actif = actifs.find((a) => cleActif(a) === lot.cle);
    if (!actif) continue;
    const dejaLa = [...alertes, ...sortie].some((a) => a.condition.type === "prix" && a.condition.sens === g.sens && a.condition.seuil === niveau && cleActif(a.actif) === lot.cle);
    if (dejaLa) continue;
    sortie.push({ id: idAlerte(g, lot.id, niveau), actif, condition: { type: "prix", sens: g.sens, seuil: niveau }, statut: "armee", creeeLe: maintenant, [g.lien]: lot.id });
  }
  return sortie;
}

/**
 * Alertes TP manquantes pour les objectifs déjà saisis (portefeuille existant) : un lot dont l'objectif est encore au-dessus
 * d'un prix connu, sans alerte (de n'importe quel statut) à ce seuil, et dont l'utilisateur n'a pas supprimé l'alerte.
 */
export const alertesTpManquantes = (positions: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, ignores: ReadonlySet<string>, maintenant: number) => manquantes(TP, positions, alertes, actifs, prixDe, ignores, maintenant);

/** Idem pour les stops loss (alerte « prix ≤ stop »). */
export const alertesStopManquantes = (positions: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, ignores: ReadonlySet<string>, maintenant: number) => manquantes(STOP, positions, alertes, actifs, prixDe, ignores, maintenant);

/** TP et stops manquants d'un coup (les seconds voient les premiers : pas de doublon entre eux). */
export function alertesNiveauxManquantes(positions: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, ignores: ReadonlySet<string>, maintenant: number): Alerte[] {
  const tp = alertesTpManquantes(positions, alertes, actifs, prixDe, ignores, maintenant);
  return [...tp, ...alertesStopManquantes(positions, [...alertes, ...tp], actifs, prixDe, ignores, maintenant)];
}
