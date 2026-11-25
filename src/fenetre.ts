import { useCallback, useEffect, useState } from "react";
import { dansTauri } from "./donnees/http";

/** Taille « normale » de la fenêtre, en pixels logiques, et taille minimale correspondante. */
const MIN_NORMAL = { largeur: 860, hauteur: 560 };
const MIN_COMPACT = { largeur: 300, hauteur: 360 };
const TAILLE_COMPACTE = { largeur: 340, hauteur: 660 };

/**
 * Commandes de la fenêtre pour la barre de titre personnalisée (la fenêtre n'a plus de cadre Windows).
 * Hors de l'application (navigateur de test), tout est sans effet et `disponible` vaut false.
 */
export function useFenetre() {
  const [maximisee, setMaximisee] = useState(false);
  const [toujoursDevant, setToujoursDevant] = useState(false);

  useEffect(() => {
    if (!dansTauri()) return;
    let desabonner: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      setMaximisee(await w.isMaximized());
      desabonner = await w.onResized(async () => setMaximisee(await w.isMaximized()));
    });
    return () => desabonner?.();
  }, []);

  const fenetre = useCallback(async () => (await import("@tauri-apps/api/window")).getCurrentWindow(), []);

  return {
    disponible: dansTauri(),
    maximisee,
    toujoursDevant,
    minimiser: () => void fenetre().then((w) => w.minimize()),
    basculerMaximisation: () => void fenetre().then((w) => w.toggleMaximize()),
    // La coque Rust transforme la fermeture en masquage : l'application reste dans la zone de notification.
    fermer: () => void fenetre().then((w) => w.close()),
    basculerToujoursDevant: async () => {
      const w = await fenetre();
      const suite = !toujoursDevant;
      await w.setAlwaysOnTop(suite);
      setToujoursDevant(suite);
    },
  };
}

/** Passe en mode compact : petite fenêtre étroite qui ne montre que la liste. Renvoie la taille à restaurer. */
export async function entrerModeCompact(): Promise<{ largeur: number; hauteur: number } | null> {
  if (!dansTauri()) return null;
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (await w.isMaximized()) await w.unmaximize();
  const echelle = await w.scaleFactor();
  const taille = (await w.innerSize()).toLogical(echelle);
  await w.setMinSize(new LogicalSize(MIN_COMPACT.largeur, MIN_COMPACT.hauteur));
  await w.setSize(new LogicalSize(TAILLE_COMPACTE.largeur, TAILLE_COMPACTE.hauteur));
  return { largeur: taille.width, hauteur: taille.height };
}

/** Quitte le mode compact et rend à la fenêtre sa taille d'avant. */
export async function sortirModeCompact(precedente: { largeur: number; hauteur: number } | null): Promise<void> {
  if (!dansTauri()) return;
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  await w.setMinSize(new LogicalSize(MIN_NORMAL.largeur, MIN_NORMAL.hauteur));
  const t = precedente ?? { largeur: 1180, hauteur: 760 };
  await w.setSize(new LogicalSize(Math.max(t.largeur, MIN_NORMAL.largeur), Math.max(t.hauteur, MIN_NORMAL.hauteur)));
}
