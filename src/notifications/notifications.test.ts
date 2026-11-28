import { afterEach, describe, expect, it } from "vitest";
import { canauxAbonnes, couper, diffuser, envoyerCanal, injecterInvoquer, listeDe, manque, normaliserTelephone, requeteBrevo, requeteDiscord, requeteNtfy, requeteTelegram, requeteWebhook, sansAccents, type Message } from "./canaux";
import { CONFIG_PAR_DEFAUT, fusionnerConfig, type ConfigNotifications } from "./config";
import { construireInvite, extraireReponseIA, resumeDonnees } from "./ia";
import { messageAlerte } from "./messages";
import { construireRecap, creneauxDus, jourLocal, minutesDe, type DonneesRecap } from "./recap";

const clone = (): ConfigNotifications => structuredClone(CONFIG_PAR_DEFAUT);
const msg: Message = { evenement: "alertes", titre: "Alerte : BTC", texte: "Prix ≥ 70 000\nValeur actuelle : 70 100", court: "Hune : BTC Prix ≥ 70 000 (70 100)" };

afterEach(() => injecterInvoquer(null));

describe("configuration", () => {
  it("complète une configuration ancienne ou partielle avec les valeurs par défaut", () => {
    const c = fusionnerConfig({ ntfy: { actif: true, sujet: "mon-sujet" }, recap: { soir: { actif: true } } });
    expect(c.ntfy).toMatchObject({ actif: true, sujet: "mon-sujet", serveur: "https://ntfy.sh", alertes: true });
    expect(c.recap.soir).toEqual({ actif: true, heure: "20:00" });
    expect(c.recap.matin).toEqual({ actif: true, heure: "07:00" });
    expect(c.mail.port).toBe(587);
  });
  it("ignore les valeurs de mauvais type et les contenus invalides", () => {
    expect(fusionnerConfig({ mail: { port: "abc", actif: "oui" } }).mail).toMatchObject({ port: 587, actif: false });
    expect(fusionnerConfig(null)).toEqual(CONFIG_PAR_DEFAUT);
    expect(fusionnerConfig("n'importe quoi")).toEqual(CONFIG_PAR_DEFAUT);
  });
  it("n'abonne pas les SMS au récap par défaut", () => {
    expect(CONFIG_PAR_DEFAUT.smsBrevo.recap).toBe(false);
    expect(CONFIG_PAR_DEFAUT.smsOvh.recap).toBe(false);
    expect(CONFIG_PAR_DEFAUT.ntfy.recap).toBe(true);
  });
});

describe("utilitaires", () => {
  it("découpe les listes de destinataires", () => {
    expect(listeDe("a@x.fr, b@x.fr;c@x.fr\nd@x.fr  ")).toEqual(["a@x.fr", "b@x.fr", "c@x.fr", "d@x.fr"]);
    expect(listeDe("  ")).toEqual([]);
  });
  it("normalise les numéros de téléphone", () => {
    expect(normaliserTelephone("06 12 34 56 78", "ovh")).toBe("+33612345678");
    expect(normaliserTelephone("06.12.34.56.78", "brevo")).toBe("33612345678");
    expect(normaliserTelephone("+33 6 12 34 56 78", "brevo")).toBe("33612345678");
    expect(normaliserTelephone("0033612345678", "ovh")).toBe("+33612345678");
    expect(normaliserTelephone("12", "ovh")).toBeNull();
    expect(normaliserTelephone("abc", "brevo")).toBeNull();
  });
  it("nettoie le texte des SMS", () => {
    expect(sansAccents("Alerte déclenchée : 1 200 € – ça monte…")).toBe("Alerte declenchee : 1 200 EUR - ca monte...");
    expect(sansAccents("Prix ≥ 70")).toBe("Prix  70");
  });
  it("coupe sans dépasser", () => {
    expect(couper("abcdef", 6)).toBe("abcdef");
    expect(couper("abcdefgh", 6)).toHaveLength(6);
    expect(couper("abcdefgh", 6).endsWith("…")).toBe(true);
  });
});

describe("requêtes par canal", () => {
  it("ntfy : JSON UTF-8, jeton référencé par un marqueur et jamais en clair", () => {
    const c = clone();
    c.ntfy = { ...c.ntfy, actif: true, serveur: "https://ntfy.exemple.fr/", sujet: " hune-xyz ", avecJeton: true };
    const r = requeteNtfy(c.ntfy, msg);
    expect(r.url).toBe("https://ntfy.exemple.fr");
    expect(r.entetes).toContainEqual(["Authorization", "Bearer {{secret:ntfy-jeton}}"]);
    expect(JSON.parse(r.corps!)).toMatchObject({ topic: "hune-xyz", title: "Alerte : BTC", priority: 4 });
    expect(requeteNtfy({ ...c.ntfy, avecJeton: false }, msg).entetes.some(([k]) => k === "Authorization")).toBe(false);
  });
  it("telegram, discord, webhook : l'adresse secrète est un marqueur", () => {
    const c = clone();
    c.telegram.chatId = " 42 ";
    const t = requeteTelegram(c.telegram, msg);
    expect(t.url).toBe("https://api.telegram.org/bot{{secret:telegram}}/sendMessage");
    expect(JSON.parse(t.corps!).chat_id).toBe("42");
    expect(requeteDiscord(msg).url).toBe("{{secret:discord-url}}");
    expect(JSON.parse(requeteDiscord(msg).corps!).content).toContain("**Alerte : BTC**");
    expect(JSON.parse(requeteWebhook({ ...c.webhook, format: "texte" }, msg).corps!).text).toContain("Alerte : BTC");
    expect(JSON.parse(requeteWebhook({ ...c.webhook, format: "json" }, msg).corps!)).toMatchObject({ evenement: "alertes", titre: "Alerte : BTC" });
  });
  it("brevo : expéditeur alphanumérique de 11 caractères, texte sans accents et borné", () => {
    const c = clone();
    c.smsBrevo.expediteur = "Hune Alertes é!";
    const r = requeteBrevo(c.smsBrevo, { ...msg, court: "é".repeat(300) }, "33612345678");
    const corps = JSON.parse(r.corps!);
    expect(corps.sender).toBe("HuneAlertes");
    expect(corps.content.length).toBeLessThanOrEqual(160);
    expect(corps.content).not.toMatch(/[^\x20-\x7e]/);
    expect(r.entetes).toContainEqual(["api-key", "{{secret:brevo}}"]);
    expect(requeteBrevo(c.smsBrevo, msg, "33612345678", "sms").url).toMatch(/transactionalSMS\/sms$/);
  });
});

describe("configuration complète ?", () => {
  it("dit ce qui manque", () => {
    const c = clone();
    expect(manque("ntfy", c)).toBe("sujet");
    c.ntfy.sujet = "x";
    expect(manque("ntfy", c)).toBeNull();
    c.ntfy.serveur = "ntfy.sh";
    expect(manque("ntfy", c)).toBe("adresse du serveur");
    expect(manque("mail", c)).toBe("serveur SMTP");
    expect(manque("smsBrevo", c)).toBe("numéro de téléphone valide");
    c.smsBrevo.destinataires = "06 12 34 56 78, pas-un-numero";
    expect(manque("smsBrevo", c)).toBe("numéro de téléphone valide");
    c.smsBrevo.destinataires = "06 12 34 56 78";
    expect(manque("smsBrevo", c)).toBeNull();
    expect(manque("telegram", c)).toMatch(/chat id/);
  });
  it("n'abonne que les canaux actifs, complets et concernés", () => {
    const c = clone();
    c.ntfy = { ...c.ntfy, actif: true, sujet: "x" };
    c.telegram = { ...c.telegram, actif: true }; // incomplet : pas de chat id
    c.discord = { ...c.discord, actif: true, niveaux: false };
    expect(canauxAbonnes(c, "alertes")).toEqual(["ntfy", "discord"]);
    expect(canauxAbonnes(c, "niveaux")).toEqual(["ntfy"]);
    expect(canauxAbonnes(c, "recap")).toEqual(["ntfy", "discord"]);
  });
});

describe("envoi", () => {
  it("transmet la requête HTTP à la coque et traite un statut non 2xx comme un échec", async () => {
    const appels: { commande: string; args: Record<string, unknown> }[] = [];
    injecterInvoquer(async (commande, args) => {
      appels.push({ commande, args });
      return { statut: 403, corps: '{"error":"forbidden"}' } as never;
    });
    const c = clone();
    c.ntfy = { ...c.ntfy, actif: true, sujet: "x" };
    await expect(envoyerCanal("ntfy", c, msg)).rejects.toThrow(/HTTP 403/);
    expect(appels[0].commande).toBe("http_requete");
  });
  it("un canal en panne n'empêche pas les autres", async () => {
    injecterInvoquer(async (commande) => {
      if (commande === "envoyer_mail") throw new Error("connexion refusée");
      return { statut: 200, corps: "{}" } as never;
    });
    const c = clone();
    c.ntfy = { ...c.ntfy, actif: true, sujet: "x" };
    c.mail = { ...c.mail, actif: true, serveur: "smtp.x.fr", expediteur: "a@x.fr", destinataires: "b@x.fr" };
    const res = await diffuser(c, msg);
    expect(res).toEqual([
      { canal: "ntfy", ok: true },
      { canal: "mail", ok: false, erreur: "connexion refusée" },
    ]);
  });
  it("e-mail : toutes les informations partent, avec un HTML de repli", async () => {
    let recu: Record<string, unknown> = {};
    injecterInvoquer(async (_c, args) => {
      recu = (args as { mail: Record<string, unknown> }).mail;
      return undefined as never;
    });
    const c = clone();
    c.mail = { ...c.mail, actif: true, serveur: " smtp.x.fr ", port: 465, securite: "ssl", utilisateur: "u", expediteur: "Hune <h@x.fr>", destinataires: "a@x.fr; b@x.fr" };
    await envoyerCanal("mail", c, { ...msg, texte: "a < b" });
    expect(recu).toMatchObject({ serveur: "smtp.x.fr", port: 465, securite: "ssl", destinataires: ["a@x.fr", "b@x.fr"], sujet: "Alerte : BTC" });
    expect(recu.html).toContain("a &lt; b");
  });
  it("SMS Brevo : un envoi par numéro, repli sur l'ancien chemin en cas de 404", async () => {
    const urls: string[] = [];
    injecterInvoquer(async (_c, args) => {
      const u = (args as { requete: { url: string } }).requete.url;
      urls.push(u);
      return (u.endsWith("/send") ? { statut: 404, corps: "not found" } : { statut: 201, corps: "{}" }) as never;
    });
    const c = clone();
    c.smsBrevo = { ...c.smsBrevo, actif: true, destinataires: "0612345678, 0698765432" };
    await envoyerCanal("smsBrevo", c, msg);
    expect(urls).toHaveLength(4);
    expect(urls.filter((u) => u.endsWith("/sms"))).toHaveLength(2);
  });
  it("SMS OVH : numéros au format international et texte sans accents", async () => {
    let sms: Record<string, unknown> = {};
    injecterInvoquer(async (_c, args) => {
      sms = (args as { sms: Record<string, unknown> }).sms;
      return "{}" as never;
    });
    const c = clone();
    c.smsOvh = { ...c.smsOvh, actif: true, cleApplication: "AK", service: "sms-ab123-1", destinataires: "06 12 34 56 78" };
    await envoyerCanal("smsOvh", c, { ...msg, court: "Déclenchée à 5 €" });
    expect(sms).toMatchObject({ region: "eu", cle_application: "AK", service: "sms-ab123-1", destinataires: ["+33612345678"], message: "Declenchee a 5 EUR", expediteur: null });
  });
  it("refuse d'envoyer avec une configuration incomplète", async () => {
    await expect(envoyerCanal("telegram", clone(), msg)).rejects.toThrow(/Configuration incomplète/);
  });
});

describe("messages d'alerte", () => {
  const actif = { source: "binance" as const, symbole: "BTCUSDT", nom: "Bitcoin" };
  const condition = { type: "prix" as const, sens: "au-dessus" as const, seuil: 70000 };
  it("distingue alerte, objectif et stop", () => {
    const a = messageAlerte({ actif, condition }, "70 100");
    expect(a).toMatchObject({ evenement: "alertes", titre: "Alerte : BTCUSDT" });
    const tp = messageAlerte({ actif, condition, tpLot: "l1" }, "70 100");
    expect(tp).toMatchObject({ evenement: "niveaux", titre: "Objectif (TP) atteint : BTCUSDT" });
    const sl = messageAlerte({ actif, condition, slLot: "l1" }, "60 000");
    expect(sl).toMatchObject({ evenement: "niveaux", titre: "Stop loss touché : BTCUSDT" });
    expect(sl.court.length).toBeLessThanOrEqual(160);
    expect(sl.html).toContain("Stop loss touché");
  });
});

describe("planning du récap", () => {
  const recap = { matin: { actif: true, heure: "07:00" }, soir: { actif: true, heure: "20:00" } };
  const vide = { jours: {}, dernierMs: 0 };
  const a = (h: number, m = 0, jour = 10) => new Date(2026, 10, jour, h, m);
  it("lit les heures", () => {
    expect(minutesDe("07:30")).toBe(450);
    expect(minutesDe("7:05")).toBe(425);
    expect(minutesDe("24:00")).toBeNull();
    expect(minutesDe("abc")).toBeNull();
  });
  it("envoie à l'heure, pas avant", () => {
    expect(creneauxDus(recap, a(6, 59), vide)).toEqual([]);
    expect(creneauxDus(recap, a(7, 0), vide)).toEqual(["matin"]);
    expect(creneauxDus(recap, a(20, 30), vide)).toEqual(["soir"]);
  });
  it("rattrape un récap manqué dans les trois heures, pas au-delà", () => {
    expect(creneauxDus(recap, a(9, 59), vide)).toEqual(["matin"]);
    expect(creneauxDus(recap, a(10, 0), vide)).toEqual([]);
  });
  it("n'envoie qu'une fois par jour et par créneau", () => {
    const etat = { jours: { matin: jourLocal(a(7)) }, dernierMs: 1 };
    expect(creneauxDus(recap, a(8), etat)).toEqual([]);
    expect(creneauxDus(recap, a(8, 0, 11), etat)).toEqual(["matin"]);
  });
  it("ignore un créneau désactivé ou mal réglé", () => {
    expect(creneauxDus({ ...recap, matin: { actif: false, heure: "07:00" } }, a(8), vide)).toEqual([]);
    expect(creneauxDus({ ...recap, matin: { actif: true, heure: "??" } }, a(8), vide)).toEqual([]);
  });
});

function donnees(): DonneesRecap {
  return {
    quand: new Date(2026, 10, 28, 7, 0),
    devise: "EUR",
    tauxDevise: 1,
    portefeuille: {
      valeurEur: 12345,
      nbLignes: 3,
      nonValorisees: 0,
      variationJour: { deltaEur: 148, pct: 1.2 },
      pnlEur: 2100,
      pnlPct: 20.5,
      lignes: [
        { symbole: "NVDA", categorie: "Actions", poids: 0.5, pnlPct: 40, variationPct: 3.2 },
        { symbole: "BTCUSDT", categorie: "Cryptos", poids: 0.3, pnlPct: -5, variationPct: -1.1 },
      ],
      meilleure: { symbole: "NVDA", pnlPct: 40 },
      pire: { symbole: "BTCUSDT", pnlPct: -5 },
    },
    marche: [
      { symbole: "NVDA", nom: "NVIDIA", prix: 140, variationPct: 3.2, categorie: "Actions" },
      { symbole: "BTCUSDT", nom: "Bitcoin", prix: 70000, variationPct: -1.1, categorie: "Cryptos" },
      { symbole: "ETHUSDT", nom: "Ethereum", prix: 3500, variationPct: null, categorie: "Cryptos" },
    ],
    fearGreed: { valeur: 62, libelle: "Avidité" },
    capitalisation: { totalMdUsd: 2400, dominanceBtc: 54.2, variation24h: -0.8 },
    alertes: { declenchees: [{ symbole: "NVDA", libelle: "Prix ≥ 140", quandMs: 1 }], armees: 4 },
    niveaux: [{ symbole: "NVDA", type: "TP", distancePct: 2.5 }],
  };
}

describe("récap", () => {
  it("résume portefeuille, liste, marché et alertes", () => {
    const r = construireRecap(donnees(), "matin");
    expect(r.evenement).toBe("recap");
    expect(r.titre).toMatch(/récap du matin/);
    expect(r.texte).toContain("Valeur : 12 345 €");
    expect(r.texte).toContain("+1,2 % sur 24 h");
    expect(r.texte).toContain("Hausses : NVDA +3,2 %");
    expect(r.texte).toContain("Baisses : BTCUSDT −1,1 %");
    expect(r.texte).toContain("Fear & Greed crypto : 62 (Avidité)");
    expect(r.texte).toContain("1 déclenchée depuis le dernier récap");
    expect(r.texte).toContain("Objectif proche : NVDA à 2,5 %");
    expect(r.texte).not.toContain("Commentaire IA");
  });
  it("la version SMS tient en 160 caractères", () => {
    const r = construireRecap(donnees(), "soir");
    expect(sansAccents(r.court).length).toBeLessThanOrEqual(160);
    expect(r.court).toContain("12 345 €");
  });
  it("sans portefeuille, le récap reste valable ; le HTML échappe le texte", () => {
    const d = donnees();
    d.portefeuille = null;
    d.commentaireIa = "Le marché <hésite>.";
    const r = construireRecap(d, "matin");
    expect(r.texte).not.toContain("Portefeuille");
    expect(r.texte).toContain("Commentaire IA");
    expect(r.html).toContain("&lt;hésite&gt;");
  });
  it("affiche des tirets quand le taux de change manque", () => {
    const d = donnees();
    d.devise = "USD";
    d.tauxDevise = null;
    expect(construireRecap(d, "matin").texte).toContain("Valeur : —");
  });
});

describe("IA", () => {
  it("n'envoie le portefeuille que sur demande, et jamais en montants", () => {
    const sans = resumeDonnees(donnees(), false);
    expect(sans).not.toContain("Portefeuille");
    expect(sans).toContain("Fear & Greed crypto : 62/100");
    const avec = resumeDonnees(donnees(), true);
    expect(avec).toContain("poids 50.0 %");
    expect(avec).not.toMatch(/12\s?345|2\s?100|148/);
  });
  it("compose une invite avec garde-fous", () => {
    const i = construireInvite("marche", donnees(), false);
    expect(i.systeme).toMatch(/jamais de conseil/);
    expect(i.utilisateur).toContain("NVDA");
    expect(construireInvite("recap", donnees(), false).utilisateur).toMatch(/90 mots/);
  });
  it("lit la réponse d'OpenRouter ou son erreur", () => {
    expect(extraireReponseIA('{"choices":[{"message":{"content":"  Bonjour  "}}]}')).toBe("Bonjour");
    expect(() => extraireReponseIA('{"error":{"message":"Insufficient credits"}}')).toThrow("Insufficient credits");
    expect(() => extraireReponseIA('{"choices":[]}')).toThrow(/rien répondu/);
    expect(() => extraireReponseIA("<html>")).toThrow(/illisible/);
  });
});
