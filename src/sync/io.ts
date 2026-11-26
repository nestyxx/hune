import { dansTauri } from "../donnees/http";
import type { EntreesSync } from "./moteur";

/** La synchronisation par dossier n'existe que dans l'application (accès aux fichiers) : pas dans le navigateur de test. */
export const synchroDisponible = () => dansTauri();

/** Lecture et écriture du fichier `hune-sync.json` du dossier choisi (commandes Rust : seul ce fichier est accessible). */
export function entreesDossier(dossier: string): EntreesSync {
  return {
    lire: async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string | null>("sync_lire", { dossier });
    },
    ecrire: async (contenu) => {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("sync_ecrire", { dossier, contenu });
    },
  };
}

/** Sélecteur de dossier de l'application ; null si l'utilisateur annule. */
export async function choisirDossier(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const choix = await open({ directory: true, multiple: false, title: "Choisir le dossier de synchronisation" });
  return typeof choix === "string" ? choix : null;
}
