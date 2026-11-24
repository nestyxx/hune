import { dansTauri } from "./donnees/http";

/**
 * Persistance locale. Dans l'application : fichier JSON (`hune.json`, dossier de données de
 * l'application) via le plugin store. Dans un navigateur de test : localStorage. Ce sont des données personnelles
 * (watchlist, positions, alertes, réglages) : elles restent sur le poste et ne sont jamais envoyées ailleurs.
 */
const FICHIER = "hune.json";

type Magasin = { get<T>(cle: string): Promise<T | undefined>; set(cle: string, v: unknown): Promise<void>; save(): Promise<void> };
let magasin: Promise<Magasin> | null = null;

function ouvrir(): Promise<Magasin> {
  magasin ??= import("@tauri-apps/plugin-store").then(({ load }) => load(FICHIER, { defaults: {}, autoSave: false }) as unknown as Magasin);
  return magasin;
}

export async function lire<T>(cle: string, defaut: T): Promise<T> {
  if (dansTauri()) return (await (await ouvrir()).get<T>(cle)) ?? defaut;
  const brut = localStorage.getItem(cle);
  return brut ? (JSON.parse(brut) as T) : defaut;
}

export async function ecrire(cle: string, valeur: unknown): Promise<void> {
  if (dansTauri()) {
    const m = await ouvrir();
    await m.set(cle, valeur);
    await m.save();
  } else localStorage.setItem(cle, JSON.stringify(valeur));
}
