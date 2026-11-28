import type { CanalId, ConfigNotifications, Evenement } from "./config";
import { SECRETS } from "./secrets";

/** Un message prêt à partir sur n'importe quel canal. */
export interface Message {
  evenement: Evenement;
  titre: string;
  /** Corps complet (texte brut, plusieurs lignes). */
  texte: string;
  /** Version très courte pour les SMS (160 caractères au plus une fois nettoyée). */
  court: string;
  /** Version HTML pour l'e-mail ; à défaut, le texte brut. */
  html?: string;
}

export interface ResultatEnvoi {
  canal: CanalId;
  ok: boolean;
  erreur?: string;
}

export const CANAUX: { id: CanalId; nom: string; aide: string }[] = [
  { id: "ntfy", nom: "ntfy", aide: "Notification push gratuite sur téléphone, via ntfy.sh ou votre propre serveur." },
  { id: "mail", nom: "E-mail (SMTP)", aide: "Votre serveur de messagerie : Gmail, OVH, Brevo, Synology MailPlus…" },
  { id: "smsBrevo", nom: "SMS Brevo", aide: "SMS transactionnels par l'API Brevo (crédits SMS requis)." },
  { id: "smsOvh", nom: "SMS OVH", aide: "SMS par l'API OVH (compte SMS OVH et clés d'application)." },
  { id: "telegram", nom: "Telegram", aide: "Message de votre propre bot Telegram." },
  { id: "discord", nom: "Discord", aide: "Message dans un salon, par webhook." },
  { id: "webhook", nom: "Webhook", aide: "Slack, Mattermost, Rocket.Chat, n8n… : une adresse qui reçoit du JSON." },
];

// ---------------------------------------------------------------- utilitaires purs

/** Découpe une liste saisie (virgules, points-virgules, retours à la ligne) ; les espaces restent : « 06 12 34 56 78 » est un seul numéro. */
export const listeDe = (saisie: string): string[] => saisie.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

/** Retire les accents et les caractères hors alphabet SMS courant (les opérateurs facturent double les caractères spéciaux). */
export function sansAccents(texte: string): string {
  return texte
    .replace(/€/g, "EUR")
    .replace(/[’‘]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "")
    .replace(/\s+\n/g, "\n");
}

/** Texte de SMS : sans accents, 160 caractères au plus (coupé net, sans points de suspension qui dépasseraient). */
export const pourSms = (texte: string) => sansAccents(texte).slice(0, 160).trimEnd();

export function couper(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Numéro de téléphone au format attendu par le fournisseur. Un numéro français « 06 12 34 56 78 » devient
 * « +33612345678 » (OVH) ou « 33612345678 » (Brevo, chiffres seuls). Null si le numéro n'a pas l'air valide.
 */
export function normaliserTelephone(saisie: string, format: "ovh" | "brevo"): string | null {
  let n = saisie.replace(/[\s.()-]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(n)) n = `+33${n.slice(1)}`;
  if (!/^\+\d{8,15}$/.test(n)) return null;
  return format === "ovh" ? n : n.slice(1);
}

const extrait = (corps: string) => couper(corps.replace(/\s+/g, " ").trim(), 200);

// ---------------------------------------------------------------- requêtes (construction pure, envoi par la coque Rust)

export interface RequeteHttp {
  methode: string;
  url: string;
  entetes: [string, string][];
  corps?: string;
  delai_s?: number;
}

const JSON_ENTETE: [string, string] = ["Content-Type", "application/json"];
const BALISES_NTFY: Record<Evenement, string[]> = { alertes: ["bell"], niveaux: ["dart"], recap: ["newspaper"] };

export function requeteNtfy(c: ConfigNotifications["ntfy"], m: Message): RequeteHttp {
  const entetes: [string, string][] = [JSON_ENTETE];
  if (c.avecJeton) entetes.push(["Authorization", `Bearer {{secret:${SECRETS.ntfy}}}`]);
  return {
    methode: "POST",
    url: c.serveur.trim().replace(/\/+$/, ""),
    entetes,
    corps: JSON.stringify({ topic: c.sujet.trim(), title: m.titre, message: couper(m.texte, 3500), priority: m.evenement === "recap" ? 3 : 4, tags: BALISES_NTFY[m.evenement] }),
  };
}

export function requeteTelegram(c: ConfigNotifications["telegram"], m: Message): RequeteHttp {
  return {
    methode: "POST",
    url: `https://api.telegram.org/bot{{secret:${SECRETS.telegram}}}/sendMessage`,
    entetes: [JSON_ENTETE],
    corps: JSON.stringify({ chat_id: c.chatId.trim(), text: couper(`${m.titre}\n\n${m.texte}`, 4000), disable_web_page_preview: true }),
  };
}

export function requeteDiscord(m: Message): RequeteHttp {
  return { methode: "POST", url: `{{secret:${SECRETS.discord}}}`, entetes: [JSON_ENTETE], corps: JSON.stringify({ content: couper(`**${m.titre}**\n${m.texte}`, 1900) }) };
}

export function requeteWebhook(c: ConfigNotifications["webhook"], m: Message): RequeteHttp {
  const corps = c.format === "json" ? { evenement: m.evenement, titre: m.titre, message: m.texte } : { text: `*${m.titre}*\n${m.texte}` };
  return { methode: "POST", url: `{{secret:${SECRETS.webhook}}}`, entetes: [JSON_ENTETE], corps: JSON.stringify(corps) };
}

export function requeteBrevo(c: ConfigNotifications["smsBrevo"], m: Message, destinataire: string, chemin: "send" | "sms" = "send"): RequeteHttp {
  const expediteur = sansAccents(c.expediteur).replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "Hune";
  return {
    methode: "POST",
    url: `https://api.brevo.com/v3/transactionalSMS/${chemin}`,
    entetes: [JSON_ENTETE, ["api-key", `{{secret:${SECRETS.brevo}}}`], ["Accept", "application/json"]],
    corps: JSON.stringify({ sender: expediteur, recipient: destinataire, content: pourSms(m.court), type: "transactional" }),
  };
}

// ---------------------------------------------------------------- envoi

type Invoquer = <T>(commande: string, args: Record<string, unknown>) => Promise<T>;
let invoquerInjecte: Invoquer | null = null;
/** Pour les tests : remplace l'appel à la coque Rust. */
export const injecterInvoquer = (f: Invoquer | null) => {
  invoquerInjecte = f;
};
async function invoquer<T>(commande: string, args: Record<string, unknown>): Promise<T> {
  if (invoquerInjecte) return invoquerInjecte<T>(commande, args);
  const { dansTauri } = await import("../donnees/http");
  if (!dansTauri()) throw new Error("Les envois ne fonctionnent que dans l'application installée.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(commande, args);
}

/** Envoie une requête HTTP par la coque (hors CORS, secrets substitués côté Rust) ; échoue si la réponse n'est pas 2xx. */
export async function envoyerHttp(r: RequeteHttp): Promise<string> {
  const rep = await invoquer<{ statut: number; corps: string }>("http_requete", { requete: r });
  if (rep.statut < 200 || rep.statut >= 300) throw new Error(`HTTP ${rep.statut} : ${extrait(rep.corps)}`);
  return rep.corps;
}

/** Corps HTML minimal si le message n'en fournit pas. */
const htmlParDefaut = (m: Message) => `<pre style="font-family:inherit;white-space:pre-wrap">${m.texte.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;

/** Ce qu'il faut renseigner (hors secrets) pour qu'un canal puisse partir ; null = prêt. */
export function manque(id: CanalId, c: ConfigNotifications): string | null {
  switch (id) {
    case "ntfy":
      return /^https?:\/\/\S+$/.test(c.ntfy.serveur.trim()) ? (c.ntfy.sujet.trim() ? null : "sujet") : "adresse du serveur";
    case "mail":
      return !c.mail.serveur.trim() ? "serveur SMTP" : !c.mail.expediteur.trim() ? "expéditeur" : !listeDe(c.mail.destinataires).length ? "destinataire" : null;
    case "smsBrevo":
      return listeDe(c.smsBrevo.destinataires).some((n) => !normaliserTelephone(n, "brevo")) || !listeDe(c.smsBrevo.destinataires).length ? "numéro de téléphone valide" : null;
    case "smsOvh":
      return !c.smsOvh.cleApplication.trim() ? "clé d'application" : !c.smsOvh.service.trim() ? "compte SMS (sms-xx123456-1)" : listeDe(c.smsOvh.destinataires).some((n) => !normaliserTelephone(n, "ovh")) || !listeDe(c.smsOvh.destinataires).length ? "numéro de téléphone valide" : null;
    case "telegram":
      return c.telegram.chatId.trim() ? null : "identifiant de conversation (chat id)";
    case "discord":
    case "webhook":
      return null;
  }
}

export async function envoyerCanal(id: CanalId, c: ConfigNotifications, m: Message): Promise<void> {
  const absent = manque(id, c);
  if (absent) throw new Error(`Configuration incomplète : ${absent}.`);
  switch (id) {
    case "ntfy":
      await envoyerHttp(requeteNtfy(c.ntfy, m));
      return;
    case "telegram":
      await envoyerHttp(requeteTelegram(c.telegram, m));
      return;
    case "discord":
      await envoyerHttp(requeteDiscord(m));
      return;
    case "webhook":
      await envoyerHttp(requeteWebhook(c.webhook, m));
      return;
    case "mail":
      await invoquer("envoyer_mail", {
        mail: {
          serveur: c.mail.serveur.trim(),
          port: c.mail.port,
          securite: c.mail.securite,
          utilisateur: c.mail.utilisateur.trim(),
          expediteur: c.mail.expediteur.trim(),
          destinataires: listeDe(c.mail.destinataires),
          sujet: m.titre,
          texte: m.texte,
          html: m.html ?? htmlParDefaut(m),
        },
      });
      return;
    case "smsBrevo": {
      const numeros = listeDe(c.smsBrevo.destinataires).map((n) => normaliserTelephone(n, "brevo")!);
      for (const n of numeros) {
        try {
          await envoyerHttp(requeteBrevo(c.smsBrevo, m, n));
        } catch (e) {
          // Selon les comptes, l'API historique répond encore sur /sms.
          if (e instanceof Error && e.message.startsWith("HTTP 404")) await envoyerHttp(requeteBrevo(c.smsBrevo, m, n, "sms"));
          else throw e;
        }
      }
      return;
    }
    case "smsOvh":
      await invoquer("envoyer_sms_ovh", {
        sms: {
          region: c.smsOvh.region,
          cle_application: c.smsOvh.cleApplication.trim(),
          service: c.smsOvh.service.trim(),
          expediteur: c.smsOvh.expediteur.trim() || null,
          destinataires: listeDe(c.smsOvh.destinataires).map((n) => normaliserTelephone(n, "ovh")!),
          message: pourSms(m.court),
        },
      });
      return;
  }
}

export const messageErreur = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Canaux actifs, complets et abonnés à cet événement. */
export function canauxAbonnes(c: ConfigNotifications, evenement: Evenement): CanalId[] {
  return CANAUX.map((k) => k.id).filter((id) => c[id].actif && c[id][evenement] && manque(id, c) === null);
}

/** Envoie le message à tous les canaux abonnés, en parallèle ; un canal en panne n'empêche pas les autres. */
export async function diffuser(c: ConfigNotifications, m: Message, canaux: CanalId[] = canauxAbonnes(c, m.evenement)): Promise<ResultatEnvoi[]> {
  return Promise.all(
    canaux.map(async (canal): Promise<ResultatEnvoi> => {
      try {
        await envoyerCanal(canal, c, m);
        return { canal, ok: true };
      } catch (e) {
        return { canal, ok: false, erreur: messageErreur(e) };
      }
    }),
  );
}

export const nomCanal = (id: CanalId) => CANAUX.find((k) => k.id === id)?.nom ?? id;
