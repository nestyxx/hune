import { formaterMontant } from "../format";
import type { DeviseAffichage } from "../portefeuille";
import type { Message } from "./canaux";
import type { Creneau, EtatRecap } from "./config";

/** Tout ce que le récap (et l'analyse IA) sait du moment ; construit par `recap-donnees.ts`. Les montants du portefeuille sont en euros. */
export interface DonneesRecap {
  quand: Date;
  devise: DeviseAffichage;
  /** Taux euro → devise d'affichage (1 pour l'euro) ; null si inconnu. */
  tauxDevise: number | null;
  portefeuille: {
    valeurEur: number;
    nbLignes: number;
    nonValorisees: number;
    variationJour: { deltaEur: number; pct: number } | null;
    pnlEur: number | null;
    pnlPct: number | null;
    /** Poids (0–1) et performance des plus grosses lignes, pour l'analyse IA (jamais de montant). */
    lignes: { symbole: string; categorie: string; poids: number | null; pnlPct: number | null; variationPct: number | null }[];
    meilleure: { symbole: string; pnlPct: number } | null;
    pire: { symbole: string; pnlPct: number } | null;
  } | null;
  /** Actifs suivis avec leur cotation. */
  marche: { symbole: string; nom: string; prix: number; variationPct: number | null; categorie: string }[];
  fearGreed: { valeur: number; libelle: string } | null;
  capitalisation: { totalMdUsd: number; dominanceBtc: number; variation24h: number | null } | null;
  alertes: { declenchees: { symbole: string; libelle: string; quandMs: number }[]; armees: number };
  /** Objectifs et stops à moins de 5 % du cours. */
  niveaux: { symbole: string; type: "TP" | "Stop"; distancePct: number }[];
  commentaireIa?: string;
}

const signe = (v: number) => (v >= 0 ? "+" : "−");
const pct = (v: number | null | undefined) => (v == null ? "—" : `${signe(v)}${Math.abs(v).toFixed(1).replace(".", ",")} %`);
const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Jour local au format AAAA-MM-JJ. */
export const jourLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Heure « HH:MM » en minutes depuis minuit ; null si elle est mal formée. */
export function minutesDe(heure: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** Un récap manqué (ordinateur éteint à l'heure prévue) est encore envoyé s'il reste dans cette fenêtre. */
export const FENETRE_RATTRAPAGE_MIN = 180;

/**
 * Créneaux du récap à envoyer maintenant : l'heure prévue est passée depuis moins de trois heures
 * et le créneau n'a pas déjà été traité aujourd'hui.
 */
export function creneauxDus(recap: { matin: { actif: boolean; heure: string }; soir: { actif: boolean; heure: string } }, maintenant: Date, etat: EtatRecap): Creneau[] {
  const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
  const jour = jourLocal(maintenant);
  const dus: Creneau[] = [];
  for (const c of ["matin", "soir"] as const) {
    const r = recap[c];
    const prevu = minutesDe(r.heure);
    if (!r.actif || prevu == null || etat.jours[c] === jour) continue;
    if (minutes >= prevu && minutes < prevu + FENETRE_RATTRAPAGE_MIN) dus.push(c);
  }
  return dus;
}

interface Section {
  titre: string;
  lignes: string[];
}

/** Sections du récap, communes au texte, au HTML et au SMS. */
function sections(d: DonneesRecap, m: (eur: number | null) => string): Section[] {
  const s: Section[] = [];
  const p = d.portefeuille;
  if (p) {
    const l = [`Valeur : ${m(p.valeurEur)}${p.variationJour ? ` (${pct(p.variationJour.pct)} sur 24 h, ${signe(p.variationJour.deltaEur)}${m(Math.abs(p.variationJour.deltaEur))})` : ""}`];
    if (p.pnlEur != null) l.push(`Gain latent : ${signe(p.pnlEur)}${m(Math.abs(p.pnlEur))}${p.pnlPct != null ? ` (${pct(p.pnlPct)})` : ""}`);
    if (p.meilleure && p.pire && p.meilleure.symbole !== p.pire.symbole) l.push(`Meilleure ligne : ${p.meilleure.symbole} ${pct(p.meilleure.pnlPct)} · moins bonne : ${p.pire.symbole} ${pct(p.pire.pnlPct)}`);
    if (p.nonValorisees) l.push(`${p.nonValorisees} ligne${p.nonValorisees > 1 ? "s" : ""} sans prix : total partiel.`);
    s.push({ titre: "Portefeuille", lignes: l });
  }
  const avecVariation = d.marche.filter((a) => a.variationPct != null);
  if (avecVariation.length) {
    const tri = [...avecVariation].sort((a, b) => b.variationPct! - a.variationPct!);
    const hausses = tri.filter((a) => a.variationPct! > 0).slice(0, 3);
    const baisses = [...tri].reverse().filter((a) => a.variationPct! < 0).slice(0, 3);
    const l: string[] = [];
    if (hausses.length) l.push(`Hausses : ${hausses.map((a) => `${a.symbole} ${pct(a.variationPct)}`).join(" · ")}`);
    if (baisses.length) l.push(`Baisses : ${baisses.map((a) => `${a.symbole} ${pct(a.variationPct)}`).join(" · ")}`);
    if (l.length) s.push({ titre: "Liste de suivi", lignes: l });
  }
  const marche: string[] = [];
  if (d.fearGreed) marche.push(`Fear & Greed crypto : ${d.fearGreed.valeur} (${d.fearGreed.libelle})`);
  if (d.capitalisation) marche.push(`Capitalisation crypto : ${(d.capitalisation.totalMdUsd / 1000).toFixed(2).replace(".", ",")} T$${d.capitalisation.variation24h != null ? ` (${pct(d.capitalisation.variation24h)} sur 24 h)` : ""} · dominance BTC ${d.capitalisation.dominanceBtc.toFixed(1).replace(".", ",")} %`);
  if (marche.length) s.push({ titre: "Marché", lignes: marche });

  const a = d.alertes;
  const al: string[] = [];
  if (a.declenchees.length) {
    al.push(`${a.declenchees.length} déclenchée${a.declenchees.length > 1 ? "s" : ""} depuis le dernier récap :`);
    for (const x of a.declenchees.slice(0, 6)) al.push(`• ${x.symbole} : ${x.libelle}`);
    if (a.declenchees.length > 6) al.push(`• … et ${a.declenchees.length - 6} autre${a.declenchees.length - 6 > 1 ? "s" : ""}`);
  } else al.push("Aucune alerte déclenchée depuis le dernier récap.");
  al.push(`${a.armees} alerte${a.armees > 1 ? "s" : ""} armée${a.armees > 1 ? "s" : ""}.`);
  for (const n of d.niveaux.slice(0, 5)) al.push(`${n.type === "TP" ? "Objectif" : "Stop"} proche : ${n.symbole} à ${Math.abs(n.distancePct).toFixed(1).replace(".", ",")} %`);
  s.push({ titre: "Alertes", lignes: al });

  if (d.commentaireIa) s.push({ titre: "Commentaire IA (indicatif, pas un conseil)", lignes: d.commentaireIa.split(/\n+/).filter(Boolean) });
  return s;
}

/** SMS : une ligne, 160 caractères au plus après nettoyage. */
function courtDe(d: DonneesRecap, m: (eur: number | null) => string): string {
  const parts: string[] = ["Hune"];
  const p = d.portefeuille;
  if (p) parts.push(`${m(p.valeurEur)}${p.variationJour ? ` (${pct(p.variationJour.pct)})` : ""}`);
  const top = [...d.marche.filter((a) => a.variationPct != null)].sort((a, b) => Math.abs(b.variationPct!) - Math.abs(a.variationPct!))[0];
  if (top) parts.push(`${top.symbole} ${pct(top.variationPct)}`);
  if (d.alertes.declenchees.length) parts.push(`${d.alertes.declenchees.length} alerte${d.alertes.declenchees.length > 1 ? "s" : ""}`);
  return parts.join(" | ");
}

export function construireRecap(d: DonneesRecap, creneau: Creneau): Message {
  const taux = d.tauxDevise;
  const m = (eur: number | null) => (eur == null || taux == null ? "—" : formaterMontant(eur * taux, d.devise, 0));
  const jour = d.quand.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const titre = `Hune : récap du ${creneau === "matin" ? "matin" : "soir"}, ${jour}`;
  const sec = sections(d, m);
  const texte = sec.map((x) => `${x.titre}\n${x.lignes.join("\n")}`).join("\n\n");
  const html =
    `<div style="font-family:Segoe UI,Arial,sans-serif;color:#182132;max-width:560px">` +
    `<h2 style="margin:0 0 12px;font-weight:600">${echapper(titre)}</h2>` +
    sec.map((x) => `<h3 style="margin:16px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#667389">${echapper(x.titre)}</h3><p style="margin:0;line-height:1.55">${x.lignes.map(echapper).join("<br>")}</p>`).join("") +
    `<p style="margin:20px 0 0;font-size:11px;color:#667389">Envoyé par Hune depuis votre ordinateur. Données différées, aucune valeur de conseil.</p></div>`;
  return { evenement: "recap", titre, texte, court: courtDe(d, m), html };
}
