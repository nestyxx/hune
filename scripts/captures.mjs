// Génère les captures d'écran du README (docs/captures/*.png) avec des données de démonstration FICTIVES.
//
//   npm run captures
//
// Lance une instance de développement ISOLÉE (identifiant io.github.nestyxx.hune.demo, donc dossier de données et
// profil WebView distincts) : vos vraies données ne sont jamais ouvertes ni modifiées. Les prix, eux, sont réels
// (Binance, Yahoo) : les captures reflètent donc le marché du moment, avec un portefeuille imaginaire.
// À relancer à chaque version, puis à relire les images avant de les commiter.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ID = "io.github.nestyxx.hune.demo";
const PORT = 9334;
const donneesDemo = join(process.env.APPDATA, ID);
const profilWebview = join(process.env.LOCALAPPDATA, ID);
const sortie = join(racine, "docs", "captures");
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Données fictives + alertes dont les seuils suivent le cours du moment (pour qu'elles s'affichent sur le graphique). */
async function preparerDonnees() {
  const demo = JSON.parse(readFileSync(join(racine, "scripts", "donnees-demo.json"), "utf8"));
  delete demo._commentaire;
  const { price } = await (await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDC")).json();
  const prix = Number(price);
  const arrondi = (n) => Math.round(n / 100) * 100;
  const actif = (symbole) => demo.actifs.find((a) => a.symbole === symbole);
  const maintenant = Date.now();
  const jour = 86_400_000;
  // Conditions choisies pour ne PAS se déclencher pendant la capture (aucune notification Windows parasite).
  demo.alertes = [
    { id: "demo-a1", actif: actif("BTCUSDC"), condition: { type: "prix", sens: "au-dessus", seuil: arrondi(prix * 1.06) }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a2", actif: actif("BTCUSDC"), condition: { type: "prix", sens: "en-dessous", seuil: arrondi(prix * 0.94) }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a3", actif: actif("BTCUSDC"), condition: { type: "rsi", sens: "au-dessus", seuil: 85, intervalle: "1h" }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a4", actif: actif("BTCUSDC"), condition: { type: "croisement", modele: "macd", sens: "haussier", intervalle: "1h" }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a5", actif: actif("ETHUSDC"), condition: { type: "variation", sens: "hausse", pct: 15, periode: "24h" }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a6", actif: actif("MSFT"), condition: { type: "franchissement", moyenne: "sma", periode: 50, sens: "au-dessus", intervalle: "1d" }, statut: "armee", creeeLe: maintenant },
    { id: "demo-a7", actif: actif("BTCUSDC"), condition: { type: "prix", sens: "au-dessus", seuil: arrondi(prix * 0.8) }, statut: "declenchee", creeeLe: maintenant - 3 * jour, declencheeLe: maintenant - 2 * jour, valeur: arrondi(prix * 0.8) + 300 },
  ];
  rmSync(donneesDemo, { recursive: true, force: true });
  mkdirSync(donneesDemo, { recursive: true });
  writeFileSync(join(donneesDemo, "hune.json"), JSON.stringify(demo));
}

function lancerApp() {
  const cli = join(racine, "node_modules", "@tauri-apps", "cli", "tauri.js");
  return spawn(process.execPath, [cli, "dev", "--config", JSON.stringify({ identifier: ID })], {
    cwd: racine,
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
    windowsHide: true,
  });
}

/** Client CDP minimal (protocole de débogage de WebView2), avec reconnexion si l'application redémarre. */
async function ouvrirSession() {
  for (let i = 0; i < 150; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = pages.find((p) => p.type === "page" && p.url.startsWith("http://localhost:1421"));
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, e) => ((ws.onopen = r), (ws.onerror = e)));
        return ws;
      }
    } catch {
      /* l'application compile encore ou démarre : on réessaie */
    }
    await attendre(2000);
  }
  throw new Error("L'application de démonstration n'a pas démarré (port 1421 déjà utilisé ? arrêtez `npm run dev`).");
}

async function connecter() {
  let ws = await ouvrirSession();
  let id = 0;
  const unSeulEssai = (method, params) =>
    new Promise((res, rej) => {
      const mon = ++id;
      const delai = setTimeout(() => rej(new Error(`Délai dépassé : ${method}`)), 45_000);
      const h = (m) => {
        const d = JSON.parse(m.data);
        if (d.id !== mon) return;
        clearTimeout(delai);
        ws.removeEventListener("message", h);
        d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
      };
      ws.addEventListener("message", h);
      if (ws.readyState !== WebSocket.OPEN) return (clearTimeout(delai), rej(new Error("Connexion fermée")));
      ws.send(JSON.stringify({ id: mon, method, params }));
    });
  const envoyer = async (method, params = {}) => {
    try {
      return await unSeulEssai(method, params);
    } catch (e) {
      // L'application a redémarré (rechargement à chaud) : on se reconnecte une fois, puis on rejoue la commande.
      console.log("  … reconnexion :", e.message);
      ws = await ouvrirSession();
      await unSeulEssai("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      await attendre(6000);
      return unSeulEssai(method, params);
    }
  };
  return { envoyer, fermer: () => ws.close() };
}

async function main() {
  mkdirSync(sortie, { recursive: true });
  await preparerDonnees();
  console.log("Lancement de l'instance de démonstration (la première fois, la compilation prend quelques minutes)…");
  const app = lancerApp();
  try {
    const cdp = await connecter();
    await cdp.envoyer("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const page = async (corps) => {
      const r = await cdp.envoyer("Runtime.evaluate", {
        expression: `(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const touche=k=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k}));const boutons=()=>[...document.querySelectorAll('button')];${corps}})()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + JSON.stringify(r.exceptionDetails.exception?.description));
      return r.result.value;
    };
    const capturer = async (nom) => {
      const { data } = await cdp.envoyer("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(sortie, `${nom}.png`), Buffer.from(data, "base64"));
      console.log("  ✓", `docs/captures/${nom}.png`);
    };

    await attendre(6000); // chargement des données et premiers prix
    for (const theme of ["clair", "sombre"]) {
      console.log(`Thème ${theme}`);
      await page(`touche('p'); await sleep(400); boutons().find(b=>b.textContent.trim()==='${theme === "clair" ? "Clair" : "Sombre"}').click(); await sleep(600);`);

      await page(`touche('g'); await sleep(300); document.querySelector('li[data-actif="binance:BTCUSDC"]').click(); await sleep(300); touche('2'); await sleep(8000);`);
      await capturer(`graphique-${theme}`);

      await page(`touche('f'); await sleep(10000);`);
      await capturer(`portefeuille-${theme}`);

      await page(`touche('m'); await sleep(5000);`);
      await capturer(`marche-${theme}`);

      await page(`touche('a'); await sleep(1500);`);
      await capturer(`alertes-${theme}`);
    }

    // --- Mode compact (vraie petite fenêtre : on retire l'émulation de taille pour capturer la fenêtre telle quelle) ---
    const metriques = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };
    const compact = async (theme) => {
      await page(`touche('g'); await sleep(300); document.querySelector('button[aria-label="Mode compact"]').click(); await sleep(2500);`);
      await cdp.envoyer("Emulation.clearDeviceMetricsOverride");
      await attendre(2500);
      const largeur = await page("return window.innerWidth;");
      console.log(`  mode compact : largeur de la fenêtre = ${largeur} px`);
      if (largeur > 500) throw new Error("Le mode compact n'a pas réduit la fenêtre.");
      await capturer(`compact-${theme}`);
      await page(`touche('Escape'); await sleep(2500);`);
      await cdp.envoyer("Emulation.setDeviceMetricsOverride", metriques);
      await attendre(1500);
      const apres = await page("return window.innerWidth;");
      if (apres < 800) throw new Error("La sortie du mode compact n'a pas restauré la fenêtre.");
    };
    console.log("Mode compact");
    await compact("sombre");
    await page(`touche('p'); await sleep(400); boutons().find(b=>b.textContent.trim()==='Clair').click(); await sleep(600);`);
    await compact("clair");

    // --- Menu réduit (icônes seules) ---
    console.log("Menu réduit");
    await page(`touche('g'); await sleep(300); boutons().find(b=>b.getAttribute('aria-label')==='Réduire le menu').click(); await sleep(700);`);
    await capturer("menu-reduit-clair");
    await page(`boutons().find(b=>b.getAttribute('aria-label')==='Agrandir le menu').click(); await sleep(500);`);
    cdp.fermer();
  } finally {
    // Arrête toute l'arborescence de l'instance de démonstration (jamais votre Hune habituelle) puis efface ses données.
    try {
      execFileSync("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* déjà arrêtée */
    }
    await attendre(3000);
    for (const d of [donneesDemo, profilWebview]) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}

main().catch((e) => {
  console.error("Échec :", e.message);
  process.exit(1);
});
