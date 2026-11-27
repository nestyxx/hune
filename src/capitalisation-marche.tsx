import { useEffect, useRef, useState } from "react";
import { ajouterPoint, ecrireHistorique, lireHistorique, valeurIlYa, type PointCapitalisation } from "./capitalisation-historique";
import { chargerCapitalisation, type Capitalisation } from "./donnees/capitalisation";
import { formaterPct } from "./format";
import { MiniCourbe } from "./mini-courbe";

const fr = (v: number, decimales: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Gros montant en dollars : « 2,08 T$ » (billions français) ou « 880 Md$ ». */
export function formaterGrosMontant(v: number): string {
  return v >= 1e12 ? `${fr(v / 1e12, 2)} T$` : `${fr(v / 1e9, v >= 1e11 ? 0 : 1)} Md$`;
}

/** Capitalisation du marché crypto, rafraîchie toutes les 5 minutes, et son historique local. */
function useCapitalisation() {
  const [capitalisation, setCapitalisation] = useState<Capitalisation | null>(null);
  const [historique, setHistorique] = useState<PointCapitalisation[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const histRef = useRef<PointCapitalisation[]>([]);

  useEffect(() => {
    let actif = true;
    void lireHistorique().then((h) => {
      if (!actif) return;
      histRef.current = h;
      setHistorique(h);
    });
    const charger = async () => {
      try {
        const c = await chargerCapitalisation();
        if (!actif) return;
        setCapitalisation(c);
        setErreur(null);
        const suivant = ajouterPoint(histRef.current, c, Date.now());
        if (suivant !== histRef.current) {
          histRef.current = suivant;
          setHistorique(suivant);
          void ecrireHistorique(suivant).catch(() => undefined);
        }
      } catch (e) {
        if (actif) setErreur(e instanceof Error ? e.message : String(e));
      }
    };
    void charger();
    const t = setInterval(() => void charger(), 5 * 60_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, []);
  return { capitalisation, historique, erreur };
}

interface Carte {
  titre: string;
  valeur: string;
  aide: string;
  /** Variation sur 24 h en % (ou en points pour la dominance). */
  variation: number | null;
  points: boolean;
  courbe: number[];
}

/** Cartes « Capitalisation du marché crypto » de l'écran Marché : dominance du Bitcoin, total, sans Bitcoin, sans Bitcoin ni Ethereum. */
export function CapitalisationMarche() {
  const { capitalisation: c, historique, erreur } = useCapitalisation();
  if (!c) return erreur ? <p className="m-0 text-xs text-doux">Capitalisation du marché crypto indisponible ({erreur}).</p> : null;
  const maintenant = Date.now();
  const J = 24 * 3600_000;
  const varRel = (cle: "total" | "total2" | "total3", actuel: number) => {
    const avant = valeurIlYa(historique, cle, maintenant, J);
    return avant ? (actuel / avant - 1) * 100 : cle === "total" ? c.variation24h : null;
  };
  const dominanceAvant = valeurIlYa(historique, "dominanceBtc", maintenant, J);
  const serie = (cle: "total" | "total2" | "total3" | "dominanceBtc") => historique.map((p) => p[cle]);
  const cartes: Carte[] = [
    { titre: "Dominance du Bitcoin", valeur: `${fr(c.dominanceBtc, 2)} %`, aide: "Part du Bitcoin dans la capitalisation totale des cryptos (Ethereum : " + fr(c.dominanceEth, 2) + " %). Variation en points sur 24 h.", variation: dominanceAvant != null ? c.dominanceBtc - dominanceAvant : null, points: true, courbe: serie("dominanceBtc") },
    { titre: "Capitalisation totale", valeur: formaterGrosMontant(c.total), aide: "Valeur de toutes les cryptos réunies (TOTAL).", variation: varRel("total", c.total), points: false, courbe: serie("total") },
    { titre: "Total sans Bitcoin", valeur: formaterGrosMontant(c.total2), aide: "Capitalisation totale moins celle du Bitcoin (TOTAL2) : Ethereum et toutes les altcoins.", variation: varRel("total2", c.total2), points: false, courbe: serie("total2") },
    { titre: "Total sans Bitcoin ni Ethereum", valeur: formaterGrosMontant(c.total3), aide: "Capitalisation totale moins Bitcoin et Ethereum (TOTAL3) : les altcoins.", variation: varRel("total3", c.total3), points: false, courbe: serie("total3") },
  ];
  return (
    <section>
      <h2 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-doux" title="Source : CoinGecko (plus de 20 000 jetons). TradingView s'arrête aux 125 premiers : ses valeurs diffèrent de quelques pour cent, la tendance est la même. Les courbes et variations se construisent au fil de vos ouvertures de Hune.">
        Capitalisation du marché crypto
      </h2>
      <div className="grid gap-3 md:grid-cols-4">
        {cartes.map((k) => (
          <div key={k.titre} className="carte-info flex items-end justify-between gap-2 p-4" title={k.aide}>
            <div className="min-w-0">
              <div className="truncate text-xs text-doux">{k.titre}</div>
              <div className="titre-serif text-2xl leading-tight">{k.valeur}</div>
              <div className={`font-mono text-xs ${k.variation == null ? "text-doux" : k.variation >= 0 ? "text-hausse" : "text-baisse"}`}>
                {k.variation == null ? "24 h : en cours de collecte" : k.points ? `${k.variation >= 0 ? "+" : "−"}${fr(Math.abs(k.variation), 2)} pt · 24 h` : `${formaterPct(k.variation)} · 24 h`}
              </div>
            </div>
            {k.courbe.length >= 3 && <MiniCourbe valeurs={k.courbe} largeur={64} hauteur={28} />}
          </div>
        ))}
      </div>
    </section>
  );
}
