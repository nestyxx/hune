import { cleActif, type Actif } from "../donnees/types";
import type { Position } from "../portefeuille";
import type { Alerte } from "./moteur";

/**
 * Alertes créées automatiquement pour les objectifs (TP) du portefeuille.
 * À chaque modification des positions, l'alerte « prix ≥ objectif » d'un lot suit son objectif :
 * créée quand on saisit un objectif encore au-dessus du prix, remplacée quand on le change, retirée quand on l'efface
 * ou qu'on supprime le lot. Seules les alertes encore armées et liées au lot (`tpLot`) sont touchées.
 * Un objectif déjà atteint ne crée rien (l'alerte se déclencherait aussitôt pour rien), et une alerte manuelle
 * identique évite le doublon.
 */
export function synchroniserAlertesTp(avant: Position[], apres: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, maintenant: number): Alerte[] {
  const avantParId = new Map(avant.map((p) => [p.id, p]));
  const apresIds = new Set(apres.map((p) => p.id));
  let resultat = alertes;
  const retirer = (lotId: string) => {
    resultat = resultat.filter((a) => !(a.tpLot === lotId && a.statut === "armee"));
  };

  for (const lot of avant) if (!apresIds.has(lot.id)) retirer(lot.id);

  for (const lot of apres) {
    const ancien = avantParId.get(lot.id);
    if (ancien && ancien.objectif === lot.objectif && ancien.cle === lot.cle) continue;
    retirer(lot.id);
    if (lot.objectif == null || !(lot.objectif > 0)) continue;
    const prix = prixDe(lot.cle);
    if (prix != null && lot.objectif <= prix) continue;
    const actif = actifs.find((a) => cleActif(a) === lot.cle);
    if (!actif) continue;
    const doublon = resultat.some((a) => a.statut === "armee" && a.condition.type === "prix" && a.condition.sens === "au-dessus" && a.condition.seuil === lot.objectif && cleActif(a.actif) === lot.cle);
    if (doublon) continue;
    resultat = [...resultat, { id: crypto.randomUUID(), actif, condition: { type: "prix", sens: "au-dessus", seuil: lot.objectif }, statut: "armee", creeeLe: maintenant, tpLot: lot.id }];
  }
  return resultat;
}

const CLE_IGNORES = "hune.tpIgnores";

/** Lots dont l'utilisateur a supprimé l'alerte TP : on ne la recrée pas tant que leur objectif ne change pas. */
export function lireIgnoresTp(): Set<string> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_IGNORES) ?? "[]") as unknown;
    return new Set(Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function ecrireIgnoresTp(s: Set<string>): void {
  try {
    localStorage.setItem(CLE_IGNORES, JSON.stringify([...s]));
  } catch {
    // stockage indisponible : l'alerte pourra être recréée, sans gravité
  }
}

export function ignorerTp(lotId: string): void {
  ecrireIgnoresTp(new Set([...lireIgnoresTp(), lotId]));
}

export function reprendreTp(lotsIds: string[]): void {
  if (!lotsIds.length) return;
  const s = lireIgnoresTp();
  let change = false;
  for (const id of lotsIds) change = s.delete(id) || change;
  if (change) ecrireIgnoresTp(s);
}

/**
 * Alertes TP manquantes pour les objectifs déjà saisis (portefeuille existant) : un lot dont l'objectif est encore au-dessus
 * d'un prix connu, sans alerte (de n'importe quel statut) à ce seuil, et dont l'utilisateur n'a pas supprimé l'alerte.
 */
export function alertesTpManquantes(positions: Position[], alertes: Alerte[], actifs: Actif[], prixDe: (cle: string) => number | undefined, ignores: Set<string>, maintenant: number): Alerte[] {
  const sortie: Alerte[] = [];
  for (const lot of positions) {
    if (lot.objectif == null || !(lot.objectif > 0) || ignores.has(lot.id)) continue;
    const prix = prixDe(lot.cle);
    if (prix == null || lot.objectif <= prix) continue;
    const actif = actifs.find((a) => cleActif(a) === lot.cle);
    if (!actif) continue;
    const dejaLa = [...alertes, ...sortie].some((a) => a.condition.type === "prix" && a.condition.sens === "au-dessus" && a.condition.seuil === lot.objectif && cleActif(a.actif) === lot.cle);
    if (dejaLa) continue;
    sortie.push({ id: crypto.randomUUID(), actif, condition: { type: "prix", sens: "au-dessus", seuil: lot.objectif }, statut: "armee", creeeLe: maintenant, tpLot: lot.id });
  }
  return sortie;
}
