import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { AlignJustify, ArrowUpRight, Eraser, MousePointer2, Minus, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PERIODES_VARIATION, type Alerte } from "./alertes/moteur";
import { fournisseur } from "./donnees";
import { LIBELLE_PROFONDEUR, PROFONDEUR_DISPONIBLE, PROFONDEURS, type Profondeur } from "./donnees/historique";
import { INTERVALLES, LIBELLE_INTERVALLE, SECONDES_INTERVALLE, type Actif, type Bougie, type Intervalle } from "./donnees/types";
import { LIBELLE_DESSIN, POINTS_REQUIS, tempsDepuisIndice, type Dessin, type PointDessin, type TypeDessin } from "./dessins";
import { CalqueDessins } from "./dessins-calque";
import { arrondirPrix, formaterPrix } from "./format";
import { heikinAshi } from "./indicateurs/heikinashi";
import { bollinger, ema, macd, rsi, sma, stochastique, type Serie } from "./indicateurs/indicateurs";
import type { NiveauxPortefeuille } from "./portefeuille";
import { paletteGraphique, type ThemeResolu } from "./theme";

/** Indicateurs activables. */
export interface Indicateurs {
  volume: boolean;
  sma: boolean;
  ema: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  stoch: boolean;
}
/** Vue par défaut : volume, SMA 20, EMA 50 et RSI 14 (le RSI s'affiche dans son propre panneau sous le prix). */
export const INDICATEURS_PAR_DEFAUT: Indicateurs = { volume: true, sma: true, ema: true, bollinger: false, rsi: true, macd: false, stoch: false };

/** Durée affichée à l'ouverture d'un graphique (et au recentrage), selon l'intervalle : 6 mois en journalier. */
const JOURS_VISIBLES: Record<Intervalle, number> = { "15m": 3, "1h": 14, "4h": 60, "1d": 183, "1w": 730, "1M": 1825 };

/** Périodes des indicateurs, modifiables (⚙). Les alertes RSI restent sur 14. */
export interface Parametres {
  sma: number;
  ema: number;
  bbPeriode: number;
  bbEcarts: number;
  rsi: number;
  macdRapide: number;
  macdLente: number;
  macdSignal: number;
  stochK: number;
  stochLissage: number;
  stochD: number;
}
export const PARAMETRES_PAR_DEFAUT: Parametres = { sma: 20, ema: 50, bbPeriode: 20, bbEcarts: 2, rsi: 14, macdRapide: 12, macdLente: 26, macdSignal: 9, stochK: 14, stochLissage: 3, stochD: 3 };

export type TypeGraphique = "bougies" | "heikin" | "ligne" | "aire";
const LIBELLE_TYPE: Record<TypeGraphique, string> = { bougies: "Bougies", heikin: "Heikin-Ashi", ligne: "Ligne", aire: "Aire" };

const CHAMPS_PARAMETRES: { cle: keyof Parametres; libelle: string; min: number; max: number }[] = [
  { cle: "sma", libelle: "SMA : période", min: 2, max: 400 },
  { cle: "ema", libelle: "EMA : période", min: 2, max: 400 },
  { cle: "bbPeriode", libelle: "Bollinger : période", min: 2, max: 400 },
  { cle: "bbEcarts", libelle: "Bollinger : écarts-types", min: 1, max: 5 },
  { cle: "rsi", libelle: "RSI : période", min: 2, max: 100 },
  { cle: "macdRapide", libelle: "MACD : rapide", min: 2, max: 200 },
  { cle: "macdLente", libelle: "MACD : lente", min: 3, max: 400 },
  { cle: "macdSignal", libelle: "MACD : signal", min: 2, max: 100 },
  { cle: "stochK", libelle: "Stoch. : %K", min: 2, max: 100 },
  { cle: "stochLissage", libelle: "Stoch. : lissage", min: 1, max: 20 },
  { cle: "stochD", libelle: "Stoch. : %D", min: 1, max: 20 },
];

/** Couleurs des indicateurs : choisies pour rester lisibles sur fond clair comme sur fond sombre. */
const COULEURS = { sma: "#2f81f7", ema: "#e08a00", bollinger: "#8e6bff", rsi: "#b44fd6", macd: "#2f81f7", signal: "#e08a00", stochK: "#2f81f7", stochD: "#e08a00" };

/** Convertit une série d'indicateur en points pour le graphique (les null d'amorçage sont écartés). */
function points(bougies: Bougie[], serie: Serie) {
  const sortie: { time: UTCTimestamp; value: number }[] = [];
  serie.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) sortie.push({ time: bougies[i].temps as UTCTimestamp, value: v });
  });
  return sortie;
}

/** Point de la série principale pour une bougie, selon le type de graphique (Heikin-Ashi : on passe la bougie déjà transformée). */
function pointPrincipal(type: TypeGraphique, b: Bougie) {
  const time = b.temps as UTCTimestamp;
  return type === "ligne" || type === "aire" ? { time, value: b.cloture } : { time, open: b.ouverture, high: b.haut, low: b.bas, close: b.cloture };
}

function creerSeriePrincipale(chart: IChartApi, type: TypeGraphique): ISeriesApi<SeriesType> {
  const p = paletteGraphique();
  if (type === "ligne") return chart.addSeries(LineSeries, { color: p.accent, lineWidth: 2 });
  if (type === "aire") return chart.addSeries(AreaSeries, { lineColor: p.accent, topColor: p.accent + "55", bottomColor: p.accent + "05", lineWidth: 2 });
  return chart.addSeries(CandlestickSeries, { upColor: p.hausse, downColor: p.baisse, wickUpColor: p.hausse, wickDownColor: p.baisse, borderVisible: false });
}

interface Props {
  actif: Actif;
  intervalle: Intervalle;
  surIntervalle: (i: Intervalle) => void;
  /** Profondeur d'historique (journalier et au-delà). */
  profondeur: Profondeur;
  surProfondeur: (p: Profondeur) => void;
  indicateurs: Indicateurs;
  surIndicateurs: (i: Indicateurs) => void;
  parametres: Parametres;
  surParametres: (p: Parametres) => void;
  typeGraphique: TypeGraphique;
  surTypeGraphique: (t: TypeGraphique) => void;
  /** Dernier prix reçu (flux ou rafraîchissement), pour l'en-tête. */
  surPrix: (prix: number) => void;
  theme: ThemeResolu;
  /** Alertes de cet actif (armées et déclenchées) : dessinées sur le graphique. */
  alertes: Alerte[];
  echelleLog: boolean;
  surEchelleLog: (v: boolean) => void;
  /** Incrémenté par l'application (raccourci R) pour recentrer le graphique. */
  signalRecentrer: number;
  /** Clic droit › créer une alerte de prix à ce niveau. */
  surCreerAlerte: (prix: number, sens: "au-dessus" | "en-dessous") => void;
  /** Alerte de prix déplacée à la souris : nouveau seuil (et sens, selon le côté du prix actuel) ; l'alerte est réarmée. */
  surDeplacerAlerte: (id: string, seuil: number, sens: "au-dessus" | "en-dessous") => void;
  /** Ouvre le formulaire de modification de l'alerte (onglet Alertes). */
  surEditerAlerte: (id: string) => void;
  surSupprimerAlerte: (id: string) => void;
  /** Achats, PAMP et objectif des positions détenues sur cet actif (null si l'actif n'est pas en portefeuille). */
  niveaux: NiveauxPortefeuille | null;
  lignesPortefeuille: boolean;
  surLignesPortefeuille: (v: boolean) => void;
  /** Tracés de l'utilisateur sur cet actif. */
  dessins: Dessin[];
  surDessins: (d: Dessin[]) => void;
}

type Outil = "curseur" | TypeDessin | "gomme";
const OUTILS: { id: TypeDessin; icone: typeof Minus; aide: string }[] = [
  { id: "horizontale", icone: Minus, aide: LIBELLE_DESSIN.horizontale + " : un clic" },
  { id: "tendance", icone: TrendingUp, aide: LIBELLE_DESSIN.tendance + " : deux clics (ou glisser)" },
  { id: "rayon", icone: ArrowUpRight, aide: LIBELLE_DESSIN.rayon + " : deux clics, prolongée vers la droite" },
  { id: "fibonacci", icone: AlignJustify, aide: LIBELLE_DESSIN.fibonacci + " : deux clics (départ, arrivée)" },
];

interface Legende {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function Graphique({ actif, intervalle, surIntervalle, profondeur, surProfondeur, indicateurs, surIndicateurs, parametres, surParametres, typeGraphique, surTypeGraphique, surPrix, theme, alertes, echelleLog, surEchelleLog, signalRecentrer, surCreerAlerte, surDeplacerAlerte, surEditerAlerte, surSupprimerAlerte, niveaux, lignesPortefeuille, surLignesPortefeuille, dessins, surDessins }: Props) {
  const enveloppe = useRef<HTMLDivElement>(null);
  const conteneur = useRef<HTMLDivElement>(null);
  const calque = useRef<CalqueDessins | null>(null);
  const marqueurs = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lignesPortefeuilleRef = useRef<IPriceLine[]>([]);
  /** Lignes d'alerte de prix par identifiant (pour les déplacer pendant un glissement). */
  const lignesAlertesParId = useRef(new Map<string, IPriceLine>());
  /** Alerte en cours de déplacement à la souris. */
  const glissement = useRef<{ id: string; prix: number; departY: number; bouge: boolean } | null>(null);
  const [outil, setOutil] = useState<Outil>("curseur");
  const [effacerTout, setEffacerTout] = useState(false);
  const outilRef = useRef(outil);
  outilRef.current = outil;
  /** Premier point d'un tracé à deux points, en attente du second. */
  const ancre = useRef<{ point: PointDessin; xDepart: number; yDepart: number; relache: boolean } | null>(null);
  const dessinsRef = useRef(dessins);
  dessinsRef.current = dessins;
  const niveauxRef = useRef(niveaux);
  niveauxRef.current = niveaux;
  const lignesRef = useRef(lignesPortefeuille);
  lignesRef.current = lignesPortefeuille;
  /** Rappels du parent, lisibles depuis les écouteurs natifs (créés une seule fois). */
  const rappels = useRef({ surDessins, surDeplacerAlerte, surEditerAlerte });
  rappels.current = { surDessins, surDeplacerAlerte, surEditerAlerte };
  const graphique = useRef<IChartApi | null>(null);
  const principale = useRef<ISeriesApi<SeriesType> | null>(null);
  const typePrincipale = useRef<TypeGraphique | null>(null);
  const serieIndicateurs = useRef<ISeriesApi<SeriesType>[]>([]);
  const lignesAlertes = useRef<IPriceLine[]>([]);
  const donnees = useRef<Bougie[]>([]);
  // Valeurs courantes lisibles depuis les callbacks du graphique (créés une seule fois).
  const indicRef = useRef(indicateurs);
  indicRef.current = indicateurs;
  const paramRef = useRef(parametres);
  paramRef.current = parametres;
  const alertesRef = useRef(alertes);
  alertesRef.current = alertes;
  const intervalleRef = useRef(intervalle);
  intervalleRef.current = intervalle;
  const typeRef = useRef(typeGraphique);
  typeRef.current = typeGraphique;
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  // Lus par l'écouteur de zoom (créé une seule fois) : toujours les valeurs courantes.
  const approfondir = useRef({ intervalle, profondeur, surProfondeur, chargement: false });
  approfondir.current = { intervalle, profondeur, surProfondeur, chargement };
  const [legende, setLegende] = useState<Legende | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; prix: number; dessinId: string | null; alerteId: string | null } | null>(null);
  const [panneauParametres, setPanneauParametres] = useState(false);

  /**
   * Remet l'échelle de temps et de prix en automatique (annule tout zoom ou déplacement manuel) sur la durée par défaut
   * de l'intervalle (6 mois en journalier) ; si l'historique chargé est plus court, tout est affiché.
   */
  const recentrer = () => {
    const chart = graphique.current;
    if (!chart) return;
    const n = donnees.current.length;
    const barres = Math.ceil((JOURS_VISIBLES[intervalleRef.current] * 86400) / SECONDES_INTERVALLE[intervalleRef.current]);
    if (n <= barres) chart.timeScale().fitContent();
    else chart.timeScale().setVisibleLogicalRange({ from: n - barres, to: n - 1 + 8 });
    chart.priceScale("right").applyOptions({ autoScale: true });
  };

  /** Instants des bougies chargées, mis en cache tant que la liste ne change pas (appelé à chaque rendu du calque). */
  const cacheTemps = useRef<{ cle: string; temps: number[] }>({ cle: "", temps: [] });
  const tempsBougies = () => {
    const d = donnees.current;
    const cle = `${d.length}:${d[0]?.temps}:${d[d.length - 1]?.temps}`;
    if (cacheTemps.current.cle !== cle) cacheTemps.current = { cle, temps: d.map((b) => b.temps) };
    return cacheTemps.current.temps;
  };

  /** Dernière bougie réelle, pour la légende quand le curseur n'est pas sur le graphique. */
  const derniereLegende = (): Legende | null => {
    const b = donnees.current[donnees.current.length - 1];
    return b ? { o: b.ouverture, h: b.haut, l: b.bas, c: b.cloture, v: b.volume } : null;
  };

  /** Pousse toutes les bougies dans la série principale (Heikin-Ashi : recalculé, chaque bougie dépend de la précédente). */
  const appliquerDonnees = () => {
    const type = typeRef.current;
    const source = type === "heikin" ? heikinAshi(donnees.current) : donnees.current;
    // Les données sont de la forme attendue par le type de série courant (garanti par `typePrincipale`).
    (principale.current as ISeriesApi<"Line">)?.setData(source.map((b) => pointPrincipal(type, b)) as never);
  };

  /** (Re)crée la série principale quand le type de graphique change : les lignes d'alerte disparaissent avec l'ancienne série. */
  const installerPrincipale = () => {
    const chart = graphique.current;
    if (!chart || typePrincipale.current === typeRef.current) return;
    if (principale.current) chart.removeSeries(principale.current);
    lignesAlertes.current = [];
    lignesPortefeuilleRef.current = [];
    lignesAlertesParId.current.clear();
    principale.current = creerSeriePrincipale(chart, typeRef.current);
    // Calque des tracés et marqueurs d'achat/vente : attachés à la série, ils disparaissent et se recréent avec elle.
    if (!calque.current) {
      calque.current = new CalqueDessins({
        temps: tempsBougies,
        pas: () => SECONDES_INTERVALLE[intervalleRef.current],
        couleurs: () => {
          const c = paletteGraphique();
          return { trait: c.accent, texte: c.texte, fond: c.fond };
        },
        formater: formaterPrix,
      });
    }
    calque.current.dessins = dessinsRef.current;
    principale.current.attachPrimitive(calque.current);
    marqueurs.current = createSeriesMarkers(principale.current, []);
    typePrincipale.current = typeRef.current; // l'échelle de prix (normale/log) appartient au graphique : elle survit au changement de série
  };

  // Création du graphique, une seule fois.
  useEffect(() => {
    const p = paletteGraphique();
    const chart = createChart(conteneur.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: p.fond }, textColor: p.texte, panes: { separatorColor: p.ligne } },
      grid: { vertLines: { color: p.grille }, horzLines: { color: p.grille } },
      rightPriceScale: { borderColor: p.ligne },
      timeScale: { borderColor: p.ligne, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    graphique.current = chart;
    installerPrincipale();
    // Légende OHLC (valeurs réelles, même en Heikin-Ashi) : suit le curseur, sinon dernière bougie.
    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined) return setLegende(derniereLegende());
      const b = donnees.current.find((x) => x.temps === (param.time as number));
      setLegende(b ? { o: b.ouverture, h: b.haut, l: b.bas, c: b.cloture, v: b.volume } : derniereLegende());
    });
    // Quand le panneau s'élargit (menu réduit, liste masquée…), la vue est réajustée si elle montrait déjà tout l'historique
    // depuis la première bougie : sans cela, un grand vide apparaîtrait à gauche. Un zoom de l'utilisateur est respecté.
    // Dézoomer au-delà de la première bougie (vide à gauche) = vouloir plus d'historique : on passe à la profondeur
    // suivante (Standard → 5 ans → Max). Seuls le journalier et au-delà le permettent ; en intraday les sources plafonnent.
    // Seul un geste de l'utilisateur (molette, glisser, pincer) compte : le rechargement des données fait aussi bouger la plage.
    let dernierGeste = 0;
    const geste = () => (dernierGeste = Date.now());
    const zone = conteneur.current!;
    // Phase de capture : la bibliothèque de graphiques peut arrêter la propagation des événements sur son canevas.
    for (const evt of ["wheel", "pointerdown", "touchmove", "mousedown"]) zone.addEventListener(evt, geste, { passive: true, capture: true });
    zone.addEventListener("pointermove", (e) => e.buttons && geste(), { passive: true, capture: true });
    chart.timeScale().subscribeVisibleLogicalRangeChange((plage) => {
      const a = approfondir.current;
      if (!plage || a.chargement || plage.from > -5 || Date.now() - dernierGeste > 1500 || !PROFONDEUR_DISPONIBLE.includes(a.intervalle)) return;
      const suivante = PROFONDEURS[PROFONDEURS.indexOf(a.profondeur) + 1];
      if (suivante) a.surProfondeur(suivante);
    });
    const observateur = new ResizeObserver(() => {
      const plage = chart.timeScale().getVisibleLogicalRange();
      if (plage && plage.from <= 0.5) chart.timeScale().fitContent();
    });
    observateur.observe(conteneur.current!);
    return () => {
      observateur.disconnect();
      chart.remove();
      graphique.current = null;
      principale.current = null;
      typePrincipale.current = null;
      calque.current = null;
      marqueurs.current = null;
    };
  }, []);

  // Changement de type de graphique : nouvelle série principale, mêmes données.
  useEffect(() => {
    installerPrincipale();
    appliquerDonnees();
    dessinerIndicateurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeGraphique]);

  // Thème : on réapplique les couleurs au graphique existant (et on recrée la série principale aux bonnes couleurs).
  useEffect(() => {
    const p = paletteGraphique();
    graphique.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: p.fond }, textColor: p.texte, panes: { separatorColor: p.ligne, enableResize: true } },
      grid: { vertLines: { color: p.grille }, horzLines: { color: p.grille } },
      rightPriceScale: { borderColor: p.ligne },
      timeScale: { borderColor: p.ligne },
    });
    typePrincipale.current = null; // force la recréation avec la palette du nouveau thème
    installerPrincipale();
    appliquerDonnees();
    dessinerIndicateurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Échelle logarithmique.
  useEffect(() => {
    graphique.current?.priceScale("right").applyOptions({ mode: echelleLog ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });
  }, [echelleLog]);

  // Raccourci « R » (ou bouton) : recentrage.
  useEffect(() => {
    if (signalRecentrer > 0) recentrer();
  }, [signalRecentrer]);

  /**
   * (Re)dessine indicateurs et alertes à partir des bougies courantes. Chaque oscillateur a son propre panneau.
   * Les lignes d'alerte sont recréées à chaque fois : c'est peu coûteux et ça évite tout état à synchroniser.
   */
  const dessinerIndicateurs = () => {
    const chart = graphique.current;
    const prin = principale.current;
    if (!chart || !prin) return;
    const p = paletteGraphique();
    const par = paramRef.current;

    for (const s of serieIndicateurs.current) chart.removeSeries(s);
    serieIndicateurs.current = [];
    for (const l of lignesAlertes.current) prin.removePriceLine(l);
    lignesAlertes.current = [];
    lignesAlertesParId.current.clear();
    for (const l of lignesPortefeuilleRef.current) prin.removePriceLine(l);
    lignesPortefeuilleRef.current = [];

    const b = donnees.current;
    if (!b.length) return;
    const cl = b.map((x) => x.cloture);
    const on = indicRef.current;
    const ajouter = <T extends SeriesType>(s: ISeriesApi<T>) => {
      serieIndicateurs.current.push(s);
      return s;
    };
    const ligne = (couleur: string, panneau = 0) =>
      ajouter(chart.addSeries(LineSeries, { color: couleur, lineWidth: 1, priceLineVisible: false, lastValueVisible: panneau > 0, crosshairMarkerVisible: false }, panneau));

    if (on.volume) {
      const v = ajouter(chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", priceLineVisible: false, lastValueVisible: false }));
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(b.map((x) => ({ time: x.temps as UTCTimestamp, value: x.volume, color: (x.cloture >= x.ouverture ? p.hausse : p.baisse) + "55" })));
    }
    if (on.sma) ligne(COULEURS.sma).setData(points(b, sma(cl, par.sma)));
    if (on.ema) ligne(COULEURS.ema).setData(points(b, ema(cl, par.ema)));
    if (on.bollinger) {
      const bb = bollinger(cl, par.bbPeriode, par.bbEcarts);
      for (const s of [bb.haut, bb.milieu, bb.bas]) ligne(COULEURS.bollinger).setData(points(b, s));
    }

    let panneau = 1;
    let serieRsi: ISeriesApi<"Line"> | null = null;
    if (on.rsi) {
      serieRsi = ligne(COULEURS.rsi, panneau++);
      serieRsi.setData(points(b, rsi(cl, par.rsi)));
      for (const niveau of [70, 30]) serieRsi.createPriceLine({ price: niveau, color: p.texte, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "" });
    }
    if (on.macd) {
      const m = macd(cl, par.macdRapide, par.macdLente, par.macdSignal);
      const histo = ajouter(chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, panneau));
      histo.setData(m.histogramme.flatMap((v, i) => (v == null ? [] : [{ time: b[i].temps as UTCTimestamp, value: v, color: (v >= 0 ? p.hausse : p.baisse) + "99" }])));
      ligne(COULEURS.macd, panneau).setData(points(b, m.macd));
      ligne(COULEURS.signal, panneau).setData(points(b, m.signal));
      panneau++;
    }
    if (on.stoch) {
      const s = stochastique(b.map((x) => x.haut), b.map((x) => x.bas), cl, par.stochK, par.stochLissage, par.stochD);
      const k = ligne(COULEURS.stochK, panneau);
      k.setData(points(b, s.k));
      ligne(COULEURS.stochD, panneau).setData(points(b, s.d));
      for (const niveau of [80, 20]) k.createPriceLine({ price: niveau, color: p.texte, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "" });
    }

    // --- Alertes dessinées sur le graphique ---
    const maintenant = Math.floor(Date.now() / 1000);
    for (const a of alertesRef.current) {
      const c = a.condition;
      const armee = a.statut === "armee";
      const style = { color: armee ? p.alerte : p.texte, lineWidth: 1 as const, lineStyle: armee ? LineStyle.Dashed : LineStyle.Dotted, axisLabelVisible: true };
      const marque = armee ? "🔔" : "✓";
      if (c.type === "prix") {
        // Pendant un glissement, la ligne reste là où la souris l'a posée même si un nouveau prix déclenche un redessin.
        const prix = glissement.current?.id === a.id ? glissement.current.prix : c.seuil;
        const ligneAlerte = prin.createPriceLine({ ...style, price: prix, title: `${marque} ${c.sens === "au-dessus" ? "≥" : "≤"}` });
        lignesAlertes.current.push(ligneAlerte);
        lignesAlertesParId.current.set(a.id, ligneAlerte);
      } else if (c.type === "variation" && armee) {
        // Niveau déclencheur ≈ ouverture de la bougie située à (maintenant − période) × (1 ± pct) ; il glisse avec le temps.
        const depart = maintenant - PERIODES_VARIATION[c.periode];
        const ref = [...b].reverse().find((x) => x.temps <= depart);
        if (ref) {
          const niveau = ref.ouverture * (1 + (c.sens === "hausse" ? 1 : -1) * (c.pct / 100));
          lignesAlertes.current.push(prin.createPriceLine({ ...style, price: niveau, title: `${marque} ${c.sens === "hausse" ? "+" : "−"}${c.pct} %/${c.periode} ≈` }));
        }
      } else if (c.type === "rsi" && serieRsi && c.intervalle === intervalleRef.current) {
        // Seuil RSI : tracé dans le panneau du RSI (même intervalle que le graphique).
        serieRsi.createPriceLine({ ...style, price: c.seuil, title: `${marque} ${c.sens === "au-dessus" ? "≥" : "≤"}` });
      }
    }
    // --- Portefeuille : PAMP, objectif, niveaux d'achat et repères d'achat/vente ---
    const niv = niveauxRef.current;
    const reperes: SeriesMarker<Time>[] = [];
    if (niv && lignesRef.current) {
      const niveau = (price: number, title: string, color: string, lineStyle: LineStyle) =>
        lignesPortefeuilleRef.current.push(prin.createPriceLine({ price, title, color, lineWidth: 1, lineStyle, axisLabelVisible: true }));
      if (niv.pamp != null) niveau(niv.pamp, "PAMP", p.accent, LineStyle.LargeDashed);
      if (niv.objectif != null) niveau(niv.objectif, "TP", p.hausse, LineStyle.LargeDashed);
      for (const a of niv.achats) niveau(a.prix, a.plateforme ? `Achat · ${a.plateforme}` : "Achat", p.texte, LineStyle.Dotted);
      // Chaque transaction est posée sur la bougie qui la contient (la dernière bougie ouverte avant l'instant de l'ordre).
      for (const m of niv.mouvements) {
        const t = m.date / 1000;
        if (t < b[0].temps) continue;
        let bas = 0;
        let haut = b.length - 1;
        while (bas < haut) {
          const milieu = (bas + haut + 1) >> 1;
          if (b[milieu].temps <= t) bas = milieu;
          else haut = milieu - 1;
        }
        const achat = m.sens === "achat";
        reperes.push({ time: b[bas].temps as UTCTimestamp, position: achat ? "belowBar" : "aboveBar", shape: achat ? "arrowUp" : "arrowDown", color: achat ? p.hausse : p.baisse, text: `${achat ? "Achat" : "Vente"} ${formaterPrix(m.prix)}` });
      }
    }
    marqueurs.current?.setMarkers(reperes);
    // Le prix garde la plus grande part de la hauteur.
    chart.panes().forEach((pn, i) => pn.setStretchFactor(i === 0 ? 3 : 1));
  };

  // Chargement de l'historique + flux temps réel (ou rafraîchissement périodique si la source n'a pas de flux).
  useEffect(() => {
    const f = fournisseur(actif.source);
    let annule = false;
    let arret: (() => void) | undefined;
    let minuterie: ReturnType<typeof setInterval> | undefined;

    const charger = async (premiere: boolean) => {
      if (premiere) setChargement(true);
      try {
        const b = await f.bougies(actif.symbole, intervalle, profondeur);
        if (annule) return;
        donnees.current = b;
        appliquerDonnees();
        dessinerIndicateurs();
        if (premiere) recentrer();
        if (b.length) surPrix(b[b.length - 1].cloture);
        setLegende(derniereLegende());
        setErreur(b.length ? null : "Aucune donnée pour cet actif / cet intervalle.");
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      } finally {
        if (!annule && premiere) setChargement(false);
      }
    };

    donnees.current = [];
    appliquerDonnees();
    dessinerIndicateurs();
    void charger(true).then(() => {
      if (annule) return;
      if (f.abonner) {
        arret = f.abonner(actif.symbole, intervalle, (nouvelle) => {
          const d = donnees.current;
          const derniere = d[d.length - 1];
          if (derniere && nouvelle.temps === derniere.temps) d[d.length - 1] = nouvelle;
          else if (!derniere || nouvelle.temps > derniere.temps) d.push(nouvelle);
          else return;
          // Heikin-Ashi : la dernière bougie dépend des précédentes, on repousse tout ; sinon simple mise à jour.
          if (typeRef.current === "heikin") appliquerDonnees();
          else (principale.current as ISeriesApi<"Line">)?.update(pointPrincipal(typeRef.current, nouvelle) as never);
          dessinerIndicateurs();
          surPrix(nouvelle.cloture);
        });
      } else {
        minuterie = setInterval(() => void charger(false), 60_000);
      }
    });

    return () => {
      annule = true;
      arret?.();
      clearInterval(minuterie);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif.source, actif.symbole, intervalle, profondeur]);

  // Indicateur activé/désactivé ou paramétré, alerte créée/déclenchée : on redessine sans recharger les données.
  useEffect(dessinerIndicateurs, [indicateurs, parametres, alertes, niveaux, lignesPortefeuille]);

  // Tracés de l'utilisateur : le calque les redessine dès qu'ils changent.
  useEffect(() => {
    if (!calque.current) return;
    calque.current.dessins = dessins;
    calque.current.actualiser();
  }, [dessins]);

  /** Zone des prix en pixels (hors échelles de prix et de temps) et position du conteneur. */
  const zonePrix = () => {
    const ch = graphique.current;
    const r = conteneur.current!.getBoundingClientRect();
    return { r, largeur: r.width - (ch?.priceScale("right").width() ?? 0), hauteur: ch?.panes()[0]?.getHeight() ?? 0 };
  };

  /** Point (instant, prix) sous la souris ; l'instant est calé sur une bougie, y compris dans le vide à droite ou à gauche. */
  const ancrage = (x: number, y: number): PointDessin | null => {
    const logique = graphique.current?.timeScale().coordinateToLogical(x);
    const prix = principale.current?.coordinateToPrice(y);
    if (logique == null || prix == null) return null;
    return { temps: tempsDepuisIndice(tempsBougies(), Math.round(logique), SECONDES_INTERVALLE[intervalleRef.current]), prix };
  };

  /** Alerte de prix dont la ligne passe à moins de 6 px de la hauteur y. */
  const alerteSous = (y: number): Alerte | null => {
    for (const a of alertesRef.current) {
      if (a.condition.type !== "prix") continue;
      const ligneY = principale.current?.priceToCoordinate(a.condition.seuil);
      if (ligneY != null && Math.abs(ligneY - y) <= 6) return a;
    }
    return null;
  };

  // Interactions : tracés, glisser une alerte, double-clic pour la modifier. Écouteurs natifs en phase de capture : ils passent
  // avant ceux du graphique, ce qui permet d'empêcher le défilement du graphique quand le clic est pour nous.
  useEffect(() => {
    const zone = enveloppe.current!;
    const local = (e: MouseEvent) => {
      const { r } = zonePrix();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const dansPrix = (x: number, y: number) => {
      const z = zonePrix();
      return x >= 0 && x <= z.largeur && y >= 0 && y <= z.hauteur;
    };
    const surimpression = (e: Event) => (e.target as Element | null)?.closest("[data-surimpression]") != null;
    let bloque = false; // le « pointerdown » a été pris en charge : la souris/le toucher qui suit ne doit pas non plus atteindre le graphique

    const finir = () => {
      ancre.current = null;
      if (calque.current) {
        calque.current.brouillon = null;
        calque.current.actualiser();
      }
      setOutil("curseur");
    };
    const poser = (type: TypeDessin, a: PointDessin, b?: PointDessin) => {
      rappels.current.surDessins([...dessinsRef.current, { id: crypto.randomUUID(), type, a, ...(b ? { b } : {}) }]);
      finir();
    };

    const bas = (e: PointerEvent) => {
      bloque = false;
      if (e.button !== 0 || surimpression(e)) return;
      const { x, y } = local(e);
      if (!dansPrix(x, y)) return;
      const o = outilRef.current;
      if (o === "gomme") {
        bloque = true;
        e.stopPropagation();
        const id = calque.current?.toucher(x, y, zonePrix().largeur);
        if (id) rappels.current.surDessins(dessinsRef.current.filter((d) => d.id !== id));
        return;
      }
      if (o !== "curseur") {
        bloque = true;
        e.stopPropagation();
        const pt = ancrage(x, y);
        if (!pt) return;
        if (POINTS_REQUIS[o] === 1) return poser(o, pt);
        if (!ancre.current) ancre.current = { point: pt, xDepart: x, yDepart: y, relache: false };
        else poser(o, ancre.current.point, pt);
        return;
      }
      const a = alerteSous(y);
      if (a && a.condition.type === "prix") {
        bloque = true;
        e.stopPropagation();
        glissement.current = { id: a.id, prix: a.condition.seuil, departY: y, bouge: false };
      }
    };

    const bouge = (e: PointerEvent) => {
      const { x, y } = local(e);
      const g = glissement.current;
      if (g) {
        if (Math.abs(y - g.departY) > 3) g.bouge = true;
        const prix = g.bouge ? principale.current?.coordinateToPrice(y) : null;
        if (prix != null && prix > 0) {
          g.prix = prix;
          lignesAlertesParId.current.get(g.id)?.applyOptions({ price: prix });
        }
        return;
      }
      const o = outilRef.current;
      const dans = dansPrix(x, y) && !surimpression(e);
      if (ancre.current && dans && o !== "curseur" && o !== "gomme") {
        const pt = ancrage(x, y);
        if (pt && calque.current) {
          calque.current.brouillon = { id: "brouillon", type: o, a: ancre.current.point, b: pt };
          calque.current.actualiser();
        }
      }
      if (o === "gomme") {
        const id = dans ? (calque.current?.toucher(x, y, zonePrix().largeur) ?? null) : null;
        if (calque.current && calque.current.survol !== id) {
          calque.current.survol = id;
          calque.current.actualiser();
        }
        zone.style.cursor = id ? "pointer" : "";
      } else if (o !== "curseur") zone.style.cursor = dans ? "crosshair" : "";
      else zone.style.cursor = dans && alerteSous(y) ? "ns-resize" : "";
    };

    const haut = (e: PointerEvent) => {
      const g = glissement.current;
      if (g) {
        glissement.current = null;
        if (g.bouge) {
          const dernier = donnees.current[donnees.current.length - 1]?.cloture;
          const prix = arrondirPrix(g.prix);
          rappels.current.surDeplacerAlerte(g.id, prix, dernier != null && prix < dernier ? "en-dessous" : "au-dessus");
        }
      }
      const an = ancre.current;
      if (an && !an.relache) {
        // Glisser-déposer : si la souris a bougé entre l'appui et le relâchement, le tracé est terminé ; sinon il attend le second clic.
        an.relache = true;
        const { x, y } = local(e);
        const o = outilRef.current;
        if (Math.hypot(x - an.xDepart, y - an.yDepart) > 8 && o !== "curseur" && o !== "gomme") {
          const pt = ancrage(x, y);
          if (pt) poser(o, an.point, pt);
        }
      }
      setTimeout(() => (bloque = false), 0);
    };

    const arreter = (e: Event) => {
      if (bloque) e.stopPropagation();
    };
    const doubleClic = (e: MouseEvent) => {
      if (surimpression(e)) return;
      const { x, y } = local(e);
      if (!dansPrix(x, y)) return;
      if (outilRef.current !== "curseur") return e.stopPropagation(); // pas de recentrage pendant un tracé
      const a = alerteSous(y);
      if (a) {
        e.stopPropagation();
        rappels.current.surEditerAlerte(a.id);
      }
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (glissement.current) {
        glissement.current = null;
        dessinerIndicateurs(); // la ligne revient à son seuil d'origine
      }
      if (ancre.current || outilRef.current !== "curseur") finir();
    };

    zone.addEventListener("pointerdown", bas, true);
    zone.addEventListener("mousedown", arreter, true);
    zone.addEventListener("touchstart", arreter, { capture: true, passive: true });
    zone.addEventListener("dblclick", doubleClic, true);
    window.addEventListener("pointermove", bouge);
    window.addEventListener("pointerup", haut);
    window.addEventListener("keydown", touche);
    return () => {
      zone.removeEventListener("pointerdown", bas, true);
      zone.removeEventListener("mousedown", arreter, true);
      zone.removeEventListener("touchstart", arreter, true);
      zone.removeEventListener("dblclick", doubleClic, true);
      window.removeEventListener("pointermove", bouge);
      window.removeEventListener("pointerup", haut);
      window.removeEventListener("keydown", touche);
    };
    // Écouteurs posés une fois : ils ne lisent que des refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changer d'actif ou d'intervalle abandonne un tracé commencé.
  useEffect(() => {
    ancre.current = null;
    if (calque.current) {
      calque.current.brouillon = null;
      calque.current.survol = null;
      calque.current.actualiser();
    }
    setOutil("curseur");
  }, [actif.source, actif.symbole]);

  // Confirmation d'« Effacer tout » : retombe seule au bout de 4 s.
  useEffect(() => {
    if (!effacerTout) return;
    const t = setTimeout(() => setEffacerTout(false), 4000);
    return () => clearTimeout(t);
  }, [effacerTout]);

  // Menu du clic droit : niveau de prix sous le curseur (et tracé ou alerte éventuellement sous la souris).
  const ouvrirMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = conteneur.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hauteurPrix = graphique.current?.panes()[0]?.getHeight() ?? 0;
    const brut = principale.current?.coordinateToPrice(y);
    if (brut == null || y > hauteurPrix) return setMenu(null); // pas sur le panneau des prix
    setMenu({ x, y, prix: arrondirPrix(brut), dessinId: calque.current?.toucher(x, y, zonePrix().largeur) ?? null, alerteId: alerteSous(y)?.id ?? null });
  };

  const dernierPrix = donnees.current[donnees.current.length - 1]?.cloture;
  const libelles: Record<keyof Indicateurs, string> = {
    volume: "Volume",
    sma: `SMA ${parametres.sma}`,
    ema: `EMA ${parametres.ema}`,
    bollinger: `Bollinger ${parametres.bbPeriode}·${parametres.bbEcarts}`,
    rsi: `RSI ${parametres.rsi}`,
    macd: `MACD ${parametres.macdRapide}·${parametres.macdLente}·${parametres.macdSignal}`,
    stoch: `Stoch. ${parametres.stochK}·${parametres.stochLissage}·${parametres.stochD}`,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-ligne px-6 py-2.5">
        <div className="segments" role="group" aria-label="Intervalle">
          {INTERVALLES.map((i, n) => (
            <button key={i} title={`Raccourci : ${n + 1}`} aria-pressed={i === intervalle} className="segment" onClick={() => surIntervalle(i)}>
              {LIBELLE_INTERVALLE[i]}
            </button>
          ))}
        </div>
        {PROFONDEUR_DISPONIBLE.includes(intervalle) && (
          <div className="segments" role="group" aria-label="Profondeur de l'historique" title="Profondeur de l'historique">
            {PROFONDEURS.map((p) => (
              <button key={p} aria-pressed={p === profondeur} className="segment" onClick={() => surProfondeur(p)}>
                {LIBELLE_PROFONDEUR[p]}
              </button>
            ))}
          </div>
        )}
        <div className="segments" role="group" aria-label="Type de graphique">
          {(Object.keys(LIBELLE_TYPE) as TypeGraphique[]).map((t) => (
            <button key={t} aria-pressed={t === typeGraphique} className="segment" onClick={() => surTypeGraphique(t)}>
              {LIBELLE_TYPE[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(libelles) as (keyof Indicateurs)[]).map((k) => (
            <button key={k} aria-pressed={indicateurs[k]} className="puce" onClick={() => surIndicateurs({ ...indicateurs, [k]: !indicateurs[k] })}>
              {libelles[k]}
            </button>
          ))}
          <button className="puce" aria-pressed={panneauParametres} title="Périodes des indicateurs" aria-label="Paramètres des indicateurs" onClick={() => setPanneauParametres(!panneauParametres)}>
            ⚙
          </button>
        </div>

        {panneauParametres && (
          <div className="menu-contextuel absolute left-4 top-full z-30 mt-1 w-[min(560px,92%)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <b>Paramètres des indicateurs</b>
              <button className="bouton !py-0.5 text-xs" onClick={() => surParametres(PARAMETRES_PAR_DEFAUT)}>
                Valeurs par défaut
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {CHAMPS_PARAMETRES.map(({ cle, libelle, min, max }) => (
                <label key={cle} className="flex items-center justify-between gap-2 text-xs text-doux">
                  {libelle}
                  <input
                    key={`${cle}-${parametres[cle]}`}
                    type="number"
                    min={min}
                    max={max}
                    defaultValue={parametres[cle]}
                    className="champ w-16 !py-0.5 text-right"
                    onBlur={(e) => {
                      const n = Math.round(Number(e.target.value));
                      // Valeur hors bornes ou illisible : on revient à la précédente (le champ se réaffiche via sa clé).
                      if (Number.isFinite(n) && n >= min && n <= max && n !== parametres[cle]) surParametres({ ...parametres, [cle]: n });
                      else e.target.value = String(parametres[cle]);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </label>
              ))}
            </div>
            <p className="m-0 mt-2 text-xs text-doux">Les alertes RSI utilisent toujours RSI 14, quel que soit le réglage du graphique.</p>
          </div>
        )}
      </div>
      <div ref={enveloppe} className="relative min-h-0 flex-1" onContextMenu={ouvrirMenu} onDoubleClick={recentrer} onClick={() => setMenu(null)}>
        <div ref={conteneur} className="absolute inset-0" />
        {/* Outils de tracé, à gauche (un tracé terminé rend la main au curseur). */}
        <div data-surimpression className="absolute left-2 top-10 z-10 flex flex-col gap-1" onDoubleClick={(e) => e.stopPropagation()}>
          <button className="puce !px-2" aria-pressed={outil === "curseur"} title="Curseur (Échap)" aria-label="Curseur" onClick={() => setOutil("curseur")}>
            <MousePointer2 size={14} />
          </button>
          {OUTILS.map(({ id, icone: Icone, aide }) => (
            <button key={id} className="puce !px-2" aria-pressed={outil === id} title={aide} aria-label={LIBELLE_DESSIN[id]} onClick={() => setOutil(outil === id ? "curseur" : id)}>
              <Icone size={14} />
            </button>
          ))}
          <button className="puce !px-2" aria-pressed={outil === "gomme"} title="Gomme : cliquez sur un tracé pour le supprimer" aria-label="Gomme" onClick={() => setOutil(outil === "gomme" ? "curseur" : "gomme")}>
            <Eraser size={14} />
          </button>
          {dessins.length > 0 && (
            <button
              className={`puce !px-2 ${effacerTout ? "!border-baisse !text-baisse" : ""}`}
              title={effacerTout ? "Cliquez encore pour tout effacer" : "Effacer tous les tracés de cet actif"}
              aria-label="Effacer tous les tracés"
              onClick={() => {
                if (effacerTout) {
                  surDessins([]);
                  setEffacerTout(false);
                } else setEffacerTout(true);
              }}
            >
              <Trash2 size={14} />
              {effacerTout && <span className="ml-1 text-xs">Tout effacer ?</span>}
            </button>
          )}
        </div>
        {outil !== "curseur" && (
          <div className="pointer-events-none absolute left-1/2 top-10 z-10 -translate-x-1/2 rounded-full border border-ligne bg-carte px-3 py-1 text-xs text-doux shadow-sm">
            {outil === "gomme" ? "Cliquez sur un tracé pour le supprimer" : OUTILS.find((o) => o.id === outil)?.aide} · Échap pour {outil === "gomme" ? "terminer" : "annuler"}
          </div>
        )}
        {/* Commandes du graphique en surimpression (hors de la barre d'outils, qui reste aérée). */}
        <div data-surimpression className="absolute right-[76px] top-2 z-10 flex items-center gap-1.5" onDoubleClick={(e) => e.stopPropagation()}>
          {niveaux && (
            <button aria-pressed={lignesPortefeuille} title="Afficher le PAMP, l'objectif (TP) et les achats/ventes de votre portefeuille" className="puce" onClick={() => surLignesPortefeuille(!lignesPortefeuille)}>
              Portefeuille
            </button>
          )}
          <button aria-pressed={echelleLog} title="Échelle logarithmique" className="puce" onClick={() => surEchelleLog(!echelleLog)}>
            Log
          </button>
          <button className="bouton !rounded-full !py-[3px]" title="Recentrer le graphique (R, ou double-clic)" onClick={recentrer}>
            ⤢ Recentrer
          </button>
        </div>
        {legende && (
          <div className="pointer-events-none absolute left-3 top-2 z-10 flex gap-3 font-mono text-xs text-doux">
            <span>O <b className="font-normal text-texte">{formaterPrix(legende.o)}</b></span>
            <span>H <b className="font-normal text-texte">{formaterPrix(legende.h)}</b></span>
            <span>B <b className="font-normal text-texte">{formaterPrix(legende.l)}</b></span>
            <span>C <b className={`font-normal ${legende.c >= legende.o ? "text-hausse" : "text-baisse"}`}>{formaterPrix(legende.c)}</b></span>
            <span className={legende.c >= legende.o ? "text-hausse" : "text-baisse"}>{legende.o ? `${legende.c >= legende.o ? "+" : ""}${(((legende.c - legende.o) / legende.o) * 100).toFixed(2).replace(".", ",")} %` : ""}</span>
            {legende.v > 0 && <span>Vol <b className="font-normal text-texte">{legende.v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</b></span>}
          </div>
        )}
        {chargement && <div className="absolute left-14 top-8 text-doux">Chargement…</div>}
        {erreur && <div className="absolute left-14 top-8 rounded border border-baisse/50 bg-carte px-3 py-2 text-baisse">{erreur}</div>}
        {menu && (
          <div className="menu-contextuel absolute z-20 py-1 text-sm" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            {menu.alerteId && (
              <>
                <button
                  className="block w-full whitespace-nowrap bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
                  onClick={() => {
                    surEditerAlerte(menu.alerteId!);
                    setMenu(null);
                  }}
                >
                  ✎ Modifier cette alerte
                </button>
                <button
                  className="block w-full whitespace-nowrap bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
                  onClick={() => {
                    surSupprimerAlerte(menu.alerteId!);
                    setMenu(null);
                  }}
                >
                  🗑 Supprimer cette alerte
                </button>
              </>
            )}
            {menu.dessinId && (
              <button
                className="block w-full whitespace-nowrap bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
                onClick={() => {
                  surDessins(dessins.filter((d) => d.id !== menu.dessinId));
                  setMenu(null);
                }}
              >
                🗑 Supprimer ce tracé
              </button>
            )}
            {(menu.alerteId || menu.dessinId) && <div className="my-1 border-t border-ligne" />}
            <button
              className="block w-full whitespace-nowrap bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
              onClick={() => {
                surCreerAlerte(menu.prix, dernierPrix != null && menu.prix < dernierPrix ? "en-dessous" : "au-dessus");
                setMenu(null);
              }}
            >
              🔔 Alerter si le prix {dernierPrix != null && menu.prix < dernierPrix ? "≤" : "≥"} {formaterPrix(menu.prix)}
            </button>
            <button
              className="block w-full bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
              onClick={() => {
                recentrer();
                setMenu(null);
              }}
            >
              ⤢ Recentrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
