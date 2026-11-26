import { dansTauri } from "./donnees/http";

/** Ouvre une adresse dans le navigateur par défaut (application) ou dans un nouvel onglet (mode web de développement). */
export async function ouvrirLien(url: string): Promise<void> {
  if (dansTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
