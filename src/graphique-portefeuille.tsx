import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { fournisseur } from "./donnees";
import type { Bougie } from "./donnees/types";
import { classePct, formaterMontant, formaterPct } from "./format";
import { PERIODES_PORTEFEUILLE, recupererBougies, specPeriode, valeurDansLeTemps, type EntreeHistorique, type PeriodePortefeuille } from "./historique-portefeuille";
import { versDevise, type DeviseAffichage } from "./portefeuille";
import { paletteGraphique, type ThemeResolu } from "./theme";

interface Props {
  /** Actifs détenus (déjà filtrés par plateforme), avec leurs lots. */
  entrees: EntreeHistorique[];
  /** Valeur en euros d'une unité de chaque devise. */
  taux: Record<string, number>;
  devise: DeviseAffichage;
  periode: PeriodePortefeuille;
  surPeriode: (p: PeriodePortefeuille) => void;
  theme: ThemeResolu;
}

/** Les bougies téléchargées sont gardées 5 minutes : changer de période ou de filtre ne refait pas tous les appels. */
const DUREE_CACHE_MS = 5 * 60_000;
const cache = new Map<string, { quand: number; bougies: Bougie[] }>();

/** Évolution de la valeur du portefeuille sur la période choisie, avec survol (valeur et variation depuis le début). */
export function GraphiquePortefeuille({ entrees, taux, devise, periode, surPeriode, theme }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const graphique = useRef<IChartApi | null>(null);
  const serie = useRef<ISeriesApi<"Area"> | null>(null);
  const [bougies, setBougies] = useState<Record<string, Bougie[]>>({});
  const [fin, setFin] = useState(() => Math.floor(Date.now() / 1000));
  const [chargement, setChargement] = useState(false);
  const [survol, setSurvol] = useState<{ temps: number; valeur: number } | null>(null);
  const spec = specPeriode(periode);

  const cles = useMemo(() => entrees.map((e) => e.cle).sort().join(","), [entrees]);

  // Téléchargement des bougies de chaque actif détenu (journalières ou horaires selon la période).
  useEffect(() => {
    if (!entrees.length) {
      setBougies({});
      return;
    }
    let annule = false;
    setChargement(true);
    void (async () => {
      const maintenant = Date.now();
      const resultat: Record<string, Bougie[]> = {};
      const manquants: EntreeHistorique[] = [];
      for (const e of entrees) {
        const memo = cache.get(`${e.cle}|${spec.intervalle}|${spec.profondeur}`);
        if (memo && maintenant - memo.quand < DUREE_CACHE_MS) resultat[e.cle] = memo.bougies;
        else manquants.push(e);
      }
      const recus = await recupererBougies(manquants, spec, (source, symbole, intervalle, profondeur) => fournisseur(source).bougies(symbole, intervalle, profondeur));
      for (const e of manquants) {
        if (recus[e.cle]) {
          resultat[e.cle] = recus[e.cle];
          cache.set(`${e.cle}|${spec.intervalle}|${spec.profondeur}`, { quand: Date.now(), bougies: recus[e.cle] });
        }
      }
      if (annule) return;
      setBougies(resultat);
      setFin(Math.floor(Date.now() / 1000));
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
    // `entrees` change d'identité à chaque rendu du parent : seule la liste des actifs et la période comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cles, periode]);

  const calcul = useMemo(() => valeurDansLeTemps(entrees, bougies, taux, spec.duree ? fin - spec.duree : null, fin), [entrees, bougies, taux, spec.duree, fin]);
  // Conversion vers la devise d'affichage (si le taux manque, le graphique reste vide plutôt que faux).
  const points = useMemo(
    () =>
      calcul.points.flatMap((p) => {
        const v = versDevise(p.valeurEur, devise, taux);
        return v == null ? [] : [{ temps: p.temps, valeur: v }];
      }),
    [calcul, devise, taux],
  );
  const premier = points[0]?.valeur;
  const dernier = points[points.length - 1]?.valeur;
  const affiche = survol ?? (points.length ? points[points.length - 1] : null);
  const variation = affiche && premier != null ? affiche.valeur - premier : null;
  const variationPct = variation != null && premier ? (variation / premier) * 100 : null;
  const monte = dernier == null || premier == null || dernier >= premier;

  // Création du graphique (une fois).
  useEffect(() => {
    const p = paletteGraphique();
    const chart = createChart(conteneur.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: p.fond }, textColor: p.texte },
      grid: { vertLines: { visible: false }, horzLines: { color: p.grille } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 0 },
    });
    graphique.current = chart;
    serie.current = chart.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    chart.subscribeCrosshairMove((param) => {
      const v = param.seriesData.get(serie.current!) as { value?: number } | undefined;
      setSurvol(param.time !== undefined && v?.value != null ? { temps: param.time as number, valeur: v.value } : null);
    });
    return () => {
      chart.remove();
      graphique.current = null;
      serie.current = null;
    };
  }, []);

  // Couleurs (thème, hausse ou baisse sur la période) et format des montants.
  useEffect(() => {
    const p = paletteGraphique();
    const c = monte ? p.hausse : p.baisse;
    graphique.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: p.fond }, textColor: p.texte },
      grid: { horzLines: { color: p.grille } },
      timeScale: { timeVisible: spec.intervalle === "1h" },
      localization: { priceFormatter: (v: number) => formaterMontant(v, devise, 0) },
    });
    serie.current?.applyOptions({ lineColor: c, topColor: c + "40", bottomColor: c + "04" });
  }, [theme, monte, devise, spec.intervalle]);

  // Données.
  useEffect(() => {
    serie.current?.setData(points.map((p) => ({ time: p.temps as UTCTimestamp, value: p.valeur })));
    graphique.current?.timeScale().fitContent();
  }, [points]);

  return (
    <div className="carte-info p-4">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-doux">Évolution de la valeur</div>
          <div className="titre-serif whitespace-nowrap text-[28px] leading-none">{affiche ? formaterMontant(affiche.valeur, devise, 0) : "—"}</div>
          <div className={`mt-1 text-xs ${classePct(variation)}`}>
            {variation != null ? `${variation >= 0 ? "+" : "−"}${formaterMontant(Math.abs(variation), devise, 0)} · ${formaterPct(variationPct)}` : "—"}
            <span className="ml-2 text-doux">
              {survol
                ? new Date(survol.temps * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", ...(spec.intervalle === "1h" ? { hour: "2-digit", minute: "2-digit" } : {}) })
                : `sur ${spec.id === "tout" ? "tout l'historique" : spec.libelle}`}
            </span>
          </div>
        </div>
        <div className="segments" role="group" aria-label="Période du graphique">
          {PERIODES_PORTEFEUILLE.map((s) => (
            <button key={s.id} aria-pressed={s.id === periode} className="segment" onClick={() => surPeriode(s.id)}>
              {s.libelle}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div ref={conteneur} className="h-[230px]" />
        {chargement && <div className="absolute left-2 top-2 text-xs text-doux">Chargement de l'historique…</div>}
        {!chargement && !points.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-doux">Pas assez de données pour tracer ce graphique.</div>}
      </div>
      {(calcul.ignores.length > 0 || calcul.quantitesSupposees) && (
        <p className="m-0 mt-2 text-xs text-doux">
          {calcul.quantitesSupposees && "Reconstitué à partir des quantités actuelles (les lots sans historique de transactions sont supposés détenus sur toute la période), au taux de change du jour. "}
          {calcul.ignores.length > 0 && (
            <span className="text-alerte">
              Non inclus (pas d'historique ou de taux) : {calcul.ignores.slice(0, 8).join(", ")}
              {calcul.ignores.length > 8 ? `… (+${calcul.ignores.length - 8})` : ""}.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
