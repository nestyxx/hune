import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decrire, type Alerte } from "./alertes/moteur";
import { notifier } from "./alertes/notifier";
import { PanneauAlertes } from "./alertes/panneau";
import { useVerificationAlertes } from "./alertes/verification";
import { BarreTitre } from "./barre-titre";
import { CATEGORIES_PAR_DEFAUT, grouper, type Tri } from "./categories";
import { cotationsActifs } from "./donnees";
import type { Profondeur } from "./donnees/historique";
import { INTERVALLES, cleActif, type Actif, type Cotation, type Intervalle } from "./donnees/types";
import { EnteteActif } from "./entete";
import { entrerModeCompact, sortirModeCompact, useFenetre } from "./fenetre";
import { formaterPrix } from "./format";
import { Graphique, INDICATEURS_PAR_DEFAUT, PARAMETRES_PAR_DEFAUT, type Indicateurs, type Parametres, type TypeGraphique } from "./graphique";
import { useMiseAJour } from "./miseajour";
import type { Dessin } from "./dessins";
import { periodeValide } from "./historique-portefeuille";
import { niveauxPortefeuille, triPortefeuilleValide, type Position } from "./portefeuille";
import { Rail, type Onglet } from "./rail";
import { PanneauReglages, REGLAGES_PAR_DEFAUT, type Reglages } from "./reglages";
import { donneesPresentes, listerCopies, type CopieAuto } from "./restauration";
import { restaurer } from "./sauvegarde";
import { ecrire, lire, recharger } from "./stockage";
import { useTheme, type PreferenceTheme } from "./theme";
import { majInfobulleTray } from "./tray";
import { VueMarche } from "./vue-marche";
import { VuePortefeuille } from "./vue-portefeuille";
import { Watchlist } from "./watchlist";

/** Rafraîchissement des prix de la watchlist. */
const PERIODE_COTATIONS_MS = 30_000;

/** Préférences d'affichage de la fenêtre. */
interface PrefsInterface {
  menuReduit: boolean;
  listeVisible: boolean;
  /** Liste d'actifs sur une seule ligne par actif. */
  listeUneLigne: boolean;
}
const PREFS_INTERFACE: PrefsInterface = { menuReduit: false, listeVisible: true, listeUneLigne: false };

/**
 * Écrit une donnée dans le stockage quand elle CHANGE, jamais au démarrage : la première valeur observée après le
 * chargement est celle que l'on vient de lire dans le fichier, la réécrire n'apporterait rien et ferait courir un
 * risque (une lecture ratée écraserait de bonnes données par des valeurs par défaut).
 */
function usePersister(cle: string, valeur: unknown, pret: boolean) {
  const derniere = useRef<{ valeur: unknown } | null>(null);
  useEffect(() => {
    if (!pret) return;
    if (derniere.current === null) {
      derniere.current = { valeur };
      return;
    }
    if (derniere.current.valeur === valeur) return;
    derniere.current = { valeur };
    void ecrire(cle, valeur);
  }, [cle, valeur, pret]);
}

const THEMES: PreferenceTheme[] = ["auto", "clair", "sombre"];

/**
 * Affiché quand le fichier de données n'a pas pu être lu (ou semble vide alors que des données existent) : rien n'est
 * modifié sur le disque. « Réessayer » relance l'application ; une copie automatique peut aussi être restaurée.
 */
function EcranLectureBloquee() {
  const [copie, setCopie] = useState<CopieAuto | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => {
    void listerCopies().then((c) => setCopie(c.find((x) => x.actifs > 0 || x.positions > 0) ?? null));
  }, []);
  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="carte-info max-w-lg space-y-3 p-6">
        <h1 className="titre-serif m-0 text-2xl">Vos données n'ont pas pu être lues</h1>
        <p className="m-0 text-sm">
          Le fichier de données de Hune est momentanément illisible (ou paraît vide). <b>Rien n'a été modifié ni effacé</b> : Hune n'écrit rien tant que la lecture ne réussit pas.
        </p>
        <p className="m-0 text-xs text-doux">
          Fermez Hune puis rouvrez-la (zone de notification › Quitter), ou cliquez sur « Réessayer ». Si le problème persiste, une copie automatique peut être restaurée ; elle remplacera le fichier actuel.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="bouton bouton-actif" onClick={() => location.reload()}>
            Réessayer
          </button>
          {copie && !confirmer && (
            <button className="bouton" onClick={() => setConfirmer(true)}>
              Restaurer la copie du {copie.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}…
            </button>
          )}
          {copie && confirmer && (
            <span className="flex items-center gap-2 text-xs">
              Remplacer le fichier actuel par cette copie ({copie.actifs} actifs, {copie.positions} positions) ?
              <button
                className="bouton bouton-actif !py-0.5"
                onClick={async () => {
                  await restaurer(copie.donnees);
                  location.reload();
                }}
              >
                Oui, restaurer
              </button>
              <button className="bouton !py-0.5" onClick={() => setConfirmer(false)}>
                Non
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [pret, setPret] = useState(false);
  /** La lecture du fichier de données a échoué ou semble vide malgré des données sur le disque : on n'écrit rien. */
  const [lectureBloquee, setLectureBloquee] = useState(false);
  const [actifs, setActifs] = useState<Actif[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES_PAR_DEFAUT);
  const [repliees, setRepliees] = useState<string[]>([]);
  const [tri, setTri] = useState<Tri>("manuel");
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_PAR_DEFAUT);
  const [ui, setUi] = useState<PrefsInterface>(PREFS_INTERFACE);
  const [cotations, setCotations] = useState<Record<string, Cotation>>({});
  const [selection, setSelection] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("graphique");
  // Vue par défaut du graphique : journalier, bougies, échelle logarithmique, volume + SMA + EMA + RSI (voir INDICATEURS_PAR_DEFAUT).
  const [intervalle, setIntervalle] = useState<Intervalle>("1d");
  const [profondeur, setProfondeur] = useState<Profondeur>("standard");
  const [indicateurs, setIndicateurs] = useState<Indicateurs>(INDICATEURS_PAR_DEFAUT);
  const [parametres, setParametres] = useState<Parametres>(PARAMETRES_PAR_DEFAUT);
  const [typeGraphique, setTypeGraphique] = useState<TypeGraphique>("bougies");
  const [echelleLog, setEchelleLog] = useState(true);
  /** Tracés de l'utilisateur, par actif (clé `source:symbole`). */
  const [dessins, setDessins] = useState<Record<string, Dessin[]>>({});
  const [lignesPortefeuille, setLignesPortefeuille] = useState(true);
  /** Alerte à ouvrir dans le formulaire de l'onglet Alertes (demandée depuis le graphique). */
  const [alerteAEditer, setAlerteAEditer] = useState<string | null>(null);
  const [prixLive, setPrixLive] = useState<number | null>(null);
  const [signalRecentrer, setSignalRecentrer] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const tailleAvantCompact = useRef<{ largeur: number; hauteur: number } | null>(null);
  const [copieProposee, setCopieProposee] = useState<CopieAuto | null>(null);

  const theme = useTheme(reglages.theme);
  const fenetre = useFenetre();
  const maj = useMiseAJour();
  const [majMasquee, setMajMasquee] = useState(false); // « Plus tard » : la bannière revient au prochain démarrage

  // Chargement initial de toutes les données utilisateur.
  useEffect(() => {
    let annule = false;
    /** Une lecture complète du fichier ; null si elle échoue. */
    const tenter = async () => {
      try {
        return {
          a: await lire<Actif[]>("actifs", []),
          categories: await lire<string[]>("categories", CATEGORIES_PAR_DEFAUT),
          repliees: await lire<string[]>("repliees", []),
          tri: await lire<Tri>("tri", "manuel"),
          intervalle: await lire<Intervalle>("intervalle", "1d"),
          profondeur: await lire<Profondeur>("profondeur", "standard"),
          echelleLog: await lire<boolean>("echelleLog", true),
          dessins: await lire<Record<string, Dessin[]>>("dessins", {}),
          lignesPortefeuille: await lire<boolean>("lignesPortefeuille", true),
          typeGraphique: await lire<TypeGraphique>("typeGraphique", "bougies"),
          indicateurs: { ...INDICATEURS_PAR_DEFAUT, ...(await lire<Partial<Indicateurs>>("indicateurs", {})) },
          parametres: { ...PARAMETRES_PAR_DEFAUT, ...(await lire<Partial<Parametres>>("parametres", {})) },
          reglages: { ...REGLAGES_PAR_DEFAUT, ...(await lire<Partial<Reglages>>("reglages", {})) },
          ui: { ...PREFS_INTERFACE, ...(await lire<Partial<PrefsInterface>>("interface", {})) },
          alertes: await lire<Alerte[]>("alertes", []),
          positions: await lire<Position[]>("positions", []),
        };
      } catch {
        return null;
      }
    };
    // Lecture suspecte : échec, ou résultat vide alors que le disque contient des données (fichier momentanément
    // inaccessible…). On ne démarre jamais sur du vide dans ce cas : la première modification écraserait les vraies données.
    const suspecte = async (d: Awaited<ReturnType<typeof tenter>>) => d === null || (!d.a.length && !d.positions.length && !d.alertes.length && (await donneesPresentes()));
    void (async () => {
      let d = await tenter();
      if (await suspecte(d)) {
        for (const attente of [500, 1500, 3000, 6000]) {
          await new Promise((r) => setTimeout(r, attente));
          if (annule) return;
          await recharger().catch(() => {});
          d = await tenter();
          if (!(await suspecte(d))) break;
        }
        if (d === null || (await suspecte(d))) {
          if (!annule) setLectureBloquee(true);
          return;
        }
      }
      if (annule || d === null) return;
      setCategories(d.categories);
      setRepliees(d.repliees);
      setTri(d.tri);
      setIntervalle(d.intervalle);
      setProfondeur(d.profondeur);
      setEchelleLog(d.echelleLog);
      setDessins(d.dessins);
      setLignesPortefeuille(d.lignesPortefeuille);
      setTypeGraphique(d.typeGraphique);
      setIndicateurs(d.indicateurs);
      setParametres(d.parametres);
      setReglages(d.reglages);
      setUi(d.ui);
      setAlertes(d.alertes);
      setPositions(d.positions);
      setActifs(d.a);
      setSelection(d.a[0] ? cleActif(d.a[0]) : null);
      setPret(true);
    })();
    return () => {
      annule = true;
    };
  }, []);

  usePersister("actifs", actifs, pret);
  usePersister("categories", categories, pret);
  usePersister("repliees", repliees, pret);
  usePersister("tri", tri, pret);
  usePersister("alertes", alertes, pret);
  usePersister("positions", positions, pret);
  usePersister("reglages", reglages, pret);
  usePersister("interface", ui, pret);
  usePersister("indicateurs", indicateurs, pret);
  usePersister("parametres", parametres, pret);
  usePersister("typeGraphique", typeGraphique, pret);
  usePersister("intervalle", intervalle, pret);
  usePersister("profondeur", profondeur, pret);
  usePersister("echelleLog", echelleLog, pret);
  usePersister("dessins", dessins, pret);
  usePersister("lignesPortefeuille", lignesPortefeuille, pret);

  /** PAMP, objectif et achats des positions détenues sur l'actif affiché, à tracer sur son graphique. */
  const niveaux = useMemo(() => niveauxPortefeuille(positions.filter((p) => p.cle === selection)), [positions, selection]);
  const dessinsActif = useMemo(() => (selection ? (dessins[selection] ?? []) : []), [dessins, selection]);

  // Démarrage sans aucune donnée alors que des copies automatiques en contiennent : on propose de les restaurer.
  useEffect(() => {
    if (!pret || actifs.length || positions.length || alertes.length) return;
    void listerCopies().then((copies) => setCopieProposee(copies.find((c) => c.actifs > 0 || c.positions > 0) ?? null));
    // Une seule vérification, juste après le chargement : on ne la rejoue pas quand l'utilisateur ajoute un actif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  /** Message discret en bas à droite, qui disparaît seul. */
  const prevenir = useCallback((texte: string) => {
    setInfo(texte);
    setTimeout(() => setInfo((t) => (t === texte ? null : t)), 3500);
  }, []);

  const changerAlertes = useCallback((modifier: (liste: Alerte[]) => Alerte[]) => setAlertes((prec) => modifier(prec)), []);
  const changerPositions = useCallback((modifier: (liste: Position[]) => Position[]) => setPositions((prec) => modifier(prec)), []);

  // Déclenchement : l'alerte passe à « déclenchée » (elle ne se redéclenchera pas) et on notifie.
  const declencher = useCallback(
    (alerte: Alerte, valeur: number) => {
      // `a.condition === alerte.condition` : une vérification lancée avant une modification ne doit pas déclencher l'alerte modifiée.
      changerAlertes((l) => l.map((a) => (a.id === alerte.id && a.statut === "armee" && a.condition === alerte.condition ? { ...a, statut: "declenchee", declencheeLe: Date.now(), valeur } : a)));
      const t = alerte.condition.type;
      const mesure = t === "variation" ? `${valeur.toFixed(2).replace(".", ",")} %` : t === "rsi" ? valeur.toFixed(1).replace(".", ",") : formaterPrix(valeur);
      void notifier(`Alerte : ${alerte.actif.symbole}`, `${decrire(alerte.condition)} (actuel : ${mesure})`);
    },
    [changerAlertes],
  );

  const verification = useVerificationAlertes(pret ? alertes : null, declencher, reglages.periodeAlertesS);

  // Prix de la watchlist : un tour tout de suite, puis toutes les 30 s.
  useEffect(() => {
    if (!actifs.length) return;
    let annule = false;
    const tour = async () => {
      const c = await cotationsActifs(actifs, reglages.variation);
      if (!annule) setCotations((prec) => ({ ...prec, ...c }));
    };
    void tour();
    const t = setInterval(tour, PERIODE_COTATIONS_MS);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [actifs, reglages.variation]);

  // Le prix « live » du graphique ne vaut que pour l'actif affiché : on l'efface au changement.
  useEffect(() => setPrixLive(null), [selection]);

  const groupes = useMemo(() => grouper(actifs, categories, tri, cotations), [actifs, categories, tri, cotations]);
  const cleVisibles = useMemo(() => groupes.filter((g) => !repliees.includes(g.nom)).flatMap((g) => g.actifs.map(cleActif)), [groupes, repliees]);
  const nbArmees = alertes.filter((a) => a.statut === "armee").length;
  const alertesArmees = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of alertes) if (a.statut === "armee") m[cleActif(a.actif)] = (m[cleActif(a.actif)] ?? 0) + 1;
    return m;
  }, [alertes]);
  const alertesPrixHaut = useMemo(() => alertes.filter((a) => a.statut === "armee" && a.condition.type === "prix" && a.condition.sens === "au-dessus").map((a) => ({ cle: cleActif(a.actif), seuil: (a.condition as { seuil: number }).seuil })), [alertes]);

  // Info-bulle de l'icône de la zone de notification.
  useEffect(() => {
    if (pret) void majInfobulleTray(nbArmees);
  }, [nbArmees, pret]);

  const ouvrirActif = useCallback((cle: string) => {
    setSelection(cle);
    setOnglet("graphique");
  }, []);

  const basculerCompact = useCallback(async () => {
    if (!compact) {
      tailleAvantCompact.current = await entrerModeCompact();
      setCompact(true);
    } else {
      await sortirModeCompact(tailleAvantCompact.current);
      setCompact(false);
    }
  }, [compact]);

  const basculerTheme = () => setReglages({ ...reglages, theme: THEMES[(THEMES.indexOf(reglages.theme) + 1) % THEMES.length] });

  // Raccourcis clavier (désactivés pendant la saisie dans un champ).
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("recherche")?.focus();
        return;
      }
      const cible = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName) || cible.isContentEditable) return;
      if (e.key === "Escape" && compact) void basculerCompact();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!cleVisibles.length) return;
        e.preventDefault();
        const i = selection ? cleVisibles.indexOf(selection) : -1;
        const suivante = cleVisibles[Math.max(0, Math.min(cleVisibles.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        ouvrirActif(suivante);
        document.querySelector(`[data-actif="${CSS.escape(suivante)}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (/^[1-6]$/.test(e.key)) setIntervalle(INTERVALLES[Number(e.key) - 1]);
      else if (e.key.toLowerCase() === "r") setSignalRecentrer((n) => n + 1);
      else if (e.key.toLowerCase() === "l") setUi((u) => ({ ...u, listeVisible: !u.listeVisible }));
      else if (e.key.toLowerCase() === "g") setOnglet("graphique");
      else if (e.key.toLowerCase() === "f") setOnglet("portefeuille");
      else if (e.key.toLowerCase() === "m") setOnglet("marche");
      else if (e.key.toLowerCase() === "a") setOnglet("alertes");
      else if (e.key.toLowerCase() === "p") setOnglet("reglages");
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [cleVisibles, selection, ouvrirActif, compact, basculerCompact]);

  if (lectureBloquee) return <EcranLectureBloquee />;
  if (!pret) return null;
  const actifSelectionne = actifs.find((a) => cleActif(a) === selection) ?? null;

  // --- Catégories ---
  const creerCategorie = (nom: string) => {
    if (categories.some((c) => c.toLowerCase() === nom.toLowerCase())) return prevenir(`La catégorie « ${nom} » existe déjà.`);
    setCategories([...categories, nom]);
  };
  const renommerCategorie = (ancien: string, brut: string) => {
    const nouveau = brut.trim();
    if (!nouveau || nouveau === ancien) return;
    if (categories.some((c) => c !== ancien && c.toLowerCase() === nouveau.toLowerCase())) return prevenir(`La catégorie « ${nouveau} » existe déjà.`);
    setCategories(categories.map((c) => (c === ancien ? nouveau : c)));
    setActifs(actifs.map((a) => (a.categorie === ancien ? { ...a, categorie: nouveau } : a)));
    setRepliees(repliees.map((c) => (c === ancien ? nouveau : c)));
  };
  const supprimerCategorie = (nom: string) => {
    setCategories(categories.filter((c) => c !== nom));
    // Les actifs retombent dans la catégorie par défaut de leur source : rien n'est supprimé.
    setActifs(actifs.map((a) => (a.categorie === nom ? { ...a, categorie: undefined } : a)));
    prevenir(`Catégorie « ${nom} » supprimée : ses actifs ont été reclassés.`);
  };

  const liste = (pleineLargeur: boolean) => (
    <Watchlist
      pleineLargeur={pleineLargeur}
      uneLigne={ui.listeUneLigne}
      surUneLigne={() => setUi((u) => ({ ...u, listeUneLigne: !u.listeUneLigne }))}
      groupes={groupes}
      categories={categories}
      repliees={repliees}
      cotations={cotations}
      alertesArmees={alertesArmees}
      selection={selection}
      tri={tri}
      surTri={setTri}
      surSelection={pleineLargeur ? setSelection : ouvrirActif}
      surAjout={(a) => {
        if (!actifs.some((x) => cleActif(x) === cleActif(a))) setActifs([...actifs, a]);
        if (pleineLargeur) setSelection(cleActif(a));
        else ouvrirActif(cleActif(a));
      }}
      surSuppression={(cle) => {
        const suite = actifs.filter((a) => cleActif(a) !== cle);
        setActifs(suite);
        if (selection === cle) setSelection(suite[0] ? cleActif(suite[0]) : null);
        // Les alertes d'un actif retiré n'ont plus de sens : on les retire aussi. Les positions restent stockées (réapparaissent si on le re-suit).
        const retirees = alertes.filter((a) => cleActif(a.actif) === cle).length;
        if (retirees) {
          setAlertes(alertes.filter((a) => cleActif(a.actif) !== cle));
          prevenir(`${retirees} alerte${retirees > 1 ? "s" : ""} supprimée${retirees > 1 ? "s" : ""} avec l'actif.`);
        }
      }}
      surDeplacement={(cle, categorie) => setActifs(actifs.map((a) => (cleActif(a) === cle ? { ...a, categorie } : a)))}
      surBasculeGroupe={(nom) => setRepliees(repliees.includes(nom) ? repliees.filter((n) => n !== nom) : [...repliees, nom])}
      surCreationCategorie={creerCategorie}
      surRenommageCategorie={renommerCategorie}
      surSuppressionCategorie={supprimerCategorie}
    />
  );

  return (
    <div className="flex h-full flex-col bg-fond">
      <BarreTitre fenetre={fenetre} compact={compact} />

      {compact ? (
        <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ligne bg-carte">
          {liste(true)}
          <div className="border-t border-ligne p-2">
            <button className="bouton flex w-full items-center justify-center gap-2" onClick={() => void basculerCompact()} title="Revenir à la fenêtre complète (Échap)">
              <Maximize2 size={15} /> Agrandir
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Rail
            onglet={onglet}
            surOnglet={setOnglet}
            reduit={ui.menuReduit}
            surReduire={() => setUi({ ...ui, menuReduit: !ui.menuReduit })}
            listeVisible={ui.listeVisible}
            listeApplicable={onglet === "graphique"}
            surBasculerListe={() => setUi({ ...ui, listeVisible: !ui.listeVisible })}
            alertesArmees={nbArmees}
            majDisponible={maj.etat.etat === "disponible" ? maj.etat.version : null}
            theme={reglages.theme}
            surBasculerTheme={basculerTheme}
            surCompact={() => void basculerCompact()}
          />
          <div className="mb-2 mr-2 flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-ligne bg-carte shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_28px_rgb(16_24_40/0.05)]">
            {ui.listeVisible && onglet === "graphique" && liste(false)}
            <main className="flex min-w-0 flex-1 flex-col">
              {(maj.etat.etat === "disponible" || maj.etat.etat === "telechargement") && !majMasquee && (
                <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent-doux px-5 py-2 text-sm">
                  <span>{maj.etat.etat === "disponible" ? `Hune ${maj.etat.version} est disponible.` : `Téléchargement de la mise à jour${maj.etat.pct != null ? ` : ${maj.etat.pct} %` : "…"}`}</span>
                  {maj.etat.etat === "disponible" && (
                    <span className="flex gap-2">
                      <button className="bouton bouton-actif !py-0.5" onClick={() => void maj.installer()}>
                        Installer et redémarrer
                      </button>
                      <button className="bouton !py-0.5" onClick={() => setMajMasquee(true)}>
                        Plus tard
                      </button>
                    </span>
                  )}
                </div>
              )}
              {copieProposee && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-alerte/40 bg-alerte/10 px-5 py-2 text-sm">
                  <span>
                    Aucune donnée trouvée, mais la sauvegarde du {copieProposee.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} contient {copieProposee.actifs} actif{copieProposee.actifs > 1 ? "s" : ""} et {copieProposee.positions} position{copieProposee.positions > 1 ? "s" : ""}.
                  </span>
                  <span className="flex gap-2">
                    <button
                      className="bouton bouton-actif !py-0.5"
                      onClick={async () => {
                        await restaurer(copieProposee.donnees);
                        location.reload(); // l'interface se recharge avec les données restaurées
                      }}
                    >
                      Restaurer
                    </button>
                    <button className="bouton !py-0.5" onClick={() => setCopieProposee(null)}>
                      Ignorer
                    </button>
                  </span>
                </div>
              )}

              {/* Le graphique reste monté (simplement masqué) pour garder son flux et son zoom en changeant d'onglet. */}
              <div className={onglet === "graphique" ? "apparait flex min-h-0 flex-1 flex-col" : "hidden"}>
                {actifSelectionne ? (
                  <>
                    <EnteteActif actif={actifSelectionne} cotation={cotations[cleActif(actifSelectionne)]} prixLive={prixLive} />
                    <Graphique
                      actif={actifSelectionne}
                      intervalle={intervalle}
                      surIntervalle={setIntervalle}
                      profondeur={profondeur}
                      surProfondeur={setProfondeur}
                      indicateurs={indicateurs}
                      surIndicateurs={setIndicateurs}
                      parametres={parametres}
                      surParametres={setParametres}
                      typeGraphique={typeGraphique}
                      surTypeGraphique={setTypeGraphique}
                      surPrix={setPrixLive}
                      theme={theme}
                      alertes={alertes.filter((a) => cleActif(a.actif) === selection)}
                      echelleLog={echelleLog}
                      surEchelleLog={setEchelleLog}
                      signalRecentrer={signalRecentrer}
                      surCreerAlerte={(prix, sens) => {
                        changerAlertes((l) => [...l, { id: crypto.randomUUID(), actif: actifSelectionne, condition: { type: "prix", sens, seuil: prix }, statut: "armee", creeeLe: Date.now() }]);
                        prevenir(`Alerte créée : ${actifSelectionne.symbole} ${sens === "au-dessus" ? "≥" : "≤"} ${formaterPrix(prix)}`);
                      }}
                      surDeplacerAlerte={(id, seuil, sens) => {
                        // Même effet qu'une modification dans le formulaire : nouvelle condition, alerte réarmée.
                        changerAlertes((l) => l.map((a) => (a.id === id && a.condition.type === "prix" ? { id: a.id, actif: a.actif, condition: { ...a.condition, seuil, sens }, statut: "armee", creeeLe: Date.now() } : a)));
                        prevenir(`Alerte déplacée et réarmée : ${actifSelectionne.symbole} ${sens === "au-dessus" ? "≥" : "≤"} ${formaterPrix(seuil)}`);
                      }}
                      surEditerAlerte={(id) => {
                        setAlerteAEditer(id);
                        setOnglet("alertes");
                      }}
                      surSupprimerAlerte={(id) => changerAlertes((l) => l.filter((a) => a.id !== id))}
                      niveaux={niveaux}
                      lignesPortefeuille={lignesPortefeuille}
                      surLignesPortefeuille={setLignesPortefeuille}
                      dessins={dessinsActif}
                      surDessins={(liste) => setDessins((prec) => ({ ...prec, [actifSelectionne ? cleActif(actifSelectionne) : ""]: liste }))}
                    />
                  </>
                ) : (
                  <div className="p-8 text-doux">Ajoutez ou sélectionnez un actif dans la liste.</div>
                )}
              </div>

              {onglet === "portefeuille" && (
                <VuePortefeuille
                  actifs={actifs}
                  categories={categories}
                  cotations={cotations}
                  devise={reglages.devise === "USD" ? "USD" : "EUR"}
                  surDevise={(devise) => setReglages((r) => ({ ...r, devise }))}
                  tri={triPortefeuilleValide(reglages.triPortefeuille)}
                  surTri={(triPortefeuille) => setReglages((r) => ({ ...r, triPortefeuille }))}
                  periode={periodeValide(reglages.periodePortefeuille)}
                  surPeriode={(periodePortefeuille) => setReglages((r) => ({ ...r, periodePortefeuille }))}
                  theme={theme}
                  positions={positions}
                  surPositions={changerPositions}
                  surAjouterActifs={(nouveaux) => setActifs((prec) => [...prec, ...nouveaux.filter((n) => !prec.some((x) => cleActif(x) === cleActif(n)))])}
                  surOuvrir={ouvrirActif}
                  alertesExistantes={alertesPrixHaut}
                  surAlertesObjectifs={(objectifs) => {
                    changerAlertes((l) => [...l, ...objectifs.map((o): Alerte => ({ id: crypto.randomUUID(), actif: o.actif, condition: { type: "prix", sens: "au-dessus", seuil: o.prix }, statut: "armee", creeeLe: Date.now() }))]);
                    return objectifs.length;
                  }}
                />
              )}
              {onglet === "marche" && <VueMarche groupes={groupes} cotations={cotations} surOuvrir={ouvrirActif} />}
              {onglet === "alertes" && (
                <PanneauAlertes
                  actifs={actifs}
                  actifParDefaut={selection}
                  alertes={alertes}
                  surCreation={(a) => changerAlertes((l) => [...l, a])}
                  surModification={(m) => {
                    changerAlertes((l) => l.map((a) => (a.id === m.id ? m : a)));
                    prevenir(`Alerte modifiée et réarmée : ${m.actif.symbole} ${decrire(m.condition)}`);
                  }}
                  surRearmement={(id) => changerAlertes((l) => l.map((a) => (a.id === id ? { ...a, statut: "armee", creeeLe: Date.now(), declencheeLe: undefined, valeur: undefined } : a)))}
                  surSuppression={(id) => changerAlertes((l) => l.filter((a) => a.id !== id))}
                  surOuvrirActif={ouvrirActif}
                  editerId={alerteAEditer}
                  surEditionOuverte={() => setAlerteAEditer(null)}
                  derniereVerification={verification.derniereVerification}
                  erreur={verification.erreur}
                  periodeS={reglages.periodeAlertesS}
                />
              )}
              {onglet === "reglages" && <PanneauReglages reglages={reglages} surChangement={setReglages} maj={maj} />}
            </main>
          </div>
        </div>
      )}

      {info && <div className="menu-contextuel fixed bottom-4 right-4 z-50 px-4 py-2 text-sm">{info}</div>}
    </div>
  );
}
