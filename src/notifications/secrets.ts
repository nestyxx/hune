import { dansTauri } from "../donnees/http";

/**
 * Secrets (mots de passe, jetons, clés d'API) : rangés dans le coffre du système par la coque Rust.
 * L'interface peut en écrire et savoir s'ils existent, jamais les relire ; les requêtes y font référence par `{{secret:nom}}`.
 */
export const SECRETS = {
  ntfy: "ntfy-jeton",
  smtp: "smtp",
  brevo: "brevo",
  ovhSecret: "ovh-secret",
  ovhConsumer: "ovh-consumer",
  telegram: "telegram",
  discord: "discord-url",
  webhook: "webhook-url",
  openrouter: "openrouter",
} as const;

export const secretsDisponibles = dansTauri;

export async function secretExiste(nom: string): Promise<boolean> {
  if (!dansTauri()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("secret_existe", { nom });
}

/** Enregistre un secret (une chaîne vide l'efface). */
export async function definirSecret(nom: string, valeur: string): Promise<void> {
  if (!dansTauri()) throw new Error("Le coffre de secrets n'existe que dans l'application installée.");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("secret_definir", { nom, valeur });
}
