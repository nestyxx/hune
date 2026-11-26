/**
 * Prépare les icônes de cryptos embarquées dans Hune (src/assets/cryptos/*.svg).
 *
 * Source : le paquet npm « @web3icons/core » (licence MIT, https://github.com/0xa3k5/web3icons). On n'ajoute PAS ce paquet
 * au projet : on le télécharge à part, on en copie seulement les icônes des tokens cotés sur Binance (EUR, USDT ou USDC),
 * et l'application les embarque. Au runtime, aucune image n'est chargée depuis Internet : la liste d'actifs que vous suivez
 * ne sort donc jamais de votre poste (la politique de sécurité de l'application n'autorise d'ailleurs que les images locales).
 *
 * Usage :
 *   npm pack @web3icons/core            (dans un dossier temporaire, puis extraire l'archive)
 *   node scripts/preparer-icones.mjs <dossier>/package/dist/svgs/tokens/branded
 *
 * Garde-fous : on écarte tout SVG de plus de 28 Ko (images matricielles embarquées), contenant un script, un gestionnaire
 * d'événement, une référence externe ou autre chose qu'un SVG.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("Usage : node scripts/preparer-icones.mjs <dossier tokens/branded du paquet>");
  process.exit(1);
}
const sortie = join(import.meta.dirname, "..", "src", "assets", "cryptos");
const TAILLE_MAX = 28 * 1024;
/** Tokens renommés : le paquet garde l'ancien nom (RNDR est devenu RENDER chez Binance). */
const ALIAS = { RENDER: "RNDR" };

const info = await (await fetch("https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT")).json();
const bases = new Set(info.symbols.filter((s) => s.status === "TRADING" && ["EUR", "USDT", "USDC"].includes(s.quoteAsset)).map((s) => s.baseAsset));
console.log(`${bases.size} tokens cotés sur Binance.`);

const dispo = new Set(readdirSync(source).filter((f) => f.endsWith(".svg.js")).map((f) => f.slice(0, -".svg.js".length)));
rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

/** Le paquet exporte chaque icône comme une chaîne JS (« var BTC = '<svg…>'; export default BTC; ») : on la lit sans exécuter le code. */
function extraireSvg(texte) {
  const debut = texte.indexOf("'<svg");
  const fin = texte.lastIndexOf("</svg>"); // la chaîne se termine par « </svg>\n' » : on coupe juste après la dernière balise
  if (debut < 0 || fin < 0) return null;
  return texte
    .slice(debut + 1, fin + "</svg>".length)
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

let copies = 0;
const ecartes = { absent: 0, lourd: 0, suspect: 0 };
for (const base of [...bases].sort()) {
  // Binance a des jetons à multiplicateur (1000SATS, 1MBABYDOGE…) : on ne garde que les noms usuels.
  if (!/^[A-Z0-9]{1,12}$/.test(base)) continue;
  const nomFichier = dispo.has(base) ? base : ALIAS[base];
  if (!nomFichier || !dispo.has(nomFichier)) {
    ecartes.absent++;
    continue;
  }
  const svg = extraireSvg(readFileSync(join(source, `${nomFichier}.svg.js`), "utf8"));
  if (!svg || !svg.startsWith("<svg") || !svg.endsWith("</svg>")) {
    ecartes.suspect++;
    continue;
  }
  if (Buffer.byteLength(svg) > TAILLE_MAX) {
    ecartes.lourd++;
    continue;
  }
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|xlink:href\s*=\s*["']https?:|href\s*=\s*["']https?:|<image/i.test(svg)) {
    ecartes.suspect++;
    continue;
  }
  writeFileSync(join(sortie, `${base}.svg`), svg + "\n");
  copies++;
}
console.log(`${copies} icônes copiées dans src/assets/cryptos. Écartées : ${ecartes.absent} sans icône dans le paquet, ${ecartes.lourd} trop lourdes, ${ecartes.suspect} suspectes.`);
