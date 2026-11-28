import { useEffect, useState, type ReactNode } from "react";
import { CANAUX, diffuser, manque, messageErreur, nomCanal, canauxAbonnes } from "./canaux";
import type { CanalId, ConfigNotifications, Evenement } from "./config";
import { interroger, MODELES_SUGGERES } from "./ia";
import { messageTest } from "./messages";
import type { EntreesRecap } from "./recap-donnees";
import { preparerRecap } from "./recap-envoi";
import { definirSecret, secretExiste, secretsDisponibles, SECRETS } from "./secrets";

interface Props {
  config: ConfigNotifications;
  surChangement: (c: ConfigNotifications) => void;
  lireEntrees: () => Omit<EntreesRecap, "depuisMs">;
}

type Resultat = { ok: boolean; texte: string } | null;

function Retour({ r }: { r: Resultat }) {
  return r ? <span className={`text-xs ${r.ok ? "text-hausse" : "text-baisse"}`}>{r.texte}</span> : null;
}

function Champ({ libelle, valeur, surChange, placeholder, type = "text", aide, className = "" }: { libelle: string; valeur: string | number; surChange: (v: string) => void; placeholder?: string; type?: string; aide?: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs text-doux">{libelle}</span>
      <input className="champ w-full" type={type} value={valeur} placeholder={placeholder} onChange={(e) => surChange(e.target.value)} spellCheck={false} autoComplete="off" />
      {aide && <span className="mt-1 block text-xs text-doux">{aide}</span>}
    </label>
  );
}

/** Champ d'un secret : il s'enregistre dans le coffre du système et ne se relit jamais (on sait seulement s'il existe). */
function ChampSecret({ nom, libelle, aide, placeholder }: { nom: string; libelle: string; aide?: ReactNode; placeholder?: string }) {
  const [existe, setExiste] = useState<boolean | null>(null);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    void secretExiste(nom).then(setExiste).catch(() => setExiste(false));
  }, [nom]);
  const enregistrer = async (valeur: string) => {
    try {
      await definirSecret(nom, valeur);
      setExiste(valeur !== "");
      setSaisie("");
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };
  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs text-doux">
        {libelle} {existe && <span className="text-hausse">· enregistré dans le coffre du système</span>}
      </span>
      <div className="flex gap-2">
        <input className="champ min-w-0 flex-1" type="password" value={saisie} placeholder={existe ? "•••••••• (laisser vide pour conserver)" : (placeholder ?? "")} onChange={(e) => setSaisie(e.target.value)} autoComplete="new-password" spellCheck={false} />
        <button className="bouton" disabled={!saisie || !secretsDisponibles()} onClick={() => void enregistrer(saisie)}>
          Enregistrer
        </button>
        {existe && (
          <button className="bouton !border-baisse !text-baisse" onClick={() => void enregistrer("")}>
            Effacer
          </button>
        )}
      </div>
      {aide && <span className="mt-1 block text-xs text-doux">{aide}</span>}
      {erreur && <span className="mt-1 block text-xs text-baisse">{erreur}</span>}
    </div>
  );
}

const EVENEMENTS: [Evenement, string][] = [
  ["alertes", "Alertes de prix et d'indicateurs"],
  ["niveaux", "Objectifs (TP) et stop loss"],
  ["recap", "Récap quotidien"],
];

function CarteCanal({ id, config, surChangement, enfants }: { id: CanalId; config: ConfigNotifications; surChangement: (c: ConfigNotifications) => void; enfants: ReactNode }) {
  const canal = CANAUX.find((c) => c.id === id)!;
  const c = config[id];
  const [test, setTest] = useState<Resultat>(null);
  const [enCours, setEnCours] = useState(false);
  const maj = (patch: Partial<ConfigNotifications[CanalId]>) => surChangement({ ...config, [id]: { ...c, ...patch } });
  const incomplet = manque(id, config);

  const tester = async () => {
    setEnCours(true);
    setTest(null);
    const [r] = await diffuser(config, messageTest(canal.nom), [id]);
    setTest(r.ok ? { ok: true, texte: "Message envoyé : vérifiez sa réception." } : { ok: false, texte: r.erreur ?? "Échec" });
    setEnCours(false);
  };

  return (
    <div className="rounded-xl border border-ligne p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1" checked={c.actif} onChange={(e) => maj({ actif: e.target.checked })} />
        <span>
          <span className="font-semibold">{canal.nom}</span>
          <span className="block text-xs text-doux">{canal.aide}</span>
        </span>
      </label>
      {c.actif && (
        <div className="mt-3 space-y-3 border-t border-ligne pt-3">
          {enfants}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {EVENEMENTS.map(([ev, libelle]) => (
              <label key={ev} className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={c[ev]} onChange={(e) => maj({ [ev]: e.target.checked })} />
                {libelle}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="bouton" disabled={enCours || incomplet !== null} onClick={() => void tester()}>
              {enCours ? "Envoi…" : "Envoyer un test"}
            </button>
            {incomplet && <span className="text-xs text-doux">À renseigner : {incomplet}.</span>}
            <Retour r={test} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Réglages › notifications à distance, récap quotidien et IA. */
export function SectionNotifications({ config, surChangement, lireEntrees }: Props) {
  const maj = <K extends keyof ConfigNotifications>(cle: K, patch: Partial<ConfigNotifications[K]>) => surChangement({ ...config, [cle]: { ...config[cle], ...patch } });
  const [recapTest, setRecapTest] = useState<Resultat>(null);
  const [recapEnCours, setRecapEnCours] = useState(false);
  const [iaTest, setIaTest] = useState<Resultat>(null);
  const [iaEnCours, setIaEnCours] = useState(false);
  const [iaCle, setIaCle] = useState<boolean | null>(null);
  useEffect(() => {
    void secretExiste(SECRETS.openrouter).then(setIaCle).catch(() => setIaCle(false));
  }, [iaTest]);

  const envoyerRecapTest = async () => {
    setRecapEnCours(true);
    setRecapTest(null);
    try {
      const canaux = canauxAbonnes(config, "recap");
      if (!canaux.length) throw new Error("Aucun canal actif n'est abonné au récap quotidien.");
      const message = await preparerRecap(config, { ...lireEntrees(), depuisMs: 0 }, "matin");
      const res = await diffuser(config, message, canaux);
      const echecs = res.filter((r) => !r.ok);
      setRecapTest({ ok: !echecs.length, texte: echecs.length ? echecs.map((e) => `${nomCanal(e.canal)} : ${e.erreur}`).join(" · ") : `Récap envoyé sur ${canaux.map(nomCanal).join(", ")}.` });
    } catch (e) {
      setRecapTest({ ok: false, texte: messageErreur(e) });
    }
    setRecapEnCours(false);
  };

  const testerIA = async () => {
    setIaEnCours(true);
    setIaTest(null);
    try {
      const r = await interroger(config.ia.modele, "Tu réponds en une courte phrase.", "Dis simplement « Hune est prêt. »", 30);
      setIaTest({ ok: true, texte: `Réponse du modèle : ${r}` });
    } catch (e) {
      setIaTest({ ok: false, texte: messageErreur(e) });
    }
    setIaEnCours(false);
  };

  const dansApp = secretsDisponibles();
  return (
    <>
      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-1 text-base font-semibold">Notifications à distance</h2>
        <p className="m-0 mb-4 text-xs text-doux">
          Recevez vos alertes, objectifs (TP) et stop loss sur votre téléphone quand vous n'êtes pas devant l'ordinateur. Hune doit rester lancé (il vit dans la zone de notification) et l'ordinateur allumé. Cette configuration reste sur ce PC : elle n'est ni exportée, ni synchronisée. Mots de passe, jetons et clés sont rangés dans le coffre du système (Gestionnaire d'identifiants de Windows, Trousseau sur Mac), jamais dans les fichiers de Hune.
        </p>
        {!dansApp && <p className="mb-3 text-xs text-alerte">Les envois et le coffre de secrets ne fonctionnent que dans l'application installée.</p>}
        <div className="space-y-3">
          <CarteCanal
            id="ntfy"
            config={config}
            surChangement={surChangement}
            enfants={
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Champ libelle="Serveur" valeur={config.ntfy.serveur} surChange={(v) => maj("ntfy", { serveur: v })} placeholder="https://ntfy.sh" />
                  <Champ libelle="Sujet (topic)" valeur={config.ntfy.sujet} surChange={(v) => maj("ntfy", { sujet: v })} placeholder="hune-alertes-xxxxxx" aide="Choisissez un nom difficile à deviner : sur ntfy.sh, qui connaît le sujet peut le lire." />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={config.ntfy.avecJeton} onChange={(e) => maj("ntfy", { avecJeton: e.target.checked })} />
                  Mon serveur demande un jeton d'accès
                </label>
                {config.ntfy.avecJeton && <ChampSecret nom={SECRETS.ntfy} libelle="Jeton d'accès ntfy" placeholder="tk_…" />}
                <p className="m-0 text-xs text-doux">Installez l'application ntfy sur votre téléphone et abonnez-vous au même sujet.</p>
              </>
            }
          />

          <CarteCanal
            id="mail"
            config={config}
            surChangement={surChangement}
            enfants={
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Champ className="md:col-span-2" libelle="Serveur SMTP" valeur={config.mail.serveur} surChange={(v) => maj("mail", { serveur: v })} placeholder="smtp.exemple.fr" />
                  <Champ libelle="Port" type="number" valeur={config.mail.port} surChange={(v) => maj("mail", { port: Number(v) || 0 })} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Sécurité">
                  {(
                    [
                      ["starttls", "STARTTLS (587)", 587],
                      ["ssl", "SSL/TLS (465)", 465],
                      ["aucune", "Aucune (réseau local)", 25],
                    ] as const
                  ).map(([v, l, port]) => (
                    <button key={v} role="radio" aria-checked={config.mail.securite === v} className={`bouton ${config.mail.securite === v ? "bouton-actif" : ""}`} onClick={() => maj("mail", { securite: v, port })}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Champ libelle="Identifiant (souvent l'adresse)" valeur={config.mail.utilisateur} surChange={(v) => maj("mail", { utilisateur: v })} placeholder="laisser vide si le serveur n'exige rien" />
                  <ChampSecret nom={SECRETS.smtp} libelle="Mot de passe" />
                  <Champ libelle="Expéditeur" valeur={config.mail.expediteur} surChange={(v) => maj("mail", { expediteur: v })} placeholder="Hune <hune@exemple.fr>" />
                  <Champ libelle="Destinataire(s)" valeur={config.mail.destinataires} surChange={(v) => maj("mail", { destinataires: v })} placeholder="moi@exemple.fr, autre@exemple.fr" />
                </div>
              </>
            }
          />

          <CarteCanal
            id="smsBrevo"
            config={config}
            surChangement={surChangement}
            enfants={
              <div className="grid gap-3 md:grid-cols-2">
                <ChampSecret nom={SECRETS.brevo} libelle="Clé d'API Brevo" placeholder="xkeysib-…" aide="Brevo › Paramètres › Clés API. Achetez des crédits SMS dans votre compte." />
                <Champ libelle="Nom d'expéditeur (11 caractères max.)" valeur={config.smsBrevo.expediteur} surChange={(v) => maj("smsBrevo", { expediteur: v })} placeholder="Hune" />
                <Champ className="md:col-span-2" libelle="Numéro(s) de téléphone" valeur={config.smsBrevo.destinataires} surChange={(v) => maj("smsBrevo", { destinataires: v })} placeholder="06 12 34 56 78 ou +33612345678" aide="Un SMS par alerte et par numéro, 160 caractères sans accents. Chaque envoi consomme un crédit." />
              </div>
            }
          />

          <CarteCanal
            id="smsOvh"
            config={config}
            surChangement={surChangement}
            enfants={
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex gap-2 text-sm md:col-span-2" role="radiogroup" aria-label="Région OVH">
                  {(
                    [
                      ["eu", "OVHcloud Europe"],
                      ["ca", "OVHcloud Canada"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} role="radio" aria-checked={config.smsOvh.region === v} className={`bouton ${config.smsOvh.region === v ? "bouton-actif" : ""}`} onClick={() => maj("smsOvh", { region: v })}>
                      {l}
                    </button>
                  ))}
                </div>
                <Champ libelle="Clé d'application (Application Key)" valeur={config.smsOvh.cleApplication} surChange={(v) => maj("smsOvh", { cleApplication: v })} />
                <ChampSecret nom={SECRETS.ovhSecret} libelle="Secret d'application (Application Secret)" />
                <ChampSecret nom={SECRETS.ovhConsumer} libelle="Consumer key" aide="Créée sur api.ovh.com/createToken avec le droit POST /sms/*/jobs." />
                <Champ libelle="Compte SMS" valeur={config.smsOvh.service} surChange={(v) => maj("smsOvh", { service: v })} placeholder="sms-ab123456-1" />
                <Champ libelle="Expéditeur (facultatif)" valeur={config.smsOvh.expediteur} surChange={(v) => maj("smsOvh", { expediteur: v })} placeholder="un expéditeur validé chez OVH" />
                <Champ libelle="Numéro(s) de téléphone" valeur={config.smsOvh.destinataires} surChange={(v) => maj("smsOvh", { destinataires: v })} placeholder="06 12 34 56 78 ou +33612345678" />
              </div>
            }
          />

          <CarteCanal
            id="telegram"
            config={config}
            surChangement={surChangement}
            enfants={
              <div className="grid gap-3 md:grid-cols-2">
                <ChampSecret nom={SECRETS.telegram} libelle="Jeton du bot" placeholder="123456:ABC…" aide="Créez un bot avec @BotFather, puis envoyez-lui un message." />
                <Champ libelle="Identifiant de conversation (chat id)" valeur={config.telegram.chatId} surChange={(v) => maj("telegram", { chatId: v })} placeholder="123456789" aide="Visible avec @userinfobot, ou dans la réponse de getUpdates." />
              </div>
            }
          />

          <CarteCanal id="discord" config={config} surChangement={surChangement} enfants={<ChampSecret nom={SECRETS.discord} libelle="Adresse du webhook" placeholder="https://discord.com/api/webhooks/…" aide="Salon › Modifier › Intégrations › Webhooks. Cette adresse donne le droit d'écrire dans le salon : gardez-la privée." />} />

          <CarteCanal
            id="webhook"
            config={config}
            surChangement={surChangement}
            enfants={
              <>
                <ChampSecret nom={SECRETS.webhook} libelle="Adresse du webhook" placeholder="https://…" />
                <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Format">
                  {(
                    [
                      ["texte", "Slack / Mattermost : {\"text\": …}"],
                      ["json", "JSON : {evenement, titre, message}"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} role="radio" aria-checked={config.webhook.format === v} className={`bouton ${config.webhook.format === v ? "bouton-actif" : ""}`} onClick={() => maj("webhook", { format: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-1 text-base font-semibold">Récap quotidien</h2>
        <p className="m-0 mb-3 text-xs text-doux">Valeur du portefeuille, gains, plus fortes hausses et baisses de votre liste, alertes déclenchées depuis le dernier récap, objectifs et stops proches. Envoyé sur les canaux abonnés au récap. Si l'ordinateur était éteint à l'heure prévue, il part au réveil (dans les 3 heures).</p>
        <div className="space-y-2">
          {(
            [
              ["matin", "Récap du matin"],
              ["soir", "Récap du soir"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex w-40 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={config.recap[k].actif} onChange={(e) => maj("recap", { [k]: { ...config.recap[k], actif: e.target.checked } })} />
                {l}
              </label>
              <input type="time" className="champ" value={config.recap[k].heure} disabled={!config.recap[k].actif} onChange={(e) => e.target.value && maj("recap", { [k]: { ...config.recap[k], heure: e.target.value } })} />
              <span className="text-xs text-doux">{k === "matin" ? "crypto de la nuit, clôtures de la veille" : "bourses européennes clôturées, Wall Street en cours"}</span>
            </div>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={config.recap.commentaireIa} disabled={!iaCle} onChange={(e) => maj("recap", { commentaireIa: e.target.checked })} />
          <span>
            Ajouter un court commentaire de l'IA
            <span className="block text-xs text-doux">{iaCle ? "Utilise la clé OpenRouter configurée ci-dessous." : "Nécessite une clé OpenRouter (section suivante)."}</span>
          </span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="bouton" disabled={recapEnCours} onClick={() => void envoyerRecapTest()}>
            {recapEnCours ? "Préparation…" : "Envoyer un récap maintenant"}
          </button>
          <Retour r={recapTest} />
        </div>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-1 text-base font-semibold">Intelligence artificielle (OpenRouter)</h2>
        <p className="m-0 mb-3 text-xs text-doux">
          Active le bouton « Analyser le marché » de l'onglet Marché et le commentaire du récap. Une seule clé OpenRouter (openrouter.ai) donne accès à des centaines de modèles, dont des modèles gratuits ; vous payez à l'usage. Les cours de votre liste de suivi sont envoyés au modèle choisi. Analyse indicative : ce n'est pas un conseil financier.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <ChampSecret nom={SECRETS.openrouter} libelle="Clé d'API OpenRouter" placeholder="sk-or-v1-…" />
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-doux">Modèle</span>
            <input className="champ w-full" list="modeles-ia" value={config.ia.modele} onChange={(e) => maj("ia", { modele: e.target.value })} spellCheck={false} />
            <datalist id="modeles-ia">
              {MODELES_SUGGERES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="mt-1 block text-xs text-doux">« openrouter/auto » choisit un modèle selon la question. Les identifiants complets sont listés sur openrouter.ai/models.</span>
          </label>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={config.ia.inclurePortefeuille} onChange={(e) => maj("ia", { inclurePortefeuille: e.target.checked })} />
          <span>
            Inclure mon portefeuille dans l'analyse
            <span className="block text-xs text-doux">Envoie au modèle la répartition et la performance de vos lignes en pourcentages, jamais les montants ni les quantités. Désactivé par défaut.</span>
          </span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="bouton" disabled={iaEnCours || !iaCle} onClick={() => void testerIA()}>
            {iaEnCours ? "Test…" : "Tester la clé et le modèle"}
          </button>
          <Retour r={iaTest} />
        </div>
      </section>
    </>
  );
}
