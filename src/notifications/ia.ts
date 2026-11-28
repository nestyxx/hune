import { envoyerHttp, couper } from "./canaux";
import { SECRETS } from "./secrets";
import type { DonneesRecap } from "./recap";

/**
 * Analyse de marché par une IA, via OpenRouter (https://openrouter.ai) : une seule clé donne accès à de nombreux modèles.
 * La clé est dans le coffre du système, l'appel part de la coque Rust. Seules des données de marché publiques sont envoyées ;
 * le portefeuille ne l'est que sur demande expresse, et alors uniquement en pourcentages (poids, performance), jamais en montants.
 */
export type TypeAnalyse = "marche" | "recap";

export const MODELES_SUGGERES = ["openrouter/auto", "anthropic/claude-sonnet-4.5", "openai/gpt-5-mini", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct:free"];

const SYSTEME = `Tu es un analyste de marché factuel et prudent. Tu écris en français clair, sans jargon inutile.
Règles : n'utilise que les données fournies, n'invente aucun chiffre, signale ce qui manque. Ne donne jamais de conseil personnalisé d'achat ou de vente : décris, compare, signale les risques et ce qu'il faut surveiller. Pas de titres markdown ni de tableaux : des paragraphes courts et des tirets. Termine par une phrase rappelant que ce n'est pas un conseil financier.`;

const pct = (v: number | null | undefined) => (v == null ? "n/d" : `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`);

/** Résumé compact des données, envoyé à l'IA. Le portefeuille n'y figure que si `inclurePortefeuille`, en pourcentages seulement. */
export function resumeDonnees(d: DonneesRecap, inclurePortefeuille: boolean): string {
  const l: string[] = [`Date : ${d.quand.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`];
  if (d.fearGreed) l.push(`Fear & Greed crypto : ${d.fearGreed.valeur}/100 (${d.fearGreed.libelle})`);
  if (d.capitalisation) l.push(`Capitalisation crypto totale : ${(d.capitalisation.totalMdUsd / 1000).toFixed(2)} T$ (${pct(d.capitalisation.variation24h)} sur 24 h), dominance du Bitcoin ${d.capitalisation.dominanceBtc.toFixed(1)} %`);
  if (d.marche.length) {
    l.push("Actifs suivis (variation sur 24 h ou depuis la clôture précédente) :");
    for (const a of d.marche.slice(0, 40)) l.push(`- ${a.symbole}${a.nom && a.nom !== a.symbole ? ` (${a.nom})` : ""} [${a.categorie}] : ${pct(a.variationPct)}`);
  }
  if (inclurePortefeuille && d.portefeuille) {
    const p = d.portefeuille;
    l.push(`Portefeuille de l'utilisateur (${p.nbLignes} lignes ; pourcentages seulement) : variation ${pct(p.variationJour?.pct)}, performance latente globale ${pct(p.pnlPct)}.`);
    for (const x of p.lignes) l.push(`- ${x.symbole} [${x.categorie}] : poids ${x.poids == null ? "n/d" : `${(x.poids * 100).toFixed(1)} %`}, gain latent ${pct(x.pnlPct)}, jour ${pct(x.variationPct)}`);
  }
  return l.join("\n");
}

/** Invite de l'analyse : détaillée dans l'onglet Marché, d'un paragraphe dans le récap. */
export function construireInvite(type: TypeAnalyse, d: DonneesRecap, inclurePortefeuille: boolean): { systeme: string; utilisateur: string } {
  const consigne =
    type === "marche"
      ? `Analyse l'état du marché d'après ces données, en 250 à 350 mots : 1) l'ambiance générale (crypto et, si présent, actions, indices, matières premières), 2) les mouvements notables dans la liste suivie et ce qui les relie, 3) les risques ou points d'attention, 4) ce qu'il serait utile de surveiller dans les prochains jours.${inclurePortefeuille ? " Ajoute un court paragraphe sur la diversification et la concentration du portefeuille indiqué." : ""}`
      : "Résume en 3 à 4 phrases (moins de 90 mots) ce qu'il faut retenir de ces données ce jour, sans conseil d'achat ni de vente.";
  return { systeme: SYSTEME, utilisateur: `${consigne}\n\nDonnées :\n${resumeDonnees(d, inclurePortefeuille)}` };
}

/** Texte de la réponse d'OpenRouter, ou l'erreur qu'elle contient. */
export function extraireReponseIA(corps: string): string {
  let j: { choices?: { message?: { content?: unknown } }[]; error?: { message?: string } };
  try {
    j = JSON.parse(corps);
  } catch {
    throw new Error("Réponse illisible d'OpenRouter.");
  }
  if (j.error?.message) throw new Error(j.error.message);
  const texte = j.choices?.[0]?.message?.content;
  if (typeof texte !== "string" || !texte.trim()) throw new Error("L'IA n'a rien répondu (essayez un autre modèle).");
  return texte.trim();
}

/** Interroge le modèle choisi. L'URL et la clé restent côté Rust. */
export async function interroger(modele: string, systeme: string, utilisateur: string, maxTokens = 900): Promise<string> {
  const corps = await envoyerHttp({
    methode: "POST",
    url: "https://openrouter.ai/api/v1/chat/completions",
    entetes: [
      ["Content-Type", "application/json"],
      ["Authorization", `Bearer {{secret:${SECRETS.openrouter}}}`],
      ["HTTP-Referer", "https://github.com/nestyxx/hune"],
      ["X-Title", "Hune"],
    ],
    corps: JSON.stringify({ model: modele.trim() || "openrouter/auto", max_tokens: maxTokens, temperature: 0.4, messages: [{ role: "system", content: systeme }, { role: "user", content: utilisateur }] }),
    delai_s: 90,
  });
  return couper(extraireReponseIA(corps), 6000);
}
