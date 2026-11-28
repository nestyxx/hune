import { useCallback, useEffect, useRef, useState } from "react";
import { canauxAbonnes, diffuser, nomCanal } from "./canaux";
import { CONFIG_PAR_DEFAUT, ecrireConfig, ecrireEtatRecap, lireConfig, lireEtatRecap, type ConfigNotifications } from "./config";
import { creneauxDus, jourLocal } from "./recap";
import type { EntreesRecap } from "./recap-donnees";
import { preparerRecap } from "./recap-envoi";

const PERIODE_MS = 60_000;
/** Échecs successifs tolérés pour un même récap avant d'y renoncer pour la journée. */
const TENTATIVES_MAX = 3;

/**
 * Configuration des notifications (chargée puis enregistrée à chaque changement) et planificateur du récap quotidien.
 * Le planificateur tourne dans la page, qui reste vivante fenêtre fermée : il envoie le récap à l'heure choisie tant que
 * Hune est lancé. Si l'ordinateur était éteint ou en veille à l'heure prévue, le récap part au réveil (dans les 3 h).
 */
export function useNotifications(pret: boolean, lireEntrees: () => Omit<EntreesRecap, "depuisMs">, prevenir: (texte: string) => void) {
  const [config, setConfigEtat] = useState<ConfigNotifications>(CONFIG_PAR_DEFAUT);
  const [chargee, setChargee] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;
  const entreesRef = useRef(lireEntrees);
  entreesRef.current = lireEntrees;
  const prevenirRef = useRef(prevenir);
  prevenirRef.current = prevenir;

  useEffect(() => {
    let annule = false;
    void lireConfig().then((c) => {
      if (annule) return;
      configRef.current = c;
      setConfigEtat(c);
      setChargee(true);
    });
    return () => {
      annule = true;
    };
  }, []);

  const setConfig = useCallback((c: ConfigNotifications) => {
    configRef.current = c;
    setConfigEtat(c);
    void ecrireConfig(c);
  }, []);

  const enCours = useRef(false);
  const tentatives = useRef(new Map<string, number>());

  const tour = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const c = configRef.current;
      const maintenant = new Date();
      const etat = await lireEtatRecap();
      const dus = creneauxDus(c.recap, maintenant, etat);
      for (const creneau of dus) {
        if (!canauxAbonnes(c, "recap").length) continue; // aucun canal abonné : rien à envoyer, le créneau reste disponible
        const cle = `${jourLocal(maintenant)}-${creneau}`;
        try {
          const message = await preparerRecap(c, { ...entreesRef.current(), depuisMs: etat.dernierMs }, creneau);
          const resultats = await diffuser(c, message);
          const echecs = resultats.filter((r) => !r.ok);
          for (const e of echecs) prevenirRef.current(`Récap non envoyé sur ${nomCanal(e.canal)} : ${e.erreur}`);
          const essais = (tentatives.current.get(cle) ?? 0) + 1;
          tentatives.current.set(cle, essais);
          if (resultats.some((r) => r.ok) || essais >= TENTATIVES_MAX) {
            await ecrireEtatRecap({ jours: { ...etat.jours, [creneau]: jourLocal(maintenant) }, dernierMs: maintenant.getTime() });
            etat.jours[creneau] = jourLocal(maintenant);
          }
        } catch (e) {
          const essais = (tentatives.current.get(cle) ?? 0) + 1;
          tentatives.current.set(cle, essais);
          console.warn("Récap quotidien :", e);
          if (essais >= TENTATIVES_MAX) await ecrireEtatRecap({ jours: { ...etat.jours, [creneau]: jourLocal(maintenant) }, dernierMs: etat.dernierMs });
        }
      }
    } finally {
      enCours.current = false;
    }
  }, []);

  useEffect(() => {
    if (!pret || !chargee) return;
    const premier = setTimeout(() => void tour(), 45_000);
    const t = setInterval(() => void tour(), PERIODE_MS);
    return () => {
      clearTimeout(premier);
      clearInterval(t);
    };
  }, [pret, chargee, tour]);

  return { config, setConfig, configRef };
}
