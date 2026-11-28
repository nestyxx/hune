import { lire, ecrire } from "../stockage";

/**
 * Configuration des notifications hors de l'ordinateur (ntfy, e-mail, SMS, Telegram…), du récap quotidien et de l'IA.
 *
 * Elle est rangée sous sa propre clé (`notifications`), HORS de l'export, de la sauvegarde et de la synchronisation :
 * elle reste sur ce poste. Ainsi deux PC synchronisés n'envoient pas chacun la même notification, et l'adresse d'un
 * serveur ou d'un destinataire ne part pas dans un dossier OneDrive. Les secrets (mots de passe, jetons, clés d'API)
 * ne sont même pas ici : ils vivent dans le coffre du système (voir `secrets.ts`).
 */

export type CanalId = "ntfy" | "mail" | "smsBrevo" | "smsOvh" | "telegram" | "discord" | "webhook";
export type Evenement = "alertes" | "niveaux" | "recap";
export type Creneau = "matin" | "soir";

/** Ce qu'un canal reçoit : il est actif ou non, et abonné à chaque type d'événement. */
export interface Abonnements {
  actif: boolean;
  /** Alertes de prix et d'indicateurs. */
  alertes: boolean;
  /** Objectifs (TP) et stop loss du portefeuille. */
  niveaux: boolean;
  /** Récap quotidien. */
  recap: boolean;
}

export interface ConfigNotifications {
  ntfy: Abonnements & { serveur: string; sujet: string; avecJeton: boolean };
  mail: Abonnements & { serveur: string; port: number; securite: "ssl" | "starttls" | "aucune"; utilisateur: string; expediteur: string; destinataires: string };
  smsBrevo: Abonnements & { expediteur: string; destinataires: string };
  smsOvh: Abonnements & { region: "eu" | "ca"; cleApplication: string; service: string; expediteur: string; destinataires: string };
  telegram: Abonnements & { chatId: string };
  discord: Abonnements;
  webhook: Abonnements & { format: "texte" | "json" };
  recap: { matin: { actif: boolean; heure: string }; soir: { actif: boolean; heure: string }; commentaireIa: boolean };
  ia: { modele: string; inclurePortefeuille: boolean };
}

const ABO = { actif: false, alertes: true, niveaux: true, recap: true };
/** Les SMS sont payants : le récap n'y est pas abonné par défaut. */
const ABO_SMS = { ...ABO, recap: false };

export const CONFIG_PAR_DEFAUT: ConfigNotifications = {
  ntfy: { ...ABO, serveur: "https://ntfy.sh", sujet: "", avecJeton: false },
  mail: { ...ABO, serveur: "", port: 587, securite: "starttls", utilisateur: "", expediteur: "", destinataires: "" },
  smsBrevo: { ...ABO_SMS, expediteur: "Hune", destinataires: "" },
  smsOvh: { ...ABO_SMS, region: "eu", cleApplication: "", service: "", expediteur: "", destinataires: "" },
  telegram: { ...ABO, chatId: "" },
  discord: { ...ABO },
  webhook: { ...ABO, format: "texte" },
  recap: { matin: { actif: true, heure: "07:00" }, soir: { actif: false, heure: "20:00" }, commentaireIa: false },
  ia: { modele: "openrouter/auto", inclurePortefeuille: false },
};

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Complète une configuration lue sur le disque avec les valeurs par défaut (champs ajoutés par une version plus récente). */
export function fusionnerConfig(lue: unknown, defaut: unknown = CONFIG_PAR_DEFAUT): ConfigNotifications {
  const f = (a: unknown, b: unknown): unknown => {
    if (!estObjet(a)) return b ?? a;
    const sortie: Record<string, unknown> = {};
    for (const cle of Object.keys(a)) {
      const valeurA = a[cle];
      const valeurB = estObjet(b) ? b[cle] : undefined;
      sortie[cle] = estObjet(valeurA) ? f(valeurA, valeurB ?? {}) : valeurB !== undefined && typeof valeurB === typeof valeurA ? valeurB : valeurA;
    }
    return sortie;
  };
  return f(defaut, lue) as ConfigNotifications;
}

export const lireConfig = async (): Promise<ConfigNotifications> => fusionnerConfig(await lire<unknown>("notifications", {}));
export const ecrireConfig = (c: ConfigNotifications) => ecrire("notifications", c);

/** Jour déjà traité pour chaque créneau du récap (AAAA-MM-JJ, heure locale) et instant du dernier récap (ms). */
export interface EtatRecap {
  jours: Partial<Record<Creneau, string>>;
  dernierMs: number;
}
export const lireEtatRecap = async (): Promise<EtatRecap> => {
  const e = await lire<Partial<EtatRecap>>("notifications-etat", {});
  return { jours: e.jours ?? {}, dernierMs: typeof e.dernierMs === "number" ? e.dernierMs : 0 };
};
export const ecrireEtatRecap = (e: EtatRecap) => ecrire("notifications-etat", e);
