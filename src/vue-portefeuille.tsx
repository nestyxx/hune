import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, ChevronUp, Download, Plus, Upload, X } from "lucide-react";
import { GraphiquePortefeuille } from "./graphique-portefeuille";
import type { EntreeHistorique, PeriodePortefeuille } from "./historique-portefeuille";
import { IconeActif } from "./icone-actif";
import { ImportTransactions } from "./import-transactions-panneau";
import type { ThemeResolu } from "./theme";
import { categorieDe } from "./categories";
import { EnTete } from "./composants";
import { fournisseur } from "./donnees";
import { tauxVersEur } from "./donnees/change";
import { cleActif, type Actif, type Cotation } from "./donnees/types";
import { classePct, formaterMontant, formaterPct, formaterPrix } from "./format";
import { segmentsDonut } from "./donut";
import { csvPositions, csvTransactions } from "./export-csv";
import { telecharger } from "./sauvegarde";
import { agreger, convertirSaisie, devisesDeSaisie, extremesPerformance, gainsRealises as gainsRealisesDe, gainsRealisesTotal, repartition, SYMBOLE_DEVISE, totaux, valeurLotEur, variationPortefeuille, versDevise, type ColonnePortefeuille, type DeviseAffichage, type LignePortefeuille, type PartRepartition, type Position, type TriPortefeuille } from "./portefeuille";

interface Props {
  actifs: Actif[];
  categories: string[];
  cotations: Record<string, Cotation>;
  /** Devise d'affichage (€ ou $) et sa mémorisation. */
  devise: DeviseAffichage;
  surDevise: (d: DeviseAffichage) => void;
  /** Tri du tableau et sa mémorisation. */
  tri: TriPortefeuille;
  surTri: (t: TriPortefeuille) => void;
  /** Période du graphique de valeur et sa mémorisation. */
  periode: PeriodePortefeuille;
  surPeriode: (p: PeriodePortefeuille) => void;
  theme: ThemeResolu;
  positions: Position[];
  surPositions: (modifier: (l: Position[]) => Position[]) => void;
  /** Ajoute des actifs à la watchlist (ceux qui y sont déjà sont ignorés). */
  surAjouterActifs: (nouveaux: Actif[]) => void;
  surOuvrir: (cle: string) => void;
  /** Crée des alertes de prix aux objectifs fournis ; renvoie le nombre réellement créé (hors doublons). */
  surAlertesObjectifs: (objectifs: { actif: Actif; prix: number }[]) => number;
  /** Alertes de prix « au-dessus » déjà armées, pour ne pas créer de doublons. */
  alertesExistantes: { cle: string; seuil: number }[];
}

type Colonne = ColonnePortefeuille;

/** Formateur de montants fourni aux sous-composants : prend un montant en euros, l'affiche dans la devise choisie. */
type Montant = (valeurEur: number | null, decimales?: number) => string;
const quantite = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: q >= 1000 ? 0 : q >= 1 ? 4 : 8 });
const pourcent = (p: number | null) => (p == null ? "—" : `${(p * 100).toFixed(1).replace(".", ",")} %`);

/** Nombre saisi (virgule acceptée) ; chaîne vide = pas de valeur ; null si invalide. */
function lireNombre(s: string): number | undefined | null {
  if (!s.trim()) return undefined;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Camembert (anneau) de répartition avec légende : nom, part et montant de chaque tranche. */
function BarreRepartition({ titre, parts, m }: { titre: string; parts: PartRepartition[]; m: Montant }) {
  const couleurs = ["#2f81f7", "#26a69a", "#e08a00", "#8e6bff", "#d3569a", "#6ca6c1", "#9aa75b", "#c2674a"];
  if (!parts.length) return null;
  const rayon = 40;
  const circonference = 2 * Math.PI * rayon;
  const segments = segmentsDonut(parts.map((p) => p.valeurEur), circonference);
  return (
    <div className="carte-info p-4">
      <div className="mb-2 text-xs text-doux">{titre}</div>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 100 100" width="108" height="108" className="shrink-0 -rotate-90" role="img" aria-label={titre}>
          <circle cx="50" cy="50" r={rayon} fill="none" strokeWidth="16" className="stroke-fond" />
          {parts.map((p, i) => (
            <circle key={p.nom} cx="50" cy="50" r={rayon} fill="none" strokeWidth="16" stroke={couleurs[i % couleurs.length]} strokeDasharray={`${segments[i].longueur} ${circonference}`} strokeDashoffset={segments[i].decalage}>
              <title>{`${p.nom} : ${m(p.valeurEur)} (${pourcent(p.part)})`}</title>
            </circle>
          ))}
        </svg>
        <ul className="m-0 grid min-w-0 flex-1 list-none gap-x-4 gap-y-1 p-0 text-xs sm:grid-cols-2">
          {parts.map((p, i) => (
            <li key={p.nom} className="flex min-w-0 items-center gap-1.5" title={`${p.nom} : ${m(p.valeurEur)}`}>
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: couleurs[i % couleurs.length] }} />
              <span className="min-w-0 flex-1 truncate">{p.nom}</span>
              <span className="shrink-0 font-mono text-doux">{pourcent(p.part)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Champ numérique d'un lot : validé à la sortie du champ (Entrée ou perte du focus). */
function ChampLot({ valeur, surChangement, placeholder, large = "w-28", forcer = false }: { valeur: number | undefined; surChangement: (v: number | undefined) => void; placeholder: string; large?: string; forcer?: boolean }) {
  const [invalide, setInvalide] = useState(false);
  return (
    <input
      key={valeur ?? "vide"}
      defaultValue={valeur ?? ""}
      placeholder={placeholder}
      inputMode="decimal"
      className={`champ ${large} !py-1 text-xs ${invalide ? "!border-baisse" : ""}`}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => {
        const n = lireNombre(e.target.value);
        setInvalide(n === null);
        if (n !== null && (n !== valeur || forcer)) surChangement(n);
      }}
    />
  );
}

/**
 * Champ de prix d'un lot (PAMP, objectif) avec choix de la devise d'affichage et de saisie.
 * Changer de devise convertit aussitôt la valeur affichée (au taux du jour) ; ce qu'on tape ensuite est converti en retour
 * et enregistré dans la devise de cotation de l'actif. Le choix de devise lui-même n'enregistre rien : c'est un affichage.
 */
function ChampLotPrix({ valeur, surChangement, placeholder, devise, taux }: { valeur: number | undefined; surChangement: (v: number | undefined) => void; placeholder: string; devise: string | null | undefined; taux: Record<string, number> }) {
  const options = devisesDeSaisie(devise, taux);
  const [choix, setChoix] = useState<string | undefined>(undefined);
  const courante = (choix && options.includes(choix) ? choix : devise) ?? undefined;
  const affiche = valeur == null ? undefined : courante === devise ? valeur : Number(convertirSaisie(valeur, devise ?? undefined, courante, taux).toPrecision(6));
  return (
    <span className="inline-flex items-center gap-1">
      <ChampLot
        valeur={affiche}
        placeholder={placeholder}
        surChangement={(v) => surChangement(v === undefined ? v : convertirSaisie(v, courante, devise, taux))}
      />
      {options.length > 1 ? (
        <select className="champ !w-auto !py-1 !pl-1 !pr-0 text-xs" value={courante} title={`Devise d'affichage de ce prix (conversion au taux du jour). Il reste enregistré en ${devise}.`} onChange={(e) => setChoix(e.target.value)}>
          {options.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      ) : (
        devise && <span className="text-doux">{devise}</span>
      )}
    </span>
  );
}

/** Portefeuille d'un seul coup d'œil ou d'une seule plateforme (positions sans plateforme : « Non précisée »). */
const SANS_PLATEFORME = "Non précisée";

export function VuePortefeuille({ actifs, categories, cotations, devise, surDevise, tri, surTri, periode, surPeriode, theme, positions: toutesPositions, surPositions, surAjouterActifs, surOuvrir, surAlertesObjectifs, alertesExistantes }: Props) {
  const choixCsv = useRef<HTMLInputElement>(null);
  const [plateformeFiltre, setPlateformeFiltre] = useState<string | null>(null);
  const [vue, setVue] = useState<"actifs" | "transactions">("actifs");
  const [fichierCsv, setFichierCsv] = useState<File | null>(null);
  const [devises, setDevises] = useState<Record<string, string>>({});
  const [taux, setTaux] = useState<Record<string, number>>({ EUR: 1 });
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  const [confirmationTp, setConfirmationTp] = useState<{ actif: Actif; prix: number }[] | null>(null);
  const [formulaire, setFormulaire] = useState<{ cle: string; quantite: string; pamp: string; objectif: string; plateforme: string; saisie: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Plateformes présentes (pour le filtre) ; un filtre qui ne correspond plus à rien (plateforme supprimée) est ignoré.
  const plateformes = useMemo(() => [...new Set(toutesPositions.map((p) => p.plateforme ?? SANS_PLATEFORME))].sort((a, b) => a.localeCompare(b, "fr")), [toutesPositions]);
  const filtreActif = plateformeFiltre && plateformes.includes(plateformeFiltre) ? plateformeFiltre : null;
  /** Positions affichées : toutes, ou celles de la plateforme choisie. */
  const positions = useMemo(() => (filtreActif ? toutesPositions.filter((p) => (p.plateforme ?? SANS_PLATEFORME) === filtreActif) : toutesPositions), [toutesPositions, filtreActif]);

  const actifsParCle = useMemo(() => Object.fromEntries(actifs.map((a) => [cleActif(a), a])), [actifs]);
  const clesDetenues = useMemo(() => [...new Set(toutesPositions.map((p) => p.cle))].filter((c) => actifsParCle[c]), [toutesPositions, actifsParCle]);

  // Devise de chaque actif détenu (une seule fois par actif ; mise en cache côté source).
  useEffect(() => {
    const manquantes = clesDetenues.filter((c) => !devises[c]);
    if (!manquantes.length) return;
    let annule = false;
    void Promise.allSettled(
      manquantes.map(async (c) => [c, await fournisseur(actifsParCle[c].source).devise(actifsParCle[c].symbole)] as const),
    ).then((rs) => {
      if (annule) return;
      const ajout = Object.fromEntries(rs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
      if (Object.keys(ajout).length) setDevises((d) => ({ ...d, ...ajout }));
    });
    return () => {
      annule = true;
    };
  }, [clesDetenues, devises, actifsParCle]);

  // Taux de change vers l'euro, rafraîchis toutes les 5 minutes.
  // Le dollar est demandé dès qu'il sert à l'affichage, même si aucun actif n'est coté en dollars.
  const listeDevises = useMemo(() => [...new Set([...Object.values(devises), ...(devise === "USD" ? ["USD"] : [])])].sort().join(","), [devises, devise]);
  useEffect(() => {
    if (!listeDevises) return;
    let annule = false;
    const charger = () => tauxVersEur(listeDevises.split(",")).then((t) => !annule && setTaux(t)).catch(() => {});
    void charger();
    const t = setInterval(charger, 5 * 60_000);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [listeDevises]);

  // Lots importés avec un montant en euros mais sans quantité : on déduit la quantité du premier prix reçu (puis on la fige).
  useEffect(() => {
    const aEstimer = toutesPositions.filter((p) => p.quantite == null && p.montantEur != null);
    if (!aEstimer.length) return;
    const calculs = new Map<string, number>();
    for (const p of aEstimer) {
      const prix = cotations[p.cle]?.prix;
      const t = devises[p.cle] ? taux[devises[p.cle]] : undefined;
      if (prix && t) calculs.set(p.id, p.montantEur! / (prix * t));
    }
    if (calculs.size) surPositions((l) => l.map((p) => (calculs.has(p.id) ? { ...p, quantite: calculs.get(p.id), estimee: true } : p)));
  }, [toutesPositions, cotations, devises, taux, surPositions]);

  const entrees = useMemo(() => ({ actifs: actifsParCle, cotations, devises, taux }), [actifsParCle, cotations, devises, taux]);
  const lignes = useMemo(() => agreger(positions, entrees), [positions, entrees]);
  const tot = useMemo(() => totaux(lignes), [lignes]);
  /** Les calculs sont en euros : la conversion vers la devise choisie ne se fait qu'ici, à l'affichage (« — » si le taux manque). */
  const m: Montant = (valeurEur, decimales = 0) => formaterMontant(versDevise(valeurEur, devise, taux), devise, decimales);
  const symbole = SYMBOLE_DEVISE[devise];
  const tauxManquant = devise === "USD" && !taux.USD;

  const parCategorie = useMemo(() => repartition(lignes.map((l) => ({ nom: categorieDe(l.actif, categories), valeurEur: l.valeurEur }))), [lignes, categories]);
  const parPlateforme = useMemo(
    () => repartition(toutesPositions.filter((p) => actifsParCle[p.cle]).map((p) => ({ nom: p.plateforme ?? SANS_PLATEFORME, valeurEur: valeurLotEur(p, entrees) }))),
    [toutesPositions, actifsParCle, entrees],
  );

  // Cartes complémentaires et données du graphique de valeur.
  const variationJour = useMemo(() => variationPortefeuille(lignes, cotations), [lignes, cotations]);
  const gainsRealises = useMemo(() => gainsRealisesTotal(lignes, taux), [lignes, taux]);
  const extremes = useMemo(() => extremesPerformance(lignes), [lignes]);
  const entreesGraphique = useMemo<EntreeHistorique[]>(() => lignes.map((l) => ({ cle: l.cle, source: l.actif.source, symbole: l.actif.symbole, devise: l.devise, lots: l.lots })), [lignes]);
  /** Achats et ventes connus des positions affichées, du plus récent au plus ancien. */
  const transactions = useMemo(
    () =>
      positions
        .flatMap((p) => {
          const gains = new Map(gainsRealisesDe(p.mouvements ?? []).map((g) => [g.date, g.gain]));
          return (p.mouvements ?? []).map((mv) => ({ ...mv, cle: p.cle, plateforme: p.plateforme, gain: mv.sens === "vente" ? (gains.get(mv.date) ?? null) : null }));
        })
        .filter((t) => actifsParCle[t.cle])
        .sort((a, b) => b.date - a.date),
    [positions, actifsParCle],
  );

  const affichees = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const liste = lignes.filter((l) => !f || l.actif.symbole.toLowerCase().includes(f) || l.actif.nom.toLowerCase().includes(f));
    const valeur = (l: LignePortefeuille) => (tri.col === "symbole" ? l.actif.symbole : (l[tri.col] ?? -Infinity));
    return liste.sort((a, b) => {
      const x = valeur(a);
      const y = valeur(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "fr") : (x as number) - (y as number)) * tri.sens;
    });
  }, [lignes, filtre, tri]);

  const entete = (col: Colonne, libelle: string, droite = true) => (
    <th className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-normal text-doux hover:text-texte ${droite ? "text-right" : "text-left"}`} onClick={() => surTri({ col, sens: tri.col === col ? (-tri.sens as 1 | -1) : -1 })}>
      {libelle} {tri.col === col ? (tri.sens === -1 ? <ChevronDown size={12} className="inline" /> : <ChevronUp size={12} className="inline" />) : ""}
    </th>
  );

  const preparerAlertesTp = () => {
    const deja = new Set(alertesExistantes.map((a) => `${a.cle}:${a.seuil}`));
    // Seuls les objectifs encore au-dessus du prix : une alerte déjà « atteinte » se déclencherait aussitôt pour rien.
    const objectifs = lignes
      .filter((l) => l.objectif != null && (l.versObjectifPct == null || l.versObjectifPct > 0) && !deja.has(`${l.cle}:${l.objectif}`))
      .map((l) => ({ actif: l.actif, prix: l.objectif! }));
    if (!objectifs.length) return setInfo("Aucun objectif à transformer en alerte (déjà créées, déjà atteints, ou aucun objectif saisi).");
    setConfirmationTp(objectifs);
  };

  const ajouterPosition = () => {
    if (!formulaire) return;
    const q = lireNombre(formulaire.quantite);
    const pamp = lireNombre(formulaire.pamp);
    const objectif = lireNombre(formulaire.objectif);
    if (!formulaire.cle || q == null || q <= 0 || pamp === null || objectif === null) return setInfo("Choisissez un actif et saisissez une quantité positive (PAMP et objectif doivent être des nombres).");
    const dCot = devises[formulaire.cle];
    const conv = (v: number | undefined) => (v == null ? v : convertirSaisie(v, formulaire.saisie || dCot, dCot, taux));
    surPositions((l) => [...l, { id: crypto.randomUUID(), cle: formulaire.cle, quantite: q, pamp: conv(pamp), objectif: conv(objectif), plateforme: formulaire.plateforme.trim() || undefined }]);
    setFormulaire(null);
    setInfo(null);
  };

  /** Export CSV de ce qui est affiché (plateforme et filtre appliqués) : positions, ou transactions avec leurs gains réalisés. */
  const exporter = (quoi: "positions" | "transactions") => {
    const jour = new Date().toISOString().slice(0, 10);
    if (quoi === "positions") {
      telecharger(`hune-portefeuille-${jour}.csv`, csvPositions(affichees, devise, taux, (l) => categorieDe(l.actif, categories)), "text/csv;charset=utf-8");
    } else {
      const lots = positions.filter((p) => p.mouvements?.length && actifsParCle[p.cle]).map((p) => ({ symbole: actifsParCle[p.cle].symbole, devise: devises[p.cle] ?? null, plateforme: p.plateforme, mouvements: p.mouvements! }));
      telecharger(`hune-transactions-${jour}.csv`, csvTransactions(lots), "text/csv;charset=utf-8");
    }
    setInfo(`Fichier ${quoi === "positions" ? "des positions" : "des transactions"} enregistré dans vos téléchargements (séparateur « ; », prêt pour Excel).`);
  };

  const majLot = (id: string, patch: Partial<Position>) => surPositions((l) => l.map((p) => (p.id === id ? { ...p, ...patch, estimee: "quantite" in patch ? false : p.estimee } : p)));

  return (
    <div className="apparait flex-1 space-y-5 overflow-auto p-6">
      <EnTete titre="Portefeuille" sousTitre={`Valeur en ${devise === "USD" ? "dollars" : "euros"}, plus-values latentes et répartition de vos positions. Lecture seule : rien n'est envoyé nulle part.`} />
      {plateformes.length > 1 && (
        <div className="segments flex-wrap" role="group" aria-label="Plateforme" title="Afficher l'ensemble du portefeuille ou une seule plateforme">
          <button aria-pressed={!filtreActif} className="segment" onClick={() => setPlateformeFiltre(null)}>
            Vue d'ensemble
          </button>
          {plateformes.map((pf) => (
            <button key={pf} aria-pressed={filtreActif === pf} className="segment" onClick={() => setPlateformeFiltre(pf)}>
              {pf}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="carte-info p-4">
          <div className="text-xs text-doux">Valeur totale</div>
          <div className="titre-serif whitespace-nowrap text-[34px] leading-none">{m(tot.valeurEur)}</div>
          {variationJour && (
            <div className={`text-xs ${classePct(variationJour.pct)}`} title="Variation de la valeur selon la définition choisie dans Réglages (24 h glissantes ou depuis 00:00 UTC)">
              {variationJour.pct >= 0 ? "+" : "−"}{m(Math.abs(variationJour.deltaEur))} · {formaterPct(variationJour.pct)}
            </div>
          )}
          {tauxManquant && <div className="text-xs text-alerte">Taux EUR/USD indisponible : montants non convertis.</div>}
          {tot.nonValorisees > 0 && <div className="text-xs text-alerte">{tot.nonValorisees} ligne{tot.nonValorisees > 1 ? "s" : ""} non valorisée{tot.nonValorisees > 1 ? "s" : ""} (prix ou change manquant)</div>}
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux" title="Calculé sur les lots dont le prix d'achat moyen (PAMP) est connu">P&amp;L latent</div>
          <div className={`titre-serif whitespace-nowrap text-[34px] leading-none ${classePct(tot.pnlEur)}`}>{m(tot.pnlEur)}</div>
          <div className={`text-xs ${classePct(tot.pnlPct)}`}>{formaterPct(tot.pnlPct)}</div>
          {gainsRealises != null && (
            <div className="mt-0.5 text-xs text-doux" title="Gains réalisés sur les ventes de l'historique de transactions importé (méthode du prix moyen, hors frais)">
              Réalisé : <span className={classePct(gainsRealises)}>{gainsRealises >= 0 ? "+" : "−"}{m(Math.abs(gainsRealises))}</span>
            </div>
          )}
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux" title="Ce que vous avez payé pour les positions détenues (quantité × PAMP), sur les lots dont le PAMP est connu">Base de coût</div>
          <div className="titre-serif whitespace-nowrap text-[34px] leading-none">{m(tot.coutEur > 0 ? tot.coutEur : null)}</div>
          <div className="text-xs text-doux">{lignes.length} ligne{lignes.length > 1 ? "s" : ""} · {positions.length} lot{positions.length > 1 ? "s" : ""}</div>
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux" title="Classées par P&L en %, sur les lignes dont le PAMP est connu">Meilleure / moins bonne</div>
          {extremes ? (
            <div className="mt-1 space-y-1.5 text-sm">
              {([["meilleure", extremes.meilleure], ["pire", extremes.pire]] as const).map(([cle, l]) => (
                <button key={cle} className="flex w-full items-center gap-2 bg-transparent p-0 text-left text-texte hover:text-accent" title="Voir le graphique" onClick={() => surOuvrir(l.cle)}>
                  <IconeActif actif={l.actif} taille={20} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.actif.symbole}</span>
                  <span className={`font-mono text-xs ${classePct(l.pnlPct)}`}>{formaterPct(l.pnlPct)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-doux">—</div>
          )}
        </div>
      </div>

      {lignes.length > 0 && <GraphiquePortefeuille entrees={entreesGraphique} taux={taux} devise={devise} periode={periode} surPeriode={surPeriode} theme={theme} />}

      <div className="grid gap-3 md:grid-cols-2">
        <BarreRepartition titre="Répartition par catégorie" parts={parCategorie} m={m} />
        {!filtreActif && <BarreRepartition titre="Répartition par plateforme" parts={parPlateforme} m={m} />}
      </div>
      <p className="m-0 text-xs text-doux" title="Taux utilisés pour convertir les cotations en euros">
        Taux de change : {Object.entries(taux).filter(([d]) => d !== "EUR" && d !== "GBp").map(([d, t]) => `1 ${d} = ${t.toFixed(4).replace(".", ",")} €`).join(" · ") || "—"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="segments" role="group" aria-label="Devise d'affichage" title="Devise d'affichage du portefeuille (mémorisée)">
          {(["EUR", "USD"] as const).map((d) => (
            <button key={d} aria-pressed={devise === d} className="segment" onClick={() => surDevise(d)}>
              {SYMBOLE_DEVISE[d]} {d === "EUR" ? "Euro" : "Dollar"}
            </button>
          ))}
        </div>
        <input className="champ" placeholder="Filtrer…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <button className="bouton" onClick={() => setFormulaire(formulaire ? null : { cle: actifs[0] ? cleActif(actifs[0]) : "", quantite: "", pamp: "", objectif: "", plateforme: "", saisie: "" })}>
          <Plus size={14} /> Ajouter une position
        </button>
        <button className="bouton" title="Crée une alerte « prix ≥ objectif » pour chaque objectif saisi" onClick={preparerAlertesTp}>
          <Bell size={14} /> Alertes aux objectifs (TP)
        </button>
        <button className="bouton" title="Reconstitue quantités et PAMP à partir d'un historique d'achats et de ventes (CoinMarketCap, courtier, exchange…)" onClick={() => choixCsv.current?.click()}>
          <Upload size={14} /> Importer des transactions (CSV)
        </button>
        <button className="bouton" disabled={!affichees.length} title="Enregistre le tableau affiché (devise, plateforme et filtre appliqués) en CSV pour Excel" onClick={() => exporter("positions")}>
          <Download size={14} /> Exporter les positions (CSV)
        </button>
        {transactions.length > 0 && (
          <button className="bouton" title="Enregistre vos achats et ventes avec le gain réalisé de chaque vente" onClick={() => exporter("transactions")}>
            <Download size={14} /> Exporter les transactions (CSV)
          </button>
        )}
        <input
          ref={choixCsv}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            setFichierCsv(e.target.files?.[0] ?? null);
            e.target.value = ""; // permet de rechoisir le même fichier
          }}
        />
      </div>

      {fichierCsv && (
        <ImportTransactions
          fichier={fichierCsv}
          actifs={actifs}
          positions={toutesPositions}
          surAjouterActifs={surAjouterActifs}
          surPositions={surPositions}
          surFermer={(message) => {
            setFichierCsv(null);
            if (message) setInfo(message);
          }}
        />
      )}

      {confirmationTp && (
        <div className="rounded-xl border border-alerte/60 p-3 text-sm">
          Créer <b>{confirmationTp.length}</b> alerte{confirmationTp.length > 1 ? "s" : ""} « prix ≥ objectif » ({confirmationTp.slice(0, 6).map((o) => o.actif.symbole).join(", ")}{confirmationTp.length > 6 ? "…" : ""}) ?
          <div className="mt-2 flex gap-2">
            <button
              className="bouton bouton-actif"
              onClick={() => {
                const n = surAlertesObjectifs(confirmationTp);
                setConfirmationTp(null);
                setInfo(`${n} alerte${n > 1 ? "s" : ""} créée${n > 1 ? "s" : ""}.`);
              }}
            >
              Créer
            </button>
            <button className="bouton" onClick={() => setConfirmationTp(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {formulaire && (
        <div className="flex flex-wrap items-end gap-2 carte-info p-4">
          <label className="flex flex-col gap-1 text-xs text-doux">
            Actif
            <select className="champ max-w-52" value={formulaire.cle} onChange={(e) => setFormulaire({ ...formulaire, cle: e.target.value })}>
              {actifs.map((a) => (
                <option key={cleActif(a)} value={cleActif(a)}>
                  {a.symbole} — {a.nom.slice(0, 22)}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["quantite", "Quantité", "w-28"],
              ["pamp", "PAMP", "w-28"],
              ["objectif", "Objectif (TP)", "w-28"],
              ["plateforme", "Plateforme", "w-28"],
            ] as const
          ).map(([k, titre, large]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-doux">
              {titre}
              <input className={`champ ${large}`} value={formulaire[k]} onChange={(e) => setFormulaire({ ...formulaire, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && ajouterPosition()} />
            </label>
          ))}
          {devisesDeSaisie(devises[formulaire.cle], taux).length > 1 && (
            <label className="flex flex-col gap-1 text-xs text-doux" title="Devise dans laquelle vous saisissez le PAMP et l'objectif ; ils sont convertis au taux du jour et enregistrés dans la devise de cotation de l'actif.">
              Prix saisis en
              <select className="champ" value={formulaire.saisie || devises[formulaire.cle]} onChange={(e) => setFormulaire({ ...formulaire, saisie: e.target.value })}>
                {devisesDeSaisie(devises[formulaire.cle], taux).map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d === devises[formulaire.cle] ? " (cotation)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="bouton bouton-actif" onClick={ajouterPosition}>
            Ajouter
          </button>
        </div>
      )}
      {info && <p className="m-0 text-xs text-doux">{info}</p>}

      {lignes.length > 0 && (
        <div className="segments" role="group" aria-label="Contenu du tableau">
          <button aria-pressed={vue === "actifs"} className="segment" onClick={() => setVue("actifs")}>
            Actifs
          </button>
          <button aria-pressed={vue === "transactions"} className="segment" onClick={() => setVue("transactions")} title="Achats et ventes issus d'un import de transactions">
            Transactions{transactions.length ? ` (${transactions.length})` : ""}
          </button>
        </div>
      )}

      {lignes.length === 0 ? (
        <p className="text-doux">Aucune position. Ajoutez-en une ci-dessus, ou importez vos données (Réglages › Sauvegarde › Importer).</p>
      ) : vue === "transactions" ? (
        transactions.length === 0 ? (
          <p className="text-doux">Aucune transaction enregistrée. Importez l'historique de vos achats et ventes avec « Importer des transactions (CSV) » : ils apparaîtront ici et sur les graphiques.</p>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-2xl border border-ligne">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-carte">
                <tr className="border-b border-ligne text-xs text-doux">
                  <th className="px-2 py-2 text-left font-normal">Date</th>
                  <th className="px-2 py-2 text-left font-normal">Actif</th>
                  <th className="px-2 py-2 text-left font-normal">Type</th>
                  <th className="px-2 py-2 text-right font-normal">Quantité</th>
                  <th className="px-2 py-2 text-right font-normal">Prix</th>
                  <th className="px-2 py-2 text-right font-normal">Montant</th>
                  <th className="px-2 py-2 text-right font-normal" title="Gain réalisé par la vente, au prix moyen d'achat du moment, hors frais (devise de cotation)">Gain réalisé</th>
                  <th className="px-2 py-2 text-left font-normal">Plateforme</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 500).map((t, i) => {
                  const actif = actifsParCle[t.cle];
                  return (
                    <tr key={`${t.cle}-${t.date}-${i}`} className="border-b border-ligne last:border-0">
                      <td className="whitespace-nowrap px-2 py-1.5 text-doux">{new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="px-2">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <IconeActif actif={actif} taille={18} />
                          {actif.symbole}
                        </span>
                      </td>
                      <td className={`px-2 ${t.sens === "achat" ? "text-hausse" : "text-baisse"}`}>{t.sens === "achat" ? "Achat" : "Vente"}</td>
                      <td className="whitespace-nowrap px-2 text-right font-mono">{quantite(t.quantite)}</td>
                      <td className="whitespace-nowrap px-2 text-right font-mono">
                        {formaterPrix(t.prix)} <span className="text-xs text-doux">{devises[t.cle] ?? ""}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono">{formaterPrix(t.prix * t.quantite)}</td>
                      <td className={`whitespace-nowrap px-2 text-right font-mono ${classePct(t.gain)}`}>{t.gain == null ? "" : `${t.gain >= 0 ? "+" : "−"}${formaterPrix(Math.abs(t.gain))}`}</td>
                      <td className="px-2 text-doux">{t.plateforme ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ligne">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ligne">
                {entete("symbole", "Actif", false)}
                <th className="px-2 py-2 text-right font-normal text-doux">Quantité</th>
                <th className="px-2 py-2 text-right font-normal text-doux">PAMP</th>
                <th className="px-2 py-2 text-right font-normal text-doux">Prix</th>
                {entete("valeurEur", "Valeur")}
                {entete("pnlPct", "P&L %")}
                {entete("pnlEur", `P&L ${symbole}`)}
                {entete("poids", "Poids")}
                {entete("versObjectifPct", "Objectif (TP)")}
              </tr>
            </thead>
            <tbody>
              {affichees.map((l) => (
                <LigneTableau key={l.cle} taux={taux} l={l} m={m} ouverte={ouverte === l.cle} surBascule={() => setOuverte(ouverte === l.cle ? null : l.cle)} surOuvrir={() => surOuvrir(l.cle)} majLot={majLot} suppr={(id) => surPositions((p) => p.filter((x) => x.id !== id))} ajouterLot={() => surPositions((p) => [...p, { id: crypto.randomUUID(), cle: l.cle, quantite: 0 }])} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LigneTableau({ taux, l, m, ouverte, surBascule, surOuvrir, majLot, suppr, ajouterLot }: { taux: Record<string, number>; l: LignePortefeuille; m: Montant; ouverte: boolean; surBascule: () => void; surOuvrir: () => void; majLot: (id: string, p: Partial<Position>) => void; suppr: (id: string) => void; ajouterLot: () => void }) {
  return (
    <>
      <tr className="border-b border-ligne hover:bg-fond">
        <td className="px-2 py-1.5">
          <button className="mr-1 bg-transparent p-0 text-doux hover:text-texte" aria-label="Détail des lots" title="Lots" onClick={surBascule}>
            {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="mr-1.5 inline-block align-middle">
            <IconeActif actif={l.actif} taille={22} />
          </span>
          <button className="bg-transparent p-0 font-semibold text-texte hover:text-accent" title="Voir le graphique" onClick={surOuvrir}>
            {l.actif.symbole}
          </button>
          {!/^[A-Z0-9]+\/[A-Z0-9]+$/.test(l.actif.nom) && (
            <span className="ml-2 inline-block max-w-[210px] truncate align-bottom text-doux" title={l.actif.nom}>
              {l.actif.nom}
            </span>
          )}
          {l.lots.length > 1 && <span className="ml-1 text-xs text-doux">({l.lots.length} lots)</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {quantite(l.quantite)}
          {l.estimee && <span title="Quantité estimée à partir du montant importé" className="text-alerte"> ≈</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono text-doux">
          {l.pamp != null ? formaterPrix(l.pamp) : "—"}
          {l.pampPartiel && <span title="Certains lots n'ont pas de PAMP : le P&L les ignore" className="text-alerte"> *</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {formaterPrix(l.prix)} <span className="text-xs text-doux">{l.devise ?? ""}</span>
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">{m(l.valeurEur)}</td>
        <td className={`whitespace-nowrap px-2 text-right font-mono ${classePct(l.pnlPct)}`}>{formaterPct(l.pnlPct)}</td>
        <td className={`whitespace-nowrap px-2 text-right font-mono ${classePct(l.pnlEur)}`}>{m(l.pnlEur)}</td>
        <td className="whitespace-nowrap px-2 text-right font-mono">{pourcent(l.poids)}</td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {l.objectif != null ? (
            <>
              {formaterPrix(l.objectif)} <span className={`text-xs ${l.versObjectifPct != null && l.versObjectifPct <= 0 ? "text-hausse" : "text-doux"}`}>{l.versObjectifPct != null ? (l.versObjectifPct <= 0 ? "atteint" : `+${l.versObjectifPct.toFixed(0)} %`) : ""}</span>
            </>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {ouverte && (
        <tr className="border-b border-ligne bg-fond">
          <td colSpan={9} className="px-4 py-2">
            <div className="space-y-1">
              {l.lots.map((lot) => (
                <div key={lot.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <ChampLot valeur={lot.quantite} placeholder="Quantité" surChangement={(v) => majLot(lot.id, { quantite: v })} />
                  <ChampLotPrix valeur={lot.pamp} placeholder="PAMP" devise={l.devise} taux={taux} surChangement={(v) => majLot(lot.id, { pamp: v })} />
                  <ChampLotPrix valeur={lot.objectif} placeholder="Objectif" devise={l.devise} taux={taux} surChangement={(v) => majLot(lot.id, { objectif: v })} />
                  <input defaultValue={lot.plateforme ?? ""} placeholder="Plateforme" className="champ w-28 !py-1 text-xs" onBlur={(e) => majLot(lot.id, { plateforme: e.target.value.trim() || undefined })} />
                  {lot.montantEur != null && <span className="text-doux">importé : {formaterMontant(lot.montantEur, "EUR", 2)}</span>}
                  <button className="bouton-icone" title="Supprimer ce lot" aria-label="Supprimer ce lot" onClick={() => suppr(lot.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button className="bouton !py-0.5 text-xs" onClick={ajouterLot}>
                <Plus size={14} /> Ajouter un lot
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
