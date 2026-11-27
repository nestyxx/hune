import type { IChartApi, ISeriesApi, ISeriesPrimitive, Logical, SeriesAttachedParameter, SeriesType, Time } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Bougie } from "./donnees/types";
import { distanceSegment, indiceDepuisTemps, NIVEAUX_FIBONACCI, prixFibonacci, prolongement, type Dessin } from "./dessins";
import { detecterSommets, fenetreSommets } from "./sommets";

/** Couleurs des niveaux de Fibonacci (0 → 1). */
const COULEURS_FIBO = ["#8a93a3", "#e08a00", "#26a69a", "#2f81f7", "#8e6bff", "#d3569a", "#8a93a3"];
const TOLERANCE_PX = 6;

export interface Sources {
  /** Instants des bougies actuellement chargées (triés). */
  temps: () => number[];
  /** Durée d'une bougie en secondes. */
  pas: () => number;
  /** Bougies chargées (pour les valeurs aux sommets et aux creux). */
  bougies: () => Bougie[];
  couleurs: () => { trait: string; texte: string; fond: string };
  formater: (prix: number) => string;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Calque de tracés attaché à la série principale : dessine les tracés de l'utilisateur sur le canevas du graphique
 * et retrouve celui qui se trouve sous la souris. Les points sont convertis (instant, prix) → pixels à chaque rendu,
 * donc zoom, défilement, échelle logarithmique et chargement d'historique sont suivis sans rien recalculer.
 */
export class CalqueDessins implements ISeriesPrimitive<Time> {
  dessins: Dessin[] = [];
  /** Tracé en cours de création (second point suivant la souris). */
  brouillon: Dessin | null = null;
  /** Tracé survolé (gomme) : mis en évidence. */
  survol: string | null = null;
  /** Affiche la valeur des plus hauts et plus bas dominants (à la ProRealTime). */
  sommets = false;
  private cacheBarres: { cle: string; hauts: number[]; bas: number[] } = { cle: "", hauts: [], bas: [] };
  private chart: IChartApi | null = null;
  private serie: ISeriesApi<SeriesType> | null = null;
  private demander: (() => void) | null = null;

  constructor(private src: Sources) {}

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.serie = p.series;
    this.demander = p.requestUpdate;
  }

  detached() {
    this.chart = this.serie = this.demander = null;
  }

  /** Demande un nouveau rendu. */
  actualiser() {
    this.demander?.();
  }

  paneViews() {
    return [{ zOrder: () => "top" as const, renderer: () => ({ draw: (cible: CanvasRenderingTarget2D) => this.dessiner(cible) }) }];
  }

  private x(temps: number): number | null {
    if (!this.chart) return null;
    return this.chart.timeScale().logicalToCoordinate(indiceDepuisTemps(this.src.temps(), temps, this.src.pas()) as Logical);
  }

  private y(prix: number): number | null {
    return this.serie?.priceToCoordinate(prix) ?? null;
  }

  /** Segment d'un tracé en pixels (null si une coordonnée est hors échelle). Rayon : prolongé jusqu'au bord droit/gauche. */
  private segment(d: Dessin, largeur: number): Segment | null {
    const x1 = this.x(d.a.temps);
    const y1 = this.y(d.a.prix);
    if (x1 == null || y1 == null) return null;
    if (d.type === "horizontale") return { x1: 0, y1, x2: largeur, y2: y1 };
    if (!d.b) return null;
    const x2 = this.x(d.b.temps);
    const y2 = this.y(d.b.prix);
    if (x2 == null || y2 == null) return null;
    if (d.type === "rayon") {
      const f = prolongement(x1, y1, x2, y2, largeur);
      return { x1, y1, x2: f.x, y2: f.y };
    }
    return { x1, y1, x2, y2 };
  }

  /** Tracé le plus proche du point (px, py) du graphique, s'il est assez près. */
  toucher(px: number, py: number, largeur: number): string | null {
    let meilleur: { id: string; dist: number } | null = null;
    const proposer = (id: string, dist: number) => {
      if (dist <= TOLERANCE_PX && (!meilleur || dist < meilleur.dist)) meilleur = { id, dist };
    };
    for (const d of this.dessins) {
      if (d.type === "fibonacci" && d.b) {
        const x1 = this.x(d.a.temps);
        const x2 = this.x(d.b.temps);
        if (x1 == null || x2 == null) continue;
        for (const n of NIVEAUX_FIBONACCI) {
          const y = this.y(prixFibonacci(d.a, d.b, n));
          if (y != null) proposer(d.id, distanceSegment(px, py, Math.min(x1, x2), y, largeur, y));
        }
        continue;
      }
      const s = this.segment(d, largeur);
      if (s) proposer(d.id, distanceSegment(px, py, s.x1, s.y1, s.x2, s.y2));
    }
    return (meilleur as { id: string } | null)?.id ?? null;
  }

  /** Tracé sous (px, py) et partie saisie : une extrémité (« a », « b ») à moins de 9 px, sinon le corps du tracé. */
  partie(px: number, py: number, largeur: number): { id: string; partie: "a" | "b" | "corps" } | null {
    const id = this.toucher(px, py, largeur);
    const d = id ? this.dessins.find((x) => x.id === id) : null;
    if (!id || !d) return null;
    const pres = (t: number, p: number) => {
      const x = this.x(t);
      const y = this.y(p);
      return x != null && y != null && Math.hypot(px - x, py - y) <= 9;
    };
    if (d.type !== "horizontale") {
      if (pres(d.a.temps, d.a.prix)) return { id, partie: "a" };
      if (d.b && pres(d.b.temps, d.b.prix)) return { id, partie: "b" };
    }
    return { id, partie: "corps" };
  }

  private dessiner(cible: CanvasRenderingTarget2D) {
    cible.useMediaCoordinateSpace(({ context: c, mediaSize }) => {
      const coul = this.src.couleurs();
      const largeur = mediaSize.width;
      c.save();
      c.font = "11px Figtree, system-ui, sans-serif";
      c.textBaseline = "middle";
      const liste = this.brouillon ? [...this.dessins, this.brouillon] : this.dessins;
      for (const d of liste) {
        const enCours = d === this.brouillon;
        const accentue = d.id === this.survol;
        c.globalAlpha = enCours ? 0.75 : 1;
        c.lineWidth = accentue ? 3 : 1.5;
        c.strokeStyle = coul.trait;
        c.fillStyle = coul.trait;
        c.setLineDash(enCours ? [4, 4] : []);
        if (d.type === "fibonacci") this.dessinerFibonacci(c, d, largeur, coul);
        else this.dessinerLigne(c, d, largeur, coul);
      }
      c.restore();
      this.dessinerSommets(c, largeur, coul);
    });
  }

  /**
   * Prix écrits au-dessus des plus hauts et sous les plus bas dominants. La fenêtre de dominance s'adapte à l'écart entre
   * bougies : en dézoomant, il y a moins d'étiquettes, mais elles restent lisibles. Un halo de la couleur du fond garde le texte net.
   */
  private dessinerSommets(c: CanvasRenderingContext2D, largeur: number, coul: { texte: string; fond: string }) {
    if (!this.sommets || !this.chart || !this.serie) return;
    const barres = this.src.bougies();
    const plage = this.chart.timeScale().getVisibleLogicalRange();
    if (!barres.length || !plage) return;
    const cle = `${barres.length}:${barres[0].temps}:${barres[barres.length - 1].temps}:${barres[barres.length - 1].haut}:${barres[barres.length - 1].bas}`;
    if (this.cacheBarres.cle !== cle) this.cacheBarres = { cle, hauts: barres.map((b) => b.haut), bas: barres.map((b) => b.bas) };
    const x0 = this.chart.timeScale().logicalToCoordinate(0 as Logical);
    const x1 = this.chart.timeScale().logicalToCoordinate(1 as Logical);
    const f = fenetreSommets(x0 != null && x1 != null ? Math.abs(x1 - x0) : 0);
    c.save();
    c.font = "11px Figtree, system-ui, sans-serif";
    c.textAlign = "center";
    c.lineJoin = "round";
    c.lineWidth = 3;
    c.strokeStyle = coul.fond;
    c.fillStyle = coul.texte;
    let dernierHaut = -Infinity;
    let dernierBas = -Infinity;
    for (const s of detecterSommets(this.cacheBarres.hauts, this.cacheBarres.bas, f, plage.from - 1, plage.to + 1)) {
      const x = this.chart.timeScale().logicalToCoordinate(s.indice as Logical);
      const y = this.serie.priceToCoordinate(s.prix);
      if (x == null || y == null || x < 0 || x > largeur) continue;
      const texte = this.src.formater(s.prix);
      const l = c.measureText(texte).width + 6;
      if (s.haut ? x - dernierHaut < l : x - dernierBas < l) continue; // évite le chevauchement avec l'étiquette précédente du même côté
      if (s.haut) dernierHaut = x;
      else dernierBas = x;
      c.textBaseline = s.haut ? "bottom" : "top";
      const yTexte = s.haut ? y - 4 : y + 4;
      c.strokeText(texte, x, yTexte);
      c.fillText(texte, x, yTexte);
    }
    c.restore();
  }

  private etiquette(c: CanvasRenderingContext2D, texte: string, x: number, y: number, droite: boolean, coul: { texte: string; fond: string }) {
    c.setLineDash([]);
    const l = c.measureText(texte).width + 8;
    const gauche = droite ? x - l : x;
    c.fillStyle = coul.fond;
    c.globalAlpha = 0.85;
    c.fillRect(gauche, y - 8, l, 16);
    c.globalAlpha = 1;
    c.fillStyle = coul.texte;
    c.fillText(texte, gauche + 4, y);
  }

  private dessinerLigne(c: CanvasRenderingContext2D, d: Dessin, largeur: number, coul: { trait: string; texte: string; fond: string }) {
    const s = this.segment(d, largeur);
    if (!s) return;
    c.beginPath();
    c.moveTo(s.x1, s.y1);
    c.lineTo(s.x2, s.y2);
    c.stroke();
    if (d.type === "horizontale") {
      this.etiquette(c, this.src.formater(d.a.prix), largeur - 6, s.y1, true, coul);
      return;
    }
    // Points d'ancrage.
    c.setLineDash([]);
    const ancres: [number, number][] = [[s.x1, s.y1]];
    if (d.type !== "rayon") ancres.push([s.x2, s.y2]);
    for (const [x, y] of ancres) {
      c.beginPath();
      c.arc(x, y, 3.5, 0, Math.PI * 2);
      c.fillStyle = coul.fond;
      c.fill();
      c.stroke();
    }
  }

  private dessinerFibonacci(c: CanvasRenderingContext2D, d: Dessin, largeur: number, coul: { trait: string; texte: string; fond: string }) {
    if (!d.b) {
      // Premier clic : simple repère en attendant le second point.
      const x = this.x(d.a.temps);
      const y = this.y(d.a.prix);
      if (x != null && y != null) {
        c.beginPath();
        c.arc(x, y, 3.5, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }
    const x1 = this.x(d.a.temps);
    const x2 = this.x(d.b.temps);
    const yA = this.y(d.a.prix);
    const yB = this.y(d.b.prix);
    if (x1 == null || x2 == null || yA == null || yB == null) return;
    const gauche = Math.min(x1, x2);
    const ys = NIVEAUX_FIBONACCI.map((n) => this.y(prixFibonacci(d.a, d.b!, n)));
    // Bandes légères entre niveaux voisins, puis les lignes et leurs étiquettes.
    for (let i = 0; i < ys.length - 1; i++) {
      if (ys[i] == null || ys[i + 1] == null) continue;
      c.globalAlpha = 0.06;
      c.fillStyle = COULEURS_FIBO[i];
      c.fillRect(gauche, Math.min(ys[i]!, ys[i + 1]!), largeur - gauche, Math.abs(ys[i + 1]! - ys[i]!));
    }
    c.globalAlpha = 1;
    c.lineWidth = Math.min(c.lineWidth, 1.5);
    NIVEAUX_FIBONACCI.forEach((n, i) => {
      const y = ys[i];
      if (y == null) return;
      c.strokeStyle = COULEURS_FIBO[i];
      c.setLineDash(i === 0 || i === NIVEAUX_FIBONACCI.length - 1 ? [] : [5, 4]);
      c.beginPath();
      c.moveTo(gauche, y);
      c.lineTo(largeur, y);
      c.stroke();
      this.etiquette(c, `${n} · ${this.src.formater(prixFibonacci(d.a, d.b!, n))}`, gauche + 4, y - 9, false, coul);
    });
    // Diagonale du mouvement mesuré.
    c.strokeStyle = coul.trait;
    c.setLineDash([2, 4]);
    c.beginPath();
    c.moveTo(x1, yA);
    c.lineTo(x2, yB);
    c.stroke();
  }
}
