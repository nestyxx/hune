import { useState } from "react";
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
  alertes: Alerte[];
  surCreation: (a: Alerte) => void;
  surRearmement: (id: string) => void;
  surSuppression: (id: string) => void;
  /** Ouvre le graphique de l'actif (clé `source:symbole`). */
  surOuvrirActif: (cle: string) => void;
  derniereVerification: number | null;
  erreur: string | null;
  periodeS: number;
}

/** Texte de la valeur mesurée au déclenchement, selon le type d'alerte. */
function texteValeur(a: Alerte): string {
  if (a.valeur == null) return "—";
  const t = a.condition.type;
  if (t === "variation") return `${a.valeur.toFixed(2).replace(".", ",")} %`;
  if (t === "rsi") return a.valeur.toFixed(1).replace(".", ",");
  return formaterPrix(a.valeur); // prix, croisements : cours au moment du signal
}

/** Onglet « Alertes » : formulaire de création + liste (armées / déclenchées avec bouton Réarmer). */
export function PanneauAlertes({ actifs, actifParDefaut, alertes, surCreation, surRearmement, surSuppression, surOuvrirActif, derniereVerification, erreur, periodeS }: Props) {
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
    surCreation({ id: crypto.randomUUID(), actif, condition, statut: "armee", creeeLe: Date.now() });
    setValeur("");
    setMessage(null);
  };

  const triees = [...alertes].sort((a, b) => Number(a.statut === "declenchee") - Number(b.statut === "declenchee") || b.creeeLe - a.creeeLe);

  const Liste = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
    <label className="flex flex-col gap-1 text-xs text-doux">
      {titre}
      {children}
    </label>
  );
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
    <div className="flex-1 overflow-auto p-4">
      <section className="mb-6 rounded-lg border border-ligne bg-carte p-4">
        <h2 className="m-0 mb-3 text-base font-semibold">Nouvelle alerte</h2>
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
              Créer l'alerte
            </button>
          </div>
        )}
        {(type === "franchissement" || type === "macd" || type === "moyennes") && (
          <p className="m-0 mt-2 text-xs text-doux">Ces alertes ne regardent que les bougies clôturées et ignorent tout croisement antérieur à leur création.</p>
        )}
        {message && <p className="m-0 mt-2 text-baisse">{message}</p>}
      </section>

      <h2 className="m-0 mb-2 text-base font-semibold">Alertes ({alertes.length})</h2>
      <p className="m-0 mb-3 text-xs text-doux">
        Vérification toutes les {periodeS} s
        {derniereVerification ? `, dernière à ${new Date(derniereVerification).toLocaleTimeString("fr-FR")}` : ""}. Une alerte se déclenche une seule fois, puis reste « déclenchée » jusqu'à ce que vous la réarmiez.
      </p>
      {erreur && <p className="mb-3 rounded border border-alerte/50 px-3 py-2 text-xs text-alerte">Dernière vérification incomplète : {erreur}</p>}
      {triees.length === 0 && <p className="text-doux">Aucune alerte pour l'instant.</p>}
      <ul className="m-0 list-none space-y-2 p-0">
        {triees.map((a) => (
          <li key={a.id} className={`flex items-center justify-between gap-3 rounded-lg border bg-carte px-4 py-3 ${a.statut === "declenchee" ? "border-alerte/60" : "border-ligne"}`}>
            <div className="min-w-0">
              <div className="font-semibold">
                <button className="bg-transparent p-0 font-semibold text-texte underline decoration-dotted underline-offset-2 hover:text-accent" title="Voir le graphique" onClick={() => surOuvrirActif(cleActif(a.actif))}>
                  {a.actif.symbole}
                </button>{" "}
                <span className="font-normal text-doux">· {decrire(a.condition)}</span>
              </div>
              <div className="text-xs text-doux">
                {a.statut === "declenchee" ? `Déclenchée le ${new Date(a.declencheeLe!).toLocaleString("fr-FR")} (valeur : ${texteValeur(a)})` : `Armée depuis le ${new Date(a.creeeLe).toLocaleString("fr-FR")}`}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs ${a.statut === "declenchee" ? "border-alerte/60 text-alerte" : "border-hausse/60 text-hausse"}`}>{a.statut === "declenchee" ? "Déclenchée" : "Armée"}</span>
              {a.statut === "declenchee" && (
                <button className="bouton" onClick={() => surRearmement(a.id)}>
                  Réarmer
                </button>
              )}
              <button className="bouton" title="Supprimer l'alerte" aria-label="Supprimer l'alerte" onClick={() => surSuppression(a.id)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
