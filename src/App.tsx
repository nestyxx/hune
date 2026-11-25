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
import type { Position } from "./portefeuille";
import { Rail, type Onglet } from "./rail";
import { PanneauReglages, REGLAGES_PAR_DEFAUT, type Reglages } from "./reglages";
import { listerCopies, type CopieAuto } from "./restauration";
import { restaurer } from "./sauvegarde";
import { ecrire, lire } from "./stockage";
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
}
const PREFS_INTERFACE: PrefsInterface = { menuReduit: false, listeVisible: true };

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

export default function App() {
  const [pret, setPret] = useState(false);
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
  const [intervalle, setIntervalle] = useState<Intervalle>("1h");
  const [profondeur, setProfondeur] = useState<Profondeur>("standard");
  const [indicateurs, setIndicateurs] = useState<Indicateurs>(INDICATEURS_PAR_DEFAUT);
  const [parametres, setParametres] = useState<Parametres>(PARAMETRES_PAR_DEFAUT);
  const [typeGraphique, setTypeGraphique] = useState<TypeGraphique>("bougies");
  const [echelleLog, setEchelleLog] = useState(false);
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
    void (async () => {
      const a = await lire<Actif[]>("actifs", []);
      setCategories(await lire<string[]>("categories", CATEGORIES_PAR_DEFAUT));
      setRepliees(await lire<string[]>("repliees", []));
      setTri(await lire<Tri>("tri", "manuel"));
      setIntervalle(await lire<Intervalle>("intervalle", "1h"));
      setProfondeur(await lire<Profondeur>("profondeur", "standard"));
      setEchelleLog(await lire<boolean>("echelleLog", false));
      setTypeGraphique(await lire<TypeGraphique>("typeGraphique", "bougies"));
      setIndicateurs({ ...INDICATEURS_PAR_DEFAUT, ...(await lire<Partial<Indicateurs>>("indicateurs", {})) });
      setParametres({ ...PARAMETRES_PAR_DEFAUT, ...(await lire<Partial<Parametres>>("parametres", {})) });
      setReglages({ ...REGLAGES_PAR_DEFAUT, ...(await lire<Partial<Reglages>>("reglages", {})) });
      setUi({ ...PREFS_INTERFACE, ...(await lire<Partial<PrefsInterface>>("interface", {})) });
      setAlertes(await lire<Alerte[]>("alertes", []));
      setPositions(await lire<Position[]>("positions", []));
      setActifs(a);
      setSelection(a[0] ? cleActif(a[0]) : null);
      setPret(true);
    })();
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
      changerAlertes((l) => l.map((a) => (a.id === alerte.id && a.statut === "armee" ? { ...a, statut: "declenchee", declencheeLe: Date.now(), valeur } : a)));
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
      const c = await cotationsActifs(actifs);
      if (!annule) setCotations((prec) => ({ ...prec, ...c }));
    };
    void tour();
    const t = setInterval(tour, PERIODE_COTATIONS_MS);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [actifs]);

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
                  positions={positions}
                  surPositions={changerPositions}
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
                  surModification={(m) => changerAlertes((l) => l.map((a) => (a.id === m.id ? m : a)))}
                  surRearmement={(id) => changerAlertes((l) => l.map((a) => (a.id === id ? { ...a, statut: "armee", creeeLe: Date.now(), declencheeLe: undefined, valeur: undefined } : a)))}
                  surSuppression={(id) => changerAlertes((l) => l.filter((a) => a.id !== id))}
                  surOuvrirActif={ouvrirActif}
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
