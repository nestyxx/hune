import { dansTauri } from "./donnees/http";
import { lireSauvegarde, type Sauvegarde } from "./sauvegarde";

/** Une copie automatique quotidienne du fichier de données (voir `sauvegarde_quotidienne` côté Rust). */
export interface CopieAuto {
  nom: string;
  date: Date;
  actifs: number;
  positions: number;
  alertes: number;
  donnees: Sauvegarde["donnees"];
}

/** « hune-20261124.json » → date locale (midi : aucun décalage de fuseau possible à l'affichage). */
export function dateDepuisNom(nom: string): Date | null {
  const m = /^hune-(\d{4})(\d{2})(\d{2})\.json$/.exec(nom);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}

/** Nombre d'éléments d'une liste du fichier de données (0 si absente). */
export const compter = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Copies automatiques lisibles et valides, de la plus récente à la plus ancienne (liste vide hors de l'application). */
export async function listerCopies(): Promise<CopieAuto[]> {
  if (!dansTauri()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  const copies: CopieAuto[] = [];
  for (const nom of await invoke<string[]>("lister_sauvegardes")) {
    const date = dateDepuisNom(nom);
    if (!date) continue;
    try {
      // Le fichier de copie est le contenu brut du magasin : on l'enveloppe pour réutiliser la validation des imports.
      const brut = JSON.parse(await invoke<string>("lire_sauvegarde", { nom }));
      const donnees = lireSauvegarde(JSON.stringify({ application: "hune", version: 1, donnees: brut }));
      copies.push({ nom, date, donnees, actifs: compter(donnees.actifs), positions: compter(donnees.positions), alertes: compter(donnees.alertes) });
    } catch {
      /* copie illisible ou invalide : on l'ignore plutôt que de proposer de restaurer n'importe quoi */
    }
  }
  return copies;
}
