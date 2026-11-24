import { useCallback, useEffect, useRef, useState } from "react";
import { dansTauri } from "./donnees/http";

export type EtatMaj =
  | { etat: "inactif" }
  | { etat: "verification" }
  | { etat: "a-jour"; verifieLe: number }
  | { etat: "disponible"; version: string; notes?: string }
  | { etat: "telechargement"; pct: number | null }
  | { etat: "erreur"; message: string };

type Mise = { version: string; body?: string; downloadAndInstall: (cb: (e: { event: string; data: { contentLength?: number; chunkLength: number } }) => void) => Promise<void> };

/**
 * Mises à jour automatiques (plugin updater de Tauri) : vérification discrète 20 s après le démarrage puis toutes les 6 h,
 * et à la demande. Le paquet est signé : l'application refuse tout fichier dont la signature ne correspond pas à la clé
 * publique intégrée. Rien n'est installé sans clic sur « Installer et redémarrer ».
 */
export function useMiseAJour() {
  const [etat, setEtat] = useState<EtatMaj>({ etat: "inactif" });
  const mise = useRef<Mise | null>(null);

  /** `manuel` : on affiche aussi la vérification en cours et les erreurs ; en automatique, un échec réseau reste silencieux. */
  const verifier = useCallback(async (manuel: boolean) => {
    if (!dansTauri()) return;
    if (manuel) setEtat({ etat: "verification" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const u = (await check()) as Mise | null;
      if (u) {
        mise.current = u;
        setEtat({ etat: "disponible", version: u.version, notes: u.body });
      } else if (manuel) setEtat({ etat: "a-jour", verifieLe: Date.now() });
      else setEtat((e) => (e.etat === "disponible" || e.etat === "telechargement" ? e : { etat: "a-jour", verifieLe: Date.now() }));
    } catch (e) {
      if (manuel) setEtat({ etat: "erreur", message: e instanceof Error ? e.message : String(e) });
      else console.warn("Vérification de mise à jour impossible :", e);
    }
  }, []);

  const installer = useCallback(async () => {
    const u = mise.current;
    if (!u) return;
    let total = 0;
    let recu = 0;
    setEtat({ etat: "telechargement", pct: null });
    try {
      await u.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        else if (ev.event === "Progress") {
          recu += ev.data.chunkLength;
          setEtat({ etat: "telechargement", pct: total ? Math.round((recu / total) * 100) : null });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setEtat({ etat: "erreur", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    const premiere = setTimeout(() => void verifier(false), 20_000);
    const periodique = setInterval(() => void verifier(false), 6 * 3600_000);
    return () => {
      clearTimeout(premiere);
      clearInterval(periodique);
    };
  }, [verifier]);

  return { etat, verifier, installer };
}
