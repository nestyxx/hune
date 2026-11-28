import type { Message } from "./canaux";
import type { ConfigNotifications, Creneau } from "./config";
import { construireInvite, interroger } from "./ia";
import { construireRecap } from "./recap";
import { rassemblerDonnees, type EntreesRecap } from "./recap-donnees";
import { SECRETS, secretExiste } from "./secrets";

/** Rassemble les données, ajoute au besoin le commentaire de l'IA (un échec de l'IA n'empêche jamais le récap) et compose le message. */
export async function preparerRecap(config: ConfigNotifications, entrees: EntreesRecap, creneau: Creneau): Promise<Message> {
  const donnees = await rassemblerDonnees(entrees);
  if (config.recap.commentaireIa && (await secretExiste(SECRETS.openrouter))) {
    try {
      const { systeme, utilisateur } = construireInvite("recap", donnees, config.ia.inclurePortefeuille);
      donnees.commentaireIa = await interroger(config.ia.modele, systeme, utilisateur, 350);
    } catch (e) {
      console.warn("Commentaire IA du récap indisponible :", e);
    }
  }
  return construireRecap(donnees, creneau);
}
