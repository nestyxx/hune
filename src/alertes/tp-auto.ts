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
