import { useCallback, useEffect, useRef, useState } from "react";
import { lire, ecrire } from "../stockage";
import { memeValeur } from "./fusion";
import { choisirDossier, entreesDossier, synchroDisponible } from "./io";
import { synchroniser, type EtatSync } from "./moteur";

/** Réglages de synchronisation de cet appareil. Gardés dans le fichier de données local, jamais exportés ni synchronisés. */
export interface ConfigSync {
  /** Dossier choisi (Drive, OneDrive, NAS…) ; null = synchronisation désactivée. */
  dossier: string | null;
  motDePasse: string;
  /** Identifiant de cet appareil (informatif, écrit dans le fichier). */
  appareil: string;
}

export type PhaseSync = "inactive" | "en-cours" | "ok" | "erreur";
export interface StatutSync {
  phase: PhaseSync;
  derniere: number | null;
  message: string | null;
}

const CONFIG_VIDE: ConfigSync = { dossier: null, motDePasse: "", appareil: "" };
const DELAI_MODIFICATION_MS = 3000;
const INTERVALLE_MS = 60_000;

/**
 * Synchronise la liste, le portefeuille, les alertes et les tracés avec un fichier placé dans un dossier que l'utilisateur
 * synchronise déjà (Drive, OneDrive, iCloud, NAS…) : au démarrage, 3 s après une modification, chaque minute et au retour sur la fenêtre.
 * `appliquer` reçoit l'état fusionné quand un autre appareil a changé quelque chose.
 */
export function useSynchro(pret: boolean, etatLocal: EtatSync, appliquer: (e: EtatSync) => void) {
  const [config, setConfig] = useState<ConfigSync | null>(null);
  const [statut, setStatut] = useState<StatutSync>({ phase: "inactive", derniere: null, message: null });

  const configRef = useRef<ConfigSync | null>(null);
  const baseRef = useRef<EtatSync | null>(null);
  const localRef = useRef(etatLocal);
  localRef.current = etatLocal;
  const dernierLocalRef = useRef<EtatSync | null>(null);
  const modifieLocalLeRef = useRef(0);
  const enCoursRef = useRef(false);
  const aRelancerRef = useRef(false);
  const ancienMotDePasseRef = useRef<string | undefined>(undefined);
  const forcerRef = useRef(false);
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des réglages et du dernier état synchronisé.
  useEffect(() => {
    if (!pret) return;
    void (async () => {
      const c = { ...CONFIG_VIDE, ...(await lire<Partial<ConfigSync>>("sync", {})) };
      if (!c.appareil) {
        c.appareil = crypto.randomUUID();
        await ecrire("sync", c);
      }
      baseRef.current = await lire<EtatSync | null>("syncBase", null);
      configRef.current = c;
      setConfig(c);
    })();
  }, [pret]);

  const executer = useCallback(async () => {
    const c = configRef.current;
    if (!c?.dossier || !synchroDisponible()) return;
    if (enCoursRef.current) {
      aRelancerRef.current = true;
      return;
    }
    enCoursRef.current = true;
    setStatut((s) => ({ ...s, phase: "en-cours", message: null }));
    try {
      const instantane = localRef.current;
      const r = await synchroniser(entreesDossier(c.dossier), {
        local: instantane,
        base: baseRef.current,
        appareil: c.appareil,
        modifieLocalLe: modifieLocalLeRef.current,
        motDePasse: c.motDePasse,
        motDePasseLecture: ancienMotDePasseRef.current,
        forcerEcriture: forcerRef.current,
        maintenant: Date.now(),
      });
      // L'utilisateur a modifié ses données pendant la synchronisation : on n'applique rien, la suivante repartira de son état.
      if (!memeValeur(localRef.current, instantane)) {
        aRelancerRef.current = true;
      } else {
        baseRef.current = r.etat;
        await ecrire("syncBase", r.etat);
        ancienMotDePasseRef.current = undefined;
        forcerRef.current = false;
        if (r.appliquer) {
          dernierLocalRef.current = r.etat; // ce changement vient de la synchronisation : il ne compte pas comme une modification locale
          appliquerRef.current(r.etat);
        }
        setStatut({ phase: "ok", derniere: Date.now(), message: null });
      }
    } catch (e) {
      setStatut((s) => ({ ...s, phase: "erreur", message: e instanceof Error ? e.message : String(e) }));
    } finally {
      enCoursRef.current = false;
      if (aRelancerRef.current) {
        aRelancerRef.current = false;
        setTimeout(() => void executer(), 500);
      }
    }
  }, []);

  // Une modification locale déclenche une synchronisation après un court délai.
  useEffect(() => {
    if (!pret || !config) return;
    if (dernierLocalRef.current === null) {
      dernierLocalRef.current = etatLocal;
      return;
    }
    if (memeValeur(dernierLocalRef.current, etatLocal)) return;
    dernierLocalRef.current = etatLocal;
    modifieLocalLeRef.current = Date.now();
    if (!config.dossier) return;
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => void executer(), DELAI_MODIFICATION_MS);
  }, [etatLocal, pret, config, executer]);

  // Au démarrage, périodiquement et au retour sur la fenêtre.
  useEffect(() => {
    if (!pret || !config?.dossier) return;
    void executer();
    const t = setInterval(() => void executer(), INTERVALLE_MS);
    const retour = () => document.visibilityState === "visible" && void executer();
    document.addEventListener("visibilitychange", retour);
    window.addEventListener("focus", retour);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", retour);
      window.removeEventListener("focus", retour);
    };
  }, [pret, config?.dossier, executer]);

  const enregistrer = useCallback(async (c: ConfigSync) => {
    configRef.current = c;
    setConfig(c);
    await ecrire("sync", c);
  }, []);

  return {
    disponible: synchroDisponible(),
    config,
    statut,
    /** Choisit le dossier de synchronisation et lance aussitôt une première synchronisation. */
    async choisir() {
      const dossier = await choisirDossier();
      if (!dossier || !configRef.current) return;
      baseRef.current = null; // nouveau dossier : première synchronisation (union des données, rien n'est supprimé)
      await ecrire("syncBase", null);
      await enregistrer({ ...configRef.current, dossier });
      setTimeout(() => void executer(), 0);
    },
    /** Définit (ou retire, avec une chaîne vide) le mot de passe de chiffrement ; le fichier est réécrit avec le nouveau. */
    async definirMotDePasse(motDePasse: string) {
      const c = configRef.current;
      if (!c || c.motDePasse === motDePasse) return;
      ancienMotDePasseRef.current = c.motDePasse;
      forcerRef.current = true;
      await enregistrer({ ...c, motDePasse });
      setTimeout(() => void executer(), 0);
    },
    async arreter() {
      if (!configRef.current) return;
      baseRef.current = null;
      await ecrire("syncBase", null);
      await enregistrer({ ...configRef.current, dossier: null });
      setStatut({ phase: "inactive", derniere: null, message: null });
    },
    maintenant: () => void executer(),
  };
}

