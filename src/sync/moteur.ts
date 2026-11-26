import type { Alerte } from "../alertes/moteur";
import type { Dessin } from "../dessins";
import { cleActif, type Actif } from "../donnees/types";
import type { Position } from "../portefeuille";
import { chiffrer, dechiffrer, ErreurMotDePasse, type Chiffre } from "./chiffrement";
import { fusionnerDictionnaireDeListes, fusionnerListe, memeValeur, type Cote } from "./fusion";

/**
 * Données synchronisées entre appareils : la liste (actifs et catégories), le portefeuille, les alertes et les tracés.
 * Les préférences d'affichage (thème, fenêtre, indicateurs…) restent propres à chaque appareil.
 */
export interface EtatSync {
  actifs: Actif[];
  categories: string[];
  positions: Position[];
  alertes: Alerte[];
  dessins: Record<string, Dessin[]>;
  /** Lots dont l'alerte TP a été supprimée volontairement : sans cela, un autre appareil la recréerait. */
  tpIgnores: string[];
}

export const ETAT_VIDE: EtatSync = { actifs: [], categories: [], positions: [], alertes: [], dessins: {}, tpIgnores: [] };

/** Aucune donnée utile (ni actif, ni position, ni alerte) : état d'un appareil neuf, ou d'une lecture ratée. */
export const etatVide = (e: EtatSync) => !e.actifs.length && !e.positions.length && !e.alertes.length;

export function fusionnerEtats(base: EtatSync, local: EtatSync, distant: EtatSync, prefere: Cote): EtatSync {
  const texte = (s: string) => s;
  return {
    actifs: fusionnerListe(base.actifs, local.actifs, distant.actifs, cleActif, prefere),
    categories: fusionnerListe(base.categories, local.categories, distant.categories, texte, prefere),
    positions: fusionnerListe(base.positions, local.positions, distant.positions, (p) => p.id, prefere),
    alertes: fusionnerListe(base.alertes, local.alertes, distant.alertes, (a) => a.id, prefere),
    dessins: fusionnerDictionnaireDeListes(base.dessins, local.dessins, distant.dessins, (d) => d.id, prefere),
    tpIgnores: fusionnerListe(base.tpIgnores, local.tpIgnores, distant.tpIgnores, texte, prefere),
  };
}

/** Contenu d'un fichier de synchronisation, une fois déchiffré. */
export interface ContenuSync {
  ecritLe: number;
  appareil: string;
  etat: EtatSync;
}

export class ErreurSync extends Error {}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const tableau = (v: unknown) => (Array.isArray(v) ? v : []);

/** Complète un état lu dans un fichier (un champ absent ou invalide devient vide : on ne casse jamais l'application sur un fichier étranger). */
export function normaliserEtat(v: unknown): EtatSync {
  const o = estObjet(v) ? v : {};
  const dessins: Record<string, Dessin[]> = {};
  if (estObjet(o.dessins)) for (const [k, l] of Object.entries(o.dessins)) if (Array.isArray(l)) dessins[k] = l as Dessin[];
  return {
    actifs: tableau(o.actifs).filter((a): a is Actif => estObjet(a) && typeof a.symbole === "string" && (a.source === "binance" || a.source === "yahoo")),
    categories: tableau(o.categories).filter((c): c is string => typeof c === "string"),
    positions: tableau(o.positions).filter((p): p is Position => estObjet(p) && typeof p.id === "string" && typeof p.cle === "string"),
    alertes: tableau(o.alertes).filter((a): a is Alerte => estObjet(a) && typeof a.id === "string" && estObjet(a.actif) && estObjet(a.condition)),
    dessins,
    tpIgnores: tableau(o.tpIgnores).filter((x): x is string => typeof x === "string"),
  };
}

/** Texte du fichier à écrire : JSON lisible, ou enveloppe chiffrée si un mot de passe est défini. */
export async function serialiser(c: ContenuSync, motDePasse: string): Promise<string> {
  const interne = JSON.stringify(c);
  if (!motDePasse) return JSON.stringify({ hune: "sync", v: 1, chiffre: false, ...c }, null, 1);
  const enveloppe: { hune: "sync"; v: 1; chiffre: true } & Chiffre = { hune: "sync", v: 1, chiffre: true, ...(await chiffrer(interne, motDePasse)) };
  return JSON.stringify(enveloppe);
}

/** Lit un fichier de synchronisation. Lève ErreurSync (message lisible) ou ErreurMotDePasse. */
export async function lireContenu(texte: string, motDePasse: string): Promise<ContenuSync> {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ErreurSync("Le fichier de synchronisation est illisible (JSON invalide).");
  }
  if (!estObjet(brut) || brut.hune !== "sync") throw new ErreurSync("Ce fichier n'est pas un fichier de synchronisation de Hune.");
  if (brut.v !== 1) throw new ErreurSync(`Version de synchronisation non prise en charge (${String(brut.v)}) : mettez Hune à jour.`);
  let contenu: unknown = brut;
  if (brut.chiffre) {
    if (!motDePasse) throw new ErreurSync("Le fichier de synchronisation est chiffré : saisissez le mot de passe.");
    contenu = JSON.parse(await dechiffrer(brut as unknown as Chiffre, motDePasse));
  }
  if (!estObjet(contenu)) throw new ErreurSync("Contenu de synchronisation invalide.");
  return { ecritLe: typeof contenu.ecritLe === "number" ? contenu.ecritLe : 0, appareil: typeof contenu.appareil === "string" ? contenu.appareil : "", etat: normaliserEtat(contenu.etat) };
}

export interface EntreesSync {
  lire: () => Promise<string | null>;
  ecrire: (contenu: string) => Promise<void>;
}

export interface ParametresSync {
  local: EtatSync;
  /** Dernier état synchronisé par cet appareil (null à la première synchronisation). */
  base: EtatSync | null;
  appareil: string;
  /** Instant de la dernière modification locale (ms) : il départage les modifications des deux côtés. */
  modifieLocalLe: number;
  motDePasse: string;
  /** Ancien mot de passe, essayé si le fichier ne s'ouvre pas avec le nouveau (changement de mot de passe). */
  motDePasseLecture?: string;
  /** Réécrit le fichier même si la fusion n'a rien changé (nouveau mot de passe, par exemple). */
  forcerEcriture?: boolean;
  maintenant: number;
}

export interface ResultatSync {
  /** Résultat de la fusion : nouvel état de référence de cet appareil. */
  etat: EtatSync;
  /** Vrai si la fusion diffère de l'état local : il faut l'appliquer à l'application. */
  appliquer: boolean;
  /** Vrai si le fichier a été (ré)écrit. */
  ecrit: boolean;
}

/**
 * Une synchronisation : lit le fichier, fusionne avec l'état local, réécrit le fichier si la fusion l'a changé.
 * Garde-fou : un état local entièrement vide alors que l'appareil avait des données n'efface jamais celles des autres appareils.
 */
export async function synchroniser(io: EntreesSync, p: ParametresSync): Promise<ResultatSync> {
  if (etatVide(p.local) && p.base && !etatVide(p.base)) throw new ErreurSync("Les données de cet appareil sont vides : synchronisation suspendue pour ne rien effacer sur les autres appareils.");
  const texte = await io.lire();
  let distant: ContenuSync | null = null;
  if (texte !== null) {
    try {
      distant = await lireContenu(texte, p.motDePasse);
    } catch (e) {
      if (p.motDePasseLecture === undefined || !(e instanceof ErreurMotDePasse || e instanceof ErreurSync)) throw e;
      distant = await lireContenu(texte, p.motDePasseLecture);
    }
  }

  if (!distant) {
    if (etatVide(p.local)) return { etat: p.local, appliquer: false, ecrit: false };
    await io.ecrire(await serialiser({ ecritLe: p.maintenant, appareil: p.appareil, etat: p.local }, p.motDePasse));
    return { etat: p.local, appliquer: false, ecrit: true };
  }

  const prefere: Cote = p.modifieLocalLe > distant.ecritLe ? "local" : "distant";
  const fusion = fusionnerEtats(p.base ?? ETAT_VIDE, p.local, distant.etat, prefere);
  const ecrit = !!p.forcerEcriture || !memeValeur(fusion, distant.etat);
  if (ecrit) await io.ecrire(await serialiser({ ecritLe: p.maintenant, appareil: p.appareil, etat: fusion }, p.motDePasse));
  return { etat: fusion, appliquer: !memeValeur(fusion, p.local), ecrit };
}
