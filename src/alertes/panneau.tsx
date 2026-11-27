import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { IconeActif } from "../icone-actif";
import { nomAffiche } from "../noms-cryptos";
import { symboleAffiche } from "../noms-affiches";
import { EnTete } from "../composants";
import { cleActif, INTERVALLES, LIBELLE_INTERVALLE, type Actif, type Intervalle } from "../donnees/types";
import { formaterPrix } from "../format";
import { decrire, PERIODES_VARIATION, type Alerte, type Condition, type Moyenne, type PeriodeVariation, type SensCroisement } from "./moteur";

type TypeFormulaire = "prix" | "variation" | "rsi" | "franchissement" | "macd" | "moyennes";

const LIBELLE_TYPE: Record<TypeFormulaire, string> = {
  prix: "Prix",
  variation: "Variation en %",
  rsi: "RSI 14",
  franchissement: "Cours × moyenne mobile",
  macd: "Croisement MACD / signal",
  moyennes: "Croisement de moyennes (golden / death cross)",
};

interface Props {
  actifs: Actif[];
  /** Actif sélectionné dans la liste : proposé par défaut dans le formulaire. */
  actifParDefaut: string | null;
  /** Catégorie de la liste d'un actif (pour regrouper les alertes par catégorie). */
  categorieDe: (a: Actif) => string;
  alertes: Alerte[];
  surCreation: (a: Alerte) => void;
  /** Remplace l'alerte de même `id` (réarmée). */
  surModification: (a: Alerte) => void;
  surRearmement: (id: string) => void;
  surSuppression: (id: string) => void;
  /** Ouvre le graphique de l'actif (clé `source:symbole`). */
  surOuvrirActif: (cle: string) => void;
  /** Alerte à charger dans le formulaire dès l'ouverture (demandée depuis le graphique). */
  editerId: string | null;
  /** Appelé une fois l'alerte chargée, pour que la demande ne se rejoue pas. */
  surEditionOuverte: () => void;
  derniereVerification: number | null;
  erreur: string | null;
  periodeS: number;
}

/**
 * Champ étiqueté du formulaire. Défini ICI, hors du composant : déclaré dans `PanneauAlertes`, il changerait d'identité à chaque
 * rendu, React démonterait les champs à chaque frappe et ils perdraient le focus après un seul caractère.
 */
function Liste({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-doux">
      {titre}
      {children}
    </label>
  );
}

type FiltreEtat = "toutes" | "armees" | "declenchees";
type Groupement = "actif" | "categorie" | "etat" | "aucun";
type TriAlertes = "recentes" | "actif";
const LIBELLE_GROUPEMENT: Record<Groupement, string> = { actif: "Par actif", categorie: "Par catégorie", etat: "Par état", aucun: "Sans groupe" };

/** D'où vient l'alerte : saisie à la main, ou créée automatiquement par l'objectif (TP) ou le stop loss d'un lot du portefeuille. */
const origine = (a: Alerte) => (a.tpLot ? { texte: "TP", aide: "Créée par l'objectif (TP) d'une position du portefeuille" } : a.slLot ? { texte: "Stop", aide: "Créée par le stop loss d'une position du portefeuille" } : null);

/** Texte de la valeur mesurée au déclenchement, selon le type d'alerte. */
function texteValeur(a: Alerte): string {
  if (a.valeur == null) return "—";
  const t = a.condition.type;
  if (t === "variation") return `${a.valeur.toFixed(2).replace(".", ",")} %`;
  if (t === "rsi") return a.valeur.toFixed(1).replace(".", ",");
  return formaterPrix(a.valeur); // prix, croisements : cours au moment du signal
}

/** Onglet « Alertes » : formulaire de création + liste (armées / déclenchées avec bouton Réarmer). */
export function PanneauAlertes({ actifs, actifParDefaut, categorieDe, alertes, surCreation, surModification, surRearmement, surSuppression, surOuvrirActif, editerId, surEditionOuverte, derniereVerification, erreur, periodeS }: Props) {
  const [cle, setCle] = useState<string>("");
  const [type, setType] = useState<TypeFormulaire>("prix");
  const [sensPrix, setSensPrix] = useState<"au-dessus" | "en-dessous">("au-dessus");
  const [sensVar, setSensVar] = useState<"hausse" | "baisse">("hausse");
  const [sensCroi, setSensCroi] = useState<SensCroisement>("haussier");
  const [valeur, setValeur] = useState("");
  const [periode, setPeriode] = useState<PeriodeVariation>("24h");
  const [intervalle, setIntervalle] = useState<Intervalle>("1h");
  const [moyenne, setMoyenne] = useState<Moyenne>("sma");
  const [periodeMoy, setPeriodeMoy] = useState("50");
  const [rapide, setRapide] = useState("50");
  const [lente, setLente] = useState("200");
  const [message, setMessage] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const formulaire = useRef<HTMLElement>(null);
  // Liste : le formulaire reste replié tant qu'on n'en a pas besoin ; filtres, regroupement et tri se retiennent d'une visite à l'autre.
  const [formOuvert, setFormOuvert] = useState(false);
  const [filtre, setFiltre] = useState<FiltreEtat>("toutes");
  const [recherche, setRecherche] = useState("");
  const [groupement, setGroupement] = useState<Groupement>(() => (localStorage.getItem("hune.alertes.groupement") as Groupement) || "actif");
  const [tri, setTri] = useState<TriAlertes>(() => (localStorage.getItem("hune.alertes.tri") as TriAlertes) || "recentes");
  const [repliees, setRepliees] = useState<string[]>([]);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  useEffect(() => localStorage.setItem("hune.alertes.groupement", groupement), [groupement]);
  useEffect(() => localStorage.setItem("hune.alertes.tri", tri), [tri]);
  useEffect(() => {
    if (!confirmerSuppression) return;
    const t = setTimeout(() => setConfirmerSuppression(false), 4000);
    return () => clearTimeout(t);
  }, [confirmerSuppression]);

  const cleEffective = cle || actifParDefaut || (actifs[0] ? cleActif(actifs[0]) : "");
  const nombre = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")); // accepte la virgule décimale

  const creer = () => {
    const actif = actifs.find((a) => cleActif(a) === cleEffective);
    if (!actif) return setMessage("Choisissez un actif de la liste.");
    let condition: Condition;
    switch (type) {
      case "prix":
      case "rsi":
      case "variation": {
        const n = nombre(valeur);
        if (!valeur.trim() || !Number.isFinite(n)) return setMessage("Saisissez un nombre.");
        if (type === "variation" && n <= 0) return setMessage("Le pourcentage doit être positif (le sens est choisi à côté).");
        if (type === "prix" && n <= 0) return setMessage("Le seuil de prix doit être positif.");
        if (type === "rsi" && (n < 0 || n > 100)) return setMessage("Le RSI est compris entre 0 et 100.");
        condition = type === "prix" ? { type, sens: sensPrix, seuil: n } : type === "variation" ? { type, sens: sensVar, pct: n, periode } : { type, sens: sensPrix, seuil: n, intervalle };
        break;
      }
      case "franchissement": {
        const p = Math.round(nombre(periodeMoy));
        if (!Number.isFinite(p) || p < 2 || p > 400) return setMessage("La période de la moyenne doit être comprise entre 2 et 400.");
        condition = { type: "franchissement", moyenne, periode: p, sens: sensPrix, intervalle };
        break;
      }
      case "macd":
        condition = { type: "croisement", modele: "macd", sens: sensCroi, intervalle };
        break;
      case "moyennes": {
        const r = Math.round(nombre(rapide));
        const l = Math.round(nombre(lente));
        if (![r, l].every((x) => Number.isFinite(x) && x >= 2 && x <= 400) || r >= l) return setMessage("Indiquez deux périodes entre 2 et 400, la rapide étant plus courte que la lente.");
        condition = { type: "croisement", modele: "moyennes", moyenne, rapide: r, lente: l, sens: sensCroi, intervalle };
        break;
      }
    }
    // Une alerte modifiée est réarmée : l'ancien déclenchement ne vaut plus pour la nouvelle condition.
    const alerte: Alerte = { id: edition ?? crypto.randomUUID(), actif, condition, statut: "armee", creeeLe: Date.now() };
    if (edition) surModification(alerte);
    else surCreation(alerte);
    setEdition(null);
    setFormOuvert(false);
    setValeur("");
    setMessage(null);
  };

  /** Recharge une alerte existante dans le formulaire pour la modifier. */
  const charger = (a: Alerte) => {
    const c = a.condition;
    setEdition(a.id);
    setFormOuvert(true);
    setCle(cleActif(a.actif));
    setMessage(null);
    switch (c.type) {
      case "prix":
        setType("prix");
        setSensPrix(c.sens);
        setValeur(String(c.seuil).replace(".", ","));
        break;
      case "variation":
        setType("variation");
        setSensVar(c.sens);
        setPeriode(c.periode);
        setValeur(String(c.pct).replace(".", ","));
        break;
      case "rsi":
        setType("rsi");
        setSensPrix(c.sens);
        setIntervalle(c.intervalle);
        setValeur(String(c.seuil).replace(".", ","));
        break;
      case "franchissement":
        setType("franchissement");
        setSensPrix(c.sens);
        setMoyenne(c.moyenne);
        setPeriodeMoy(String(c.periode));
        setIntervalle(c.intervalle);
        break;
      case "croisement":
        setSensCroi(c.sens);
        setIntervalle(c.intervalle);
        if (c.modele === "macd") setType("macd");
        else {
          setType("moyennes");
          setMoyenne(c.moyenne);
          setRapide(String(c.rapide));
          setLente(String(c.lente));
        }
        break;
    }
    formulaire.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Modification demandée depuis le graphique (double-clic sur une alerte, clic droit) : le formulaire s'ouvre sur cette alerte.
  useEffect(() => {
    const a = editerId ? alertes.find((x) => x.id === editerId) : null;
    if (!a) return;
    charger(a);
    surEditionOuverte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editerId]);

  const annulerEdition = () => {
    setEdition(null);
    setFormOuvert(false);
    setValeur("");
    setMessage(null);
  };

  const nbArmees = alertes.filter((x) => x.statut === "armee").length;
  const nbDeclenchees = alertes.length - nbArmees;
  /** Alertes affichées (filtre d'état et recherche), les déclenchées d'abord puis selon le tri choisi. */
  const visibles = (() => {
    const q = recherche.trim().toLowerCase();
    const liste = alertes.filter((a) => (filtre === "toutes" || (filtre === "armees") === (a.statut === "armee")) && (!q || `${a.actif.symbole} ${nomAffiche(a.actif)} ${decrire(a.condition)}`.toLowerCase().includes(q)));
    return liste.sort(
      (a, b) => Number(b.statut === "declenchee") - Number(a.statut === "declenchee") || (tri === "actif" ? symboleAffiche(a.actif).localeCompare(symboleAffiche(b.actif), "fr") || b.creeeLe - a.creeeLe : (b.declencheeLe ?? b.creeeLe) - (a.declencheeLe ?? a.creeeLe)),
    );
  })();
  /** Groupes affichés ; ceux qui contiennent une alerte déclenchée passent en premier. */
  const groupes = (() => {
    if (groupement === "aucun") return [{ cle: "", titre: "", actif: undefined as Actif | undefined, alertes: visibles }];
    const m = new Map<string, { cle: string; titre: string; actif?: Actif; alertes: Alerte[] }>();
    for (const a of visibles) {
      const cle = groupement === "actif" ? cleActif(a.actif) : groupement === "categorie" ? categorieDe(a.actif) : a.statut === "declenchee" ? "Déclenchées" : "Armées";
      const g = m.get(cle) ?? { cle, titre: groupement === "actif" ? symboleAffiche(a.actif) : cle, actif: groupement === "actif" ? a.actif : undefined, alertes: [] };
      g.alertes.push(a);
      m.set(cle, g);
    }
    const aDeclenchee = (g: { alertes: Alerte[] }) => Number(g.alertes.some((a) => a.statut === "declenchee"));
    return [...m.values()].sort((x, y) => (groupement === "etat" ? Number(y.cle === "Déclenchées") - Number(x.cle === "Déclenchées") : aDeclenchee(y) - aDeclenchee(x) || x.titre.localeCompare(y.titre, "fr")));
  })();

  const choixIntervalle = (
    <Liste titre="Intervalle">
      <select className="champ" value={intervalle} onChange={(e) => setIntervalle(e.target.value as Intervalle)}>
        {INTERVALLES.map((i) => (
          <option key={i} value={i}>
            {LIBELLE_INTERVALLE[i]}
          </option>
        ))}
      </select>
    </Liste>
  );
  const choixMoyenne = (
    <Liste titre="Moyenne">
      <select className="champ" value={moyenne} onChange={(e) => setMoyenne(e.target.value as Moyenne)}>
        <option value="sma">SMA (simple)</option>
        <option value="ema">EMA (exponentielle)</option>
      </select>
    </Liste>
  );
  const champNombre = (titre: string, v: string, set: (s: string) => void, large = "w-36") => (
    <Liste titre={titre}>
      <input className={`champ ${large}`} inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === "Enter" && creer()} />
    </Liste>
  );

  return (
    <div className="apparait flex-1 overflow-auto p-6">
      <EnTete titre="Alertes" sousTitre={`${nbArmees} armée${nbArmees > 1 ? "s" : ""}, ${nbDeclenchees} déclenchée${nbDeclenchees > 1 ? "s" : ""} · une alerte se déclenche une seule fois, puis se réarme d'un clic.`} />
      {!(formOuvert || edition) && (
        <button className="bouton bouton-actif mb-4 mt-4" onClick={() => setFormOuvert(true)}>
          <Plus size={14} /> Nouvelle alerte
        </button>
      )}
      <section ref={formulaire} className={`mb-5 mt-5 rounded-2xl border bg-carte p-5 ${edition ? "border-accent" : "border-ligne"} ${formOuvert || edition ? "" : "hidden"}`}>
        <h2 className="m-0 mb-3 text-base font-semibold">{edition ? "Modifier l'alerte" : "Nouvelle alerte"}</h2>
        {actifs.length === 0 ? (
          <p className="m-0 text-doux">Ajoutez d'abord un actif à la liste pour créer une alerte.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Liste titre="Actif">
              <select className="champ max-w-48" value={cleEffective} onChange={(e) => setCle(e.target.value)}>
                {actifs.map((a) => (
                  <option key={cleActif(a)} value={cleActif(a)}>
                    {a.symbole} — {a.nom.slice(0, 24)}
                  </option>
                ))}
              </select>
            </Liste>
            <Liste titre="Condition">
              <select className="champ" value={type} onChange={(e) => setType(e.target.value as TypeFormulaire)}>
                {(Object.keys(LIBELLE_TYPE) as TypeFormulaire[]).map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_TYPE[t]}
                  </option>
                ))}
              </select>
            </Liste>

            {type === "variation" && (
              <>
                <Liste titre="Sens">
                  <select className="champ" value={sensVar} onChange={(e) => setSensVar(e.target.value as "hausse" | "baisse")}>
                    <option value="hausse">Hausse d'au moins</option>
                    <option value="baisse">Baisse d'au moins</option>
                  </select>
                </Liste>
                <Liste titre="Sur">
                  <select className="champ" value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeVariation)}>
                    {Object.keys(PERIODES_VARIATION).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Liste>
                {champNombre("Variation (%)", valeur, setValeur)}
              </>
            )}
            {(type === "prix" || type === "rsi") && (
              <>
                <Liste titre="Sens">
                  <select className="champ" value={sensPrix} onChange={(e) => setSensPrix(e.target.value as "au-dessus" | "en-dessous")}>
                    <option value="au-dessus">Au-dessus de</option>
                    <option value="en-dessous">En-dessous de</option>
                  </select>
                </Liste>
                {type === "rsi" && choixIntervalle}
                {champNombre(type === "rsi" ? "Seuil RSI (0–100)" : "Seuil de prix", valeur, setValeur)}
              </>
            )}
            {type === "franchissement" && (
              <>
                <Liste titre="Le cours passe">
                  <select className="champ" value={sensPrix} onChange={(e) => setSensPrix(e.target.value as "au-dessus" | "en-dessous")}>
                    <option value="au-dessus">au-dessus de</option>
                    <option value="en-dessous">en-dessous de</option>
                  </select>
                </Liste>
                {choixMoyenne}
                {champNombre("Période", periodeMoy, setPeriodeMoy, "w-20")}
                {choixIntervalle}
              </>
            )}
            {(type === "macd" || type === "moyennes") && (
              <>
                <Liste titre="Sens du croisement">
                  <select className="champ" value={sensCroi} onChange={(e) => setSensCroi(e.target.value as SensCroisement)}>
                    <option value="haussier">Haussier (par le haut)</option>
                    <option value="baissier">Baissier (par le bas)</option>
                  </select>
                </Liste>
                {type === "moyennes" && (
                  <>
                    {choixMoyenne}
                    {champNombre("Rapide", rapide, setRapide, "w-20")}
                    {champNombre("Lente", lente, setLente, "w-20")}
                  </>
                )}
                {choixIntervalle}
              </>
            )}

            <button className="bouton bouton-actif" onClick={creer}>
              {edition ? "Enregistrer" : "Créer l'alerte"}
            </button>
            <button className="bouton" onClick={annulerEdition}>
              Annuler
            </button>
          </div>
        )}
        {(type === "franchissement" || type === "macd" || type === "moyennes") && (
          <p className="m-0 mt-2 text-xs text-doux">Ces alertes ne regardent que les bougies clôturées et ignorent tout croisement antérieur à leur création.</p>
        )}
        {message && <p className="m-0 mt-2 text-baisse">{message}</p>}
      </section>

      {erreur && <p className="mb-3 rounded-xl border border-alerte/50 px-3 py-2 text-xs text-alerte">Dernière vérification incomplète : {erreur}</p>}

      {alertes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="segments" role="group" aria-label="Filtrer par état">
            {([["toutes", `Toutes (${alertes.length})`], ["armees", `Armées (${nbArmees})`], ["declenchees", `Déclenchées (${nbDeclenchees})`]] as const).map(([id, libelle]) => (
              <button key={id} aria-pressed={filtre === id} className="segment" onClick={() => setFiltre(id)}>
                {libelle}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-doux" aria-hidden />
            <input className="champ w-44 !pl-8" placeholder="Filtrer…" aria-label="Filtrer les alertes" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <select className="champ" aria-label="Regrouper" value={groupement} onChange={(e) => setGroupement(e.target.value as Groupement)}>
            {(Object.keys(LIBELLE_GROUPEMENT) as Groupement[]).map((g) => (
              <option key={g} value={g}>
                {LIBELLE_GROUPEMENT[g]}
              </option>
            ))}
          </select>
          <select className="champ" aria-label="Trier" value={tri} onChange={(e) => setTri(e.target.value as TriAlertes)}>
            <option value="recentes">Plus récentes d'abord</option>
            <option value="actif">Actif A → Z</option>
          </select>
          {nbDeclenchees > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <button className="bouton" title="Réarme toutes les alertes déclenchées" onClick={() => alertes.filter((a) => a.statut === "declenchee").forEach((a) => surRearmement(a.id))}>
                <RotateCcw size={14} /> Tout réarmer
              </button>
              <button
                className={`bouton ${confirmerSuppression ? "bouton-actif" : ""}`}
                title="Supprime les alertes déclenchées (les alertes TP / stop supprimées ne sont pas recréées)"
                onClick={() => {
                  if (!confirmerSuppression) return setConfirmerSuppression(true);
                  setConfirmerSuppression(false);
                  alertes.filter((a) => a.statut === "declenchee").forEach((a) => surSuppression(a.id));
                }}
              >
                <X size={14} /> {confirmerSuppression ? `Confirmer (${nbDeclenchees})` : "Supprimer les déclenchées"}
              </button>
            </span>
          )}
        </div>
      )}

      {alertes.length === 0 && <p className="text-doux">Aucune alerte pour l'instant.</p>}
      {alertes.length > 0 && visibles.length === 0 && <p className="text-doux">Aucune alerte ne correspond à ce filtre.</p>}
      <div className="space-y-3">
        {groupes.map((g) => {
          const replie = !!g.cle && repliees.includes(g.cle);
          const nbDecl = g.alertes.filter((a) => a.statut === "declenchee").length;
          return (
            <section key={g.cle || "tout"} className="overflow-hidden rounded-2xl border border-ligne bg-carte">
              {g.cle && (
                <button className="flex w-full items-center gap-2 bg-transparent px-3 py-2 text-left text-texte hover:bg-fond" onClick={() => setRepliees(replie ? repliees.filter((c) => c !== g.cle) : [...repliees, g.cle])}>
                  {replie ? <ChevronRight size={14} className="text-doux" /> : <ChevronDown size={14} className="text-doux" />}
                  {g.actif && <IconeActif actif={g.actif} taille={20} />}
                  <span className="font-semibold">{g.titre}</span>
                  {g.actif && <span className="min-w-0 truncate text-xs text-doux">{nomAffiche(g.actif)}</span>}
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-doux">
                    {nbDecl > 0 && <span className="rounded-full bg-alerte px-1.5 text-[10px] font-semibold text-white">{nbDecl} déclenchée{nbDecl > 1 ? "s" : ""}</span>}
                    {g.alertes.length} alerte{g.alertes.length > 1 ? "s" : ""}
                  </span>
                </button>
              )}
              {!replie && (
                <ul className="m-0 list-none p-0">
                  {g.alertes.map((a) => {
                    const o = origine(a);
                    const declenchee = a.statut === "declenchee";
                    return (
                      <li key={a.id} className={`group flex items-center gap-3 border-t border-ligne px-3 py-1.5 first:border-t-0 hover:bg-fond/60 ${g.cle ? "" : "first:border-t-0"}`}>
                        {groupement !== "actif" && (
                          <button className="flex w-28 shrink-0 items-center gap-1.5 bg-transparent p-0 text-left font-semibold text-texte hover:text-accent" title="Voir le graphique" onClick={() => surOuvrirActif(cleActif(a.actif))}>
                            <IconeActif actif={a.actif} taille={18} />
                            <span className="truncate">{symboleAffiche(a.actif)}</span>
                          </button>
                        )}
                        <span className={`h-2 w-2 shrink-0 rounded-full ${declenchee ? "bg-alerte" : "bg-hausse"}`} title={declenchee ? "Déclenchée" : "Armée"} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{decrire(a.condition)}</div>
                          <div className="truncate text-xs text-doux">{declenchee ? `Déclenchée le ${new Date(a.declencheeLe!).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · valeur ${texteValeur(a)}` : `Armée depuis le ${new Date(a.creeeLe).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}</div>
                        </div>
                        {o && (
                          <span className="shrink-0 rounded-full border border-ligne px-2 text-[11px] text-doux" title={o.aide}>
                            {o.texte}
                          </span>
                        )}
                        <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          {declenchee && (
                            <button className="bouton-icone" title="Réarmer l'alerte" aria-label="Réarmer l'alerte" onClick={() => surRearmement(a.id)}>
                              <RotateCcw size={15} />
                            </button>
                          )}
                          <button className="bouton-icone" title="Modifier l'alerte" aria-label="Modifier l'alerte" onClick={() => charger(a)}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className="bouton-icone"
                            title="Supprimer l'alerte"
                            aria-label="Supprimer l'alerte"
                            onClick={() => {
                              if (edition === a.id) annulerEdition();
                              surSuppression(a.id);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="m-0 mt-4 text-xs text-doux">
        Vérification toutes les {periodeS} s{derniereVerification ? `, dernière à ${new Date(derniereVerification).toLocaleTimeString("fr-FR")}` : ""}. Une alerte se déclenche une seule fois, puis reste « déclenchée » jusqu'à ce que vous la réarmiez.
      </p>
    </div>
  );
}
