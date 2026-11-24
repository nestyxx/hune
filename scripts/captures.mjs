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

/** Client CDP minimal (protocole de débogage de WebView2). */
async function connecter() {
  for (let i = 0; i < 150; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = pages.find((p) => p.type === "page" && p.url.startsWith("http://localhost:1421"));
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, e) => ((ws.onopen = r), (ws.onerror = e)));
        let id = 0;
        const envoyer = (method, params = {}) =>
          new Promise((res, rej) => {
            const mon = ++id;
            const h = (m) => {
              const d = JSON.parse(m.data);
              if (d.id !== mon) return;
              ws.removeEventListener("message", h);
              d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
            };
            ws.addEventListener("message", h);
            ws.send(JSON.stringify({ id: mon, method, params }));
          });
        return { envoyer, fermer: () => ws.close() };
      }
    } catch {
      /* l'application compile encore ou démarre : on réessaie */
    }
    await attendre(2000);
  }
  throw new Error("L'application de démonstration n'a pas démarré (port 1421 déjà utilisé ? arrêtez `npm run dev`).");
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
