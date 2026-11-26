/**
 * Chiffrement du fichier de synchronisation (facultatif, recommandé : le dossier est souvent dans un Drive).
 * AES-256-GCM, clé dérivée du mot de passe par PBKDF2-SHA-256 (210 000 itérations) avec un sel aléatoire par fichier.
 * Le mot de passe ne quitte jamais l'appareil ; l'oublier rend le fichier illisible (les données locales restent intactes).
 */
const ITERATIONS = 210_000;
const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

export class ErreurMotDePasse extends Error {
  constructor(message = "Mot de passe incorrect ou fichier de synchronisation altéré.") {
    super(message);
  }
}

const versBase64 = (o: Uint8Array) => {
  let s = "";
  for (const x of o) s += String.fromCharCode(x);
  return btoa(s);
};
const depuisBase64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

async function cle(motDePasse: string, sel: Uint8Array): Promise<CryptoKey> {
  const matiere = await crypto.subtle.importKey("raw", encodeur.encode(motDePasse), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sel as BufferSource, iterations: ITERATIONS, hash: "SHA-256" }, matiere, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export interface Chiffre {
  sel: string;
  iv: string;
  donnees: string;
}

export async function chiffrer(texte: string, motDePasse: string): Promise<Chiffre> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await cle(motDePasse, sel);
  const brut = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, k, encodeur.encode(texte));
  return { sel: versBase64(sel), iv: versBase64(iv), donnees: versBase64(new Uint8Array(brut)) };
}

export async function dechiffrer(c: Chiffre, motDePasse: string): Promise<string> {
  try {
    const k = await cle(motDePasse, depuisBase64(c.sel));
    const brut = await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(c.iv) as BufferSource }, k, depuisBase64(c.donnees) as BufferSource);
    return decodeur.decode(brut);
  } catch {
    throw new ErreurMotDePasse();
  }
}
