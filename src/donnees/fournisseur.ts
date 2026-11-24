import type { Bougie, Cotation, Intervalle, ResultatRecherche, SourceId } from "./types";

/**
 * Interface d'une source de données de marché. Pour remplacer Binance ou Yahoo par autre chose,
 * il suffit d'écrire une nouvelle classe qui l'implémente et de l'enregistrer dans `donnees/index.ts`.
 */
export interface DataProvider {
  readonly id: SourceId;
  readonly nom: string;
  /** true si les prix ne sont pas en temps réel (affiché dans l'interface). */
  readonly differe: boolean;
  /** Texte expliquant le décalage, affiché dans l'info-bulle du badge. */
  readonly noteDonnees: string;

  /** Recherche par symbole ou par nom. */
  rechercher(requete: string): Promise<ResultatRecherche[]>;
  /** Historique de bougies, de la plus ancienne à la plus récente. */
  bougies(symbole: string, intervalle: Intervalle): Promise<Bougie[]>;
  /** Derniers prix de plusieurs symboles à la fois. */
  cotations(symboles: string[]): Promise<Cotation[]>;
  /** Devise de cotation d'un symbole (code ISO : EUR, USD… ; « GBp » pour les pence). Sert à valoriser le portefeuille en euros. */
  devise(symbole: string): Promise<string>;
  /**
   * Flux temps réel facultatif de la bougie en cours. Renvoie la fonction d'arrêt.
   * Sans flux, l'interface réinterroge `bougies` périodiquement.
   */
  abonner?(symbole: string, intervalle: Intervalle, surBougie: (b: Bougie) => void): () => void;
}
