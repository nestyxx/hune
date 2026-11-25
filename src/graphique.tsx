import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { PERIODES_VARIATION, type Alerte } from "./alertes/moteur";
import { fournisseur } from "./donnees";
import { LIBELLE_PROFONDEUR, PROFONDEUR_DISPONIBLE, PROFONDEURS, type Profondeur } from "./donnees/historique";
import { INTERVALLES, LIBELLE_INTERVALLE, type Actif, type Bougie, type Intervalle } from "./donnees/types";
import { arrondirPrix, formaterPrix } from "./format";
import { heikinAshi } from "./indicateurs/heikinashi";
import { bollinger, ema, macd, rsi, sma, stochastique, type Serie } from "./indicateurs/indicateurs";
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
export const INDICATEURS_PAR_DEFAUT: Indicateurs = { volume: false, sma: false, ema: false, bollinger: false, rsi: false, macd: false, stoch: false };

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
}

interface Legende {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function Graphique({ actif, intervalle, surIntervalle, profondeur, surProfondeur, indicateurs, surIndicateurs, parametres, surParametres, typeGraphique, surTypeGraphique, surPrix, theme, alertes, echelleLog, surEchelleLog, signalRecentrer, surCreerAlerte }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
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
  const [legende, setLegende] = useState<Legende | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; prix: number } | null>(null);
  const [panneauParametres, setPanneauParametres] = useState(false);

  /** Remet l'échelle de temps et de prix en automatique (annule tout zoom ou déplacement manuel). */
  const recentrer = () => {
    graphique.current?.timeScale().fitContent();
    graphique.current?.priceScale("right").applyOptions({ autoScale: true });
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
    principale.current = creerSeriePrincipale(chart, typeRef.current);
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
        lignesAlertes.current.push(prin.createPriceLine({ ...style, price: c.seuil, title: `${marque} ${c.sens === "au-dessus" ? "≥" : "≤"}` }));
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
  useEffect(dessinerIndicateurs, [indicateurs, parametres, alertes]);

  // Menu du clic droit : niveau de prix sous le curseur.
  const ouvrirMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = conteneur.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hauteurPrix = graphique.current?.panes()[0]?.getHeight() ?? 0;
    const brut = principale.current?.coordinateToPrice(y);
    if (brut == null || y > hauteurPrix) return setMenu(null); // pas sur le panneau des prix
    setMenu({ x: e.clientX - rect.left, y, prix: arrondirPrix(brut) });
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
      <div className="relative min-h-0 flex-1" onContextMenu={ouvrirMenu} onDoubleClick={recentrer} onClick={() => setMenu(null)}>
        <div ref={conteneur} className="absolute inset-0" />
        {/* Commandes du graphique en surimpression (hors de la barre d'outils, qui reste aérée). */}
        <div className="absolute right-[76px] top-2 z-10 flex items-center gap-1.5" onDoubleClick={(e) => e.stopPropagation()}>
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
        {chargement && <div className="absolute left-4 top-8 text-doux">Chargement…</div>}
        {erreur && <div className="absolute left-4 top-8 rounded border border-baisse/50 bg-carte px-3 py-2 text-baisse">{erreur}</div>}
        {menu && (
          <div className="menu-contextuel absolute z-20 py-1 text-sm" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
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
