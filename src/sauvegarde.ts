import { ecrire, lire } from "./stockage";

/** Clés sauvegardées, avec leur valeur par défaut (une clé absente d'un fichier importé est simplement ignorée). */
const CLES = ["actifs", "categories", "repliees", "alertes", "positions", "reglages", "indicateurs", "parametres", "typeGraphique", "intervalle", "tri", "echelleLog", "dessins", "lignesPortefeuille"] as const;

export interface Sauvegarde {
  application: "hune";
  version: 1;
  exporteLe: string;
  donnees: Partial<Record<(typeof CLES)[number], unknown>>;
}

/** Rassemble toutes les données utilisateur (watchlist, catégories, alertes, réglages) dans un objet exportable. */
export async function construireSauvegarde(): Promise<Sauvegarde> {
  const donnees: Sauvegarde["donnees"] = {};
  for (const c of CLES) {
    const v = await lire<unknown>(c, null);
    if (v !== null) donnees[c] = v;
  }
  return { application: "hune", version: 1, exporteLe: new Date().toISOString(), donnees };
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Vérifie qu'un texte est bien une sauvegarde de cette application et renvoie les données à restaurer.
 * Lève une Error au message lisible sinon. Les valeurs sont contrôlées sommairement (types et sources connues)
 * pour qu'un fichier trafiqué ou d'une autre application ne casse pas l'interface au prochain démarrage.
 */
export function lireSauvegarde(texte: string): Sauvegarde["donnees"] {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error("Ce fichier n'est pas du JSON valide.");
  }
  if (!estObjet(brut) || (brut.application !== "hune" && brut.application !== "suivi-marches") || !estObjet(brut.donnees)) throw new Error("Ce fichier n'est pas une sauvegarde de Hune.");
  if (brut.version !== 1) throw new Error(`Version de sauvegarde non prise en charge (${String(brut.version)}).`);

  const d = brut.donnees;
  const sourceOk = (s: unknown) => s === "binance" || s === "yahoo";
  const actifOk = (a: unknown) => estObjet(a) && sourceOk(a.source) && typeof a.symbole === "string" && typeof a.nom === "string";
  if (d.actifs !== undefined && !(Array.isArray(d.actifs) && d.actifs.every(actifOk))) throw new Error("Liste d'actifs invalide dans la sauvegarde.");
  if (
    d.alertes !== undefined &&
    !(Array.isArray(d.alertes) && d.alertes.every((a) => estObjet(a) && typeof a.id === "string" && actifOk(a.actif) && estObjet(a.condition) && ["prix", "variation", "rsi", "croisement", "franchissement"].includes(String(a.condition.type)) && ["armee", "declenchee"].includes(String(a.statut))))
  )
    throw new Error("Liste d'alertes invalide dans la sauvegarde.");
  if (d.categories !== undefined && !(Array.isArray(d.categories) && d.categories.every((c) => typeof c === "string"))) throw new Error("Liste de catégories invalide dans la sauvegarde.");
  const nombreOuAbsent = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0);
  if (
    d.positions !== undefined &&
    !(Array.isArray(d.positions) && d.positions.every((p) => estObjet(p) && typeof p.id === "string" && typeof p.cle === "string" && ["quantite", "montantEur", "pamp", "objectif"].every((k) => nombreOuAbsent(p[k]))))
  )
    throw new Error("Liste de positions invalide dans la sauvegarde.");

  // Tracés : { clé d'actif: [ {id, type, a: {temps, prix}, b?} ] }.
  const pointOk = (p: unknown) => estObjet(p) && typeof p.temps === "number" && Number.isFinite(p.temps) && typeof p.prix === "number" && Number.isFinite(p.prix);
  const dessinOk = (x: unknown) => estObjet(x) && typeof x.id === "string" && ["horizontale", "tendance", "rayon", "fibonacci"].includes(String(x.type)) && pointOk(x.a) && (x.b === undefined || pointOk(x.b));
  if (d.dessins !== undefined && !(estObjet(d.dessins) && Object.values(d.dessins).every((l) => Array.isArray(l) && l.every(dessinOk)))) throw new Error("Tracés invalides dans la sauvegarde.");

  const retenu: Sauvegarde["donnees"] = {};
  for (const c of CLES) if (d[c] !== undefined) retenu[c] = d[c];
  return retenu;
}

type Donnees = Sauvegarde["donnees"];
const liste = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/**
 * Fusionne des données importées dans les données courantes, sans rien supprimer :
 * - actifs : union par `source:symbole` (l'import met à jour nom et catégorie) ;
 * - catégories : union en conservant l'ordre actuel ;
 * - positions et alertes : union par identifiant (une réimportation met à jour au lieu de dupliquer) ;
 * - tous les autres réglages : on garde les valeurs actuelles, l'import ne comble que ce qui manque.
 */
export function fusionner(courant: Donnees, importe: Donnees): Donnees {
  const resultat: Donnees = { ...courant };
  const parCle = <T extends Record<string, unknown>>(base: T[], ajout: T[], cle: (x: T) => string, fusion: (a: T, b: T) => T): T[] => {
    const m = new Map(base.map((x) => [cle(x), x]));
    for (const x of ajout) m.set(cle(x), m.has(cle(x)) ? fusion(m.get(cle(x))!, x) : x);
    return [...m.values()];
  };
  if (importe.actifs !== undefined) {
    resultat.actifs = parCle(liste(courant.actifs), liste(importe.actifs), (a) => `${a.source}:${a.symbole}`, (a, b) => ({ ...a, ...b }));
  }
  if (importe.categories !== undefined) {
    resultat.categories = [...new Set([...(Array.isArray(courant.categories) ? (courant.categories as string[]) : []), ...(importe.categories as string[])])];
  }
  if (importe.positions !== undefined) resultat.positions = parCle(liste(courant.positions), liste(importe.positions), (p) => String(p.id), (_a, b) => b);
  if (importe.alertes !== undefined) resultat.alertes = parCle(liste(courant.alertes), liste(importe.alertes), (a) => String(a.id), (a) => a);
  for (const c of CLES) if (resultat[c] === undefined && importe[c] !== undefined) resultat[c] = importe[c];
  return resultat;
}

/** Écrit les données importées (remplacement complet des clés présentes dans le fichier). */
export async function restaurer(donnees: Sauvegarde["donnees"]): Promise<void> {
  for (const [cle, valeur] of Object.entries(donnees)) await ecrire(cle, valeur);
}

/** Déclenche le téléchargement d'un fichier (JSON par défaut) depuis la page. */
export function telecharger(nom: string, contenu: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
