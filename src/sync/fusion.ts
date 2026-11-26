/**
 * Fusion « à trois voies » : on compare chaque côté à `base`, le dernier état que cet appareil a synchronisé.
 * Un élément modifié d'un seul côté prend la version de ce côté ; ajouté ou supprimé d'un seul côté, il est ajouté ou supprimé ;
 * modifié des deux côtés, c'est la version du côté le plus récent (`prefere`) qui l'emporte. Une modification l'emporte
 * toujours sur une suppression faite de l'autre côté : on ne perd jamais une édition en silence.
 * Aucun horodatage par élément n'est nécessaire, ce qui laisse les données existantes telles quelles.
 */
export type Cote = "local" | "distant";

/** Sérialisation stable (clés triées) pour comparer deux valeurs par leur contenu. */
export function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonique(x)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export const memeValeur = (a: unknown, b: unknown) => canonique(a) === canonique(b);

const egalTableaux = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Fusionne trois listes d'éléments identifiés par `cle`. L'ordre suit le côté qui l'a changé (le plus récent si les deux l'ont fait). */
export function fusionnerListe<T>(base: T[], local: T[], distant: T[], cle: (t: T) => string, prefere: Cote): T[] {
  const index = (l: T[]) => new Map(l.map((t) => [cle(t), t] as const));
  const b = index(base);
  const l = index(local);
  const r = index(distant);
  const gardes = new Map<string, T>();

  for (const k of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const eb = b.get(k);
    const el = l.get(k);
    const er = r.get(k);
    if (eb === undefined) {
      if (el !== undefined && er !== undefined) gardes.set(k, memeValeur(el, er) || prefere === "local" ? el : er);
      else gardes.set(k, (el ?? er) as T);
      continue;
    }
    const localChange = el === undefined || !memeValeur(el, eb);
    const distantChange = er === undefined || !memeValeur(er, eb);
    if (!localChange && !distantChange) gardes.set(k, eb);
    else if (localChange && !distantChange) {
      if (el !== undefined) gardes.set(k, el);
    } else if (!localChange && distantChange) {
      if (er !== undefined) gardes.set(k, er);
    } else if (el !== undefined && er !== undefined) gardes.set(k, prefere === "local" ? el : er);
    else if (el !== undefined || er !== undefined) gardes.set(k, (el ?? er) as T); // modifié d'un côté, supprimé de l'autre
  }

  // Ordre : on part de la liste dont l'ordre relatif a changé par rapport à la base.
  const ordB = base.map(cle);
  const ordL = local.map(cle);
  const ordR = distant.map(cle);
  const communsL = ordL.filter((k) => b.has(k));
  const communsR = ordR.filter((k) => b.has(k));
  const ordreBaseL = ordB.filter((k) => l.has(k));
  const ordreBaseR = ordB.filter((k) => r.has(k));
  const ordreLocalChange = !egalTableaux(communsL, ordreBaseL);
  const ordreDistantChange = !egalTableaux(communsR, ordreBaseR);
  // Sans changement d'ordre local, la liste distante fait foi (elle est la même pour tous les appareils).
  const principalLocal = ordreLocalChange && (!ordreDistantChange || prefere === "local");
  const [principal, secondaire] = principalLocal ? [ordL, ordR] : [ordR, ordL];

  const ordre = principal.filter((k) => gardes.has(k));
  for (const [i, k] of secondaire.entries()) {
    if (!gardes.has(k) || ordre.includes(k)) continue;
    // Un élément que seul l'autre côté connaît s'insère après son voisin précédent (s'il est déjà placé), sinon en tête.
    let apres = -1;
    for (let j = i - 1; j >= 0 && apres < 0; j--) apres = ordre.indexOf(secondaire[j]);
    // Deux nouveautés dans le même creux (une de chaque côté) : classées par clé, pour que tous les appareils trouvent le même ordre.
    let place = apres + 1;
    while (place < ordre.length && !b.has(ordre[place]) && ordre[place] < k) place++;
    ordre.splice(place, 0, k);
  }
  return ordre.map((k) => gardes.get(k) as T);
}

/** Fusionne des dictionnaires de listes (ex. tracés par actif). Les listes vides disparaissent du résultat. */
export function fusionnerDictionnaireDeListes<T>(base: Record<string, T[]>, local: Record<string, T[]>, distant: Record<string, T[]>, cle: (t: T) => string, prefere: Cote): Record<string, T[]> {
  const sortie: Record<string, T[]> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(distant)])) {
    const liste = fusionnerListe(base[k] ?? [], local[k] ?? [], distant[k] ?? [], cle, prefere);
    if (liste.length) sortie[k] = liste;
  }
  return sortie;
}
