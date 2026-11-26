import { baseCrypto, initiales, teinte } from "./icones";
import type { Actif } from "./donnees/types";

/**
 * Icônes de cryptos embarquées dans l'application (voir `scripts/preparer-icones.mjs`) : aucune image n'est chargée depuis
 * Internet, donc rien ne révèle les actifs que vous suivez et tout fonctionne hors ligne.
 */
const ICONES = import.meta.glob("./assets/cryptos/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/**
 * Pastille ronde d'un actif : l'icône de la crypto si on l'a, sinon les initiales sur une couleur stable
 * (c'est le cas des actions : leurs logos sont des marques déposées, qu'on n'embarque pas).
 */
export function IconeActif({ actif, taille = 20 }: { actif: Pick<Actif, "source" | "symbole" | "nom">; taille?: number }) {
  const base = baseCrypto(actif);
  const url = base ? ICONES[`./assets/cryptos/${base}.svg`] : undefined;
  if (url) return <img src={url} alt="" width={taille} height={taille} className="shrink-0 rounded-full" draggable={false} />;
  const h = teinte(actif.symbole);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
      style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.42), background: `hsl(${h} 70% 90%)`, color: `hsl(${h} 55% 32%)` }}
    >
      {initiales(actif)}
    </span>
  );
}
