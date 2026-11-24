/**
 * Cache + backoff, partagés par toutes les requêtes d'une source.
 *
 * - Cache : une même requête n'est pas refaite avant l'expiration de son TTL (et les requêtes
 *   simultanées identiques sont fusionnées).
 * - Backoff : après une erreur (ou un 429/418 de rate limit), la source est mise en pause avec un délai
 *   exponentiel (2 s, 4 s, 8 s… plafonné à 5 min). Pendant la pause, on resert le dernier résultat connu
 *   s'il existe, sinon on lève `ErreurPause`.
 */

export class ErreurPause extends Error {
  constructor(public readonly reprendDansMs: number) {
    super(`Source en pause encore ${Math.ceil(reprendDansMs / 1000)} s après des erreurs`);
  }
}

/** Erreur HTTP, pour distinguer le rate limit (pause plus longue). */
export class ErreurHttp extends Error {
  constructor(public readonly statut: number, message?: string) {
    super(message ?? `HTTP ${statut}`);
  }
}

interface Entree<T> {
  valeur: T;
  expireA: number;
}

export class Requeteur {
  private cache = new Map<string, Entree<unknown>>();
  private enCours = new Map<string, Promise<unknown>>();
  private echecs = 0;
  private pauseJusqua = 0;

  constructor(
    /** Horloge injectable pour les tests. */
    private readonly maintenant: () => number = Date.now,
    private readonly baseMs = 2000,
    private readonly plafondMs = 5 * 60_000,
  ) {}

  /** Vrai tant que la source est en pause suite à des erreurs. */
  get enPause() {
    return this.maintenant() < this.pauseJusqua;
  }

  async obtenir<T>(cle: string, ttlMs: number, charger: () => Promise<T>): Promise<T> {
    const now = this.maintenant();
    const entree = this.cache.get(cle) as Entree<T> | undefined;
    if (entree && entree.expireA > now) return entree.valeur;

    if (now < this.pauseJusqua) {
      // Pause : on resert une valeur périmée plutôt que d'échouer.
      if (entree) return entree.valeur;
      throw new ErreurPause(this.pauseJusqua - now);
    }

    const existante = this.enCours.get(cle) as Promise<T> | undefined;
    if (existante) return existante;

    const promesse = charger()
      .then((valeur) => {
        this.echecs = 0;
        this.cache.set(cle, { valeur, expireA: this.maintenant() + ttlMs });
        return valeur;
      })
      .catch((e) => {
        this.echecs++;
        // Rate limit : on part directement sur une pause longue.
        const limite = e instanceof ErreurHttp && (e.statut === 429 || e.statut === 418);
        const delai = Math.min(this.baseMs * 2 ** (limite ? Math.max(this.echecs - 1, 4) : this.echecs - 1), this.plafondMs);
        this.pauseJusqua = this.maintenant() + delai;
        if (entree) return entree.valeur;
        throw e;
      })
      .finally(() => this.enCours.delete(cle));
    this.enCours.set(cle, promesse);
    return promesse;
  }
}
