import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Chargeur } from "../composants";
import { ecrire, lire } from "../stockage";
import { messageErreur } from "./canaux";
import type { ConfigNotifications } from "./config";
import { construireInvite, interroger } from "./ia";
import { rassemblerDonnees, type EntreesRecap } from "./recap-donnees";
import { SECRETS, secretExiste } from "./secrets";

interface Analyse {
  texte: string;
  quand: number;
  modele: string;
  avecPortefeuille: boolean;
}

interface Props {
  config: ConfigNotifications;
  lireEntrees: () => Omit<EntreesRecap, "depuisMs">;
  /** Ouvre l'onglet Réglages pour configurer la clé. */
  surConfigurer: () => void;
}

/** Carte « Analyser le marché » de l'onglet Marché : envoie un résumé des cours suivis au modèle choisi et affiche sa réponse. */
export function PanneauAnalyseIA({ config, lireEntrees, surConfigurer }: Props) {
  const [cle, setCle] = useState<boolean | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void secretExiste(SECRETS.openrouter).then(setCle).catch(() => setCle(false));
    void lire<Analyse | null>("analyseIa", null).then((a) => a && typeof a.texte === "string" && setAnalyse(a));
  }, []);

  const lancer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const donnees = await rassemblerDonnees({ ...lireEntrees(), depuisMs: 0 });
      if (!donnees.marche.length && !donnees.fearGreed) throw new Error("Aucune cotation disponible pour le moment : réessayez dans quelques secondes.");
      const avecPortefeuille = config.ia.inclurePortefeuille && donnees.portefeuille != null;
      const { systeme, utilisateur } = construireInvite("marche", donnees, avecPortefeuille);
      const texte = await interroger(config.ia.modele, systeme, utilisateur);
      const a: Analyse = { texte, quand: Date.now(), modele: config.ia.modele, avecPortefeuille };
      setAnalyse(a);
      void ecrire("analyseIa", a);
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnCours(false);
  };

  return (
    <section className="carte-info p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-doux">
            <Sparkles size={15} className="text-accent" /> Analyse par IA
          </h2>
          <p className="m-0 mt-1 text-xs text-doux">
            Un résumé de l'ambiance du marché et de votre liste, rédigé par {config.ia.modele}. Indicatif : ce n'est pas un conseil financier.
            {config.ia.inclurePortefeuille ? " Votre portefeuille est inclus, en pourcentages seulement." : ""}
          </p>
        </div>
        {cle === false ? (
          <button className="bouton" onClick={surConfigurer}>
            Configurer OpenRouter…
          </button>
        ) : (
          <button className="bouton bouton-actif" disabled={enCours || cle === null} onClick={() => void lancer()}>
            {analyse ? "Actualiser l'analyse" : "Analyser le marché"}
          </button>
        )}
      </div>
      {enCours && <Chargeur className="mt-3" texte="Analyse en cours (jusqu'à une minute selon le modèle)…" />}
      {erreur && <p className="m-0 mt-3 text-xs text-baisse">{erreur}</p>}
      {analyse && !enCours && (
        <div className="mt-3 border-t border-ligne pt-3">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{analyse.texte}</div>
          <p className="m-0 mt-2 text-xs text-doux">
            Générée le {new Date(analyse.quand).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} · {analyse.modele}
          </p>
        </div>
      )}
    </section>
  );
}
