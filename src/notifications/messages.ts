import { decrire, type Alerte } from "../alertes/moteur";
import { symboleAffiche } from "../noms-affiches";
import type { Message } from "./canaux";

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nature d'une alerte déclenchée : objectif (TP) ou stop loss du portefeuille, ou alerte ordinaire. */
export const natureAlerte = (a: Pick<Alerte, "tpLot" | "slLot">): "tp" | "stop" | "alerte" => (a.tpLot ? "tp" : a.slLot ? "stop" : "alerte");

/**
 * Message envoyé quand une alerte se déclenche. `mesure` est la valeur déjà formatée (prix, % ou RSI).
 * Les objectifs et stops ont leur propre type d'événement : on peut ne recevoir que ceux-là.
 */
export function messageAlerte(a: Pick<Alerte, "actif" | "condition" | "tpLot" | "slLot">, mesure: string): Message {
  const nature = natureAlerte(a);
  const symbole = symboleAffiche(a.actif);
  const titre = nature === "tp" ? `Objectif (TP) atteint : ${symbole}` : nature === "stop" ? `Stop loss touché : ${symbole}` : `Alerte : ${symbole}`;
  const condition = decrire(a.condition);
  const texte = `${condition}\nValeur actuelle : ${mesure}\n${a.actif.nom}`;
  const court = nature === "tp" ? `Hune : TP atteint sur ${symbole} (${mesure})` : nature === "stop" ? `Hune : STOP touche sur ${symbole} (${mesure})` : `Hune : ${symbole} ${condition} (${mesure})`;
  const html = `<p style="font-size:16px;margin:0 0 8px"><b>${echapper(titre)}</b></p><p style="margin:0">${echapper(condition)}<br>Valeur actuelle : <b>${echapper(mesure)}</b><br><span style="color:#667389">${echapper(a.actif.nom)}</span></p>`;
  return { evenement: nature === "alerte" ? "alertes" : "niveaux", titre, texte, court, html };
}

/** Message de test d'un canal. */
export const messageTest = (nomCanal: string): Message => ({
  evenement: "alertes",
  titre: "Hune : message de test",
  texte: `Ce message confirme que le canal « ${nomCanal} » fonctionne.\nVous recevrez ici vos alertes et, si vous l'avez demandé, le récap quotidien.`,
  court: "Hune : message de test, ce canal fonctionne.",
});
