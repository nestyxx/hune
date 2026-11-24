import { ErreurHttp } from "./requeteur";

/** Vrai quand la page tourne dans la fenêtre Tauri (et pas dans un simple navigateur de test). */
export const dansTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * GET JSON. Yahoo n'autorise pas le CORS : dans Tauri, ses requêtes passent par le plugin HTTP (côté Rust,
 * limité par la portée de `capabilities/default.json`). Binance autorise le CORS : simple fetch du webview
 * (déjà permis par la CSP). Dans un navigateur de test, tout passe par fetch : Yahoo y sera refusé.
 */
export async function getJson<T>(url: string): Promise<T> {
  const entetes = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Hune)" };
  let reponse: Response;
  if (dansTauri() && new URL(url).hostname.endsWith("finance.yahoo.com")) {
    const { fetch: fetchTauri } = await import("@tauri-apps/plugin-http");
    reponse = await fetchTauri(url, { method: "GET", headers: entetes });
  } else {
    reponse = await fetch(url, { headers: { Accept: "application/json" } });
  }
  if (!reponse.ok) throw new ErreurHttp(reponse.status, `${new URL(url).hostname} : HTTP ${reponse.status}`);
  return (await reponse.json()) as T;
}
