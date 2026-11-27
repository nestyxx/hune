import { ChartLine, Gem, ArrowLeftRight } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { baseCrypto, initiales, teinte } from "./icones";
import { natureYahoo } from "./noms-affiches";
import type { Actif } from "./donnees/types";

/**
 * Icônes de cryptos embarquées dans l'application (voir `scripts/preparer-icones.mjs`) : aucune image n'est chargée depuis
 * Internet pour elles, donc rien ne révèle les actifs que vous suivez et tout fonctionne hors ligne.
 */
const ICONES = import.meta.glob("./assets/cryptos/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/**
 * Logos des actions et ETF : récupérés sur Financial Modeling Prep (image publique, sans compte), UNIQUEMENT pour les titres
 * suivis, et gardés par le cache du navigateur. Désactivable dans Réglages (le symbole n'est alors envoyé à personne).
 */
const CLE_LOGOS = "hune.logosActions";
const abonnes = new Set<() => void>();
export const logosActionsActifs = () => localStorage.getItem(CLE_LOGOS) !== "0";
export function definirLogosActions(actif: boolean) {
  localStorage.setItem(CLE_LOGOS, actif ? "1" : "0");
  abonnes.forEach((f) => f());
}
export function useLogosActions(): boolean {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    logosActionsActifs,
  );
}
export const urlLogoTitre = (symbole: string) => `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbole)}.png`;
/** Symboles dont le logo est introuvable (404) : on ne les redemande pas pendant la session. */
const sansLogo = new Set<string>();

/**
 * Pastille ronde d'un actif : l'icône de la crypto si on l'a, le logo de l'entreprise pour une action ou un ETF s'il existe,
 * un pictogramme pour un indice, une matière première ou une devise, sinon les initiales sur une couleur stable.
 */
export function IconeActif({ actif, taille = 20 }: { actif: Pick<Actif, "source" | "symbole" | "nom">; taille?: number }) {
  const logosOn = useLogosActions();
  const [, rafraichir] = useState(0);
  const base = baseCrypto(actif);
  const url = base ? ICONES[`./assets/cryptos/${base}.svg`] : undefined;
  if (url) return <img src={url} alt="" width={taille} height={taille} className="shrink-0 rounded-full" draggable={false} />;
  const nature = natureYahoo(actif);
  const h = teinte(actif.symbole);
  const style = { width: taille, height: taille, fontSize: Math.round(taille * 0.42), background: `hsl(${h} 70% 90%)`, color: `hsl(${h} 55% 32%)` };
  if (nature === "titre" && logosOn && !sansLogo.has(actif.symbole)) {
    return (
      <span aria-hidden className="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10" style={{ width: taille, height: taille }}>
        <img
          src={urlLogoTitre(actif.symbole)}
          alt=""
          width={taille}
          height={taille}
          className="h-full w-full object-contain"
          draggable={false}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => {
            sansLogo.add(actif.symbole);
            rafraichir((n) => n + 1);
          }}
        />
      </span>
    );
  }
  const pictogramme = nature === "indice" ? ChartLine : nature === "matiere" ? Gem : nature === "devise" ? ArrowLeftRight : null;
  return (
    <span aria-hidden className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold" style={style}>
      {pictogramme ? (() => {
        const P = pictogramme;
        return <P size={Math.round(taille * 0.56)} strokeWidth={2} />;
      })() : initiales(actif)}
    </span>
  );
}
