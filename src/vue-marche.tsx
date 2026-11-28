import { useEffect, useMemo, useState } from "react";
import type { Groupe } from "./categories";
import { useNouvellesActualites } from "./actualites-vues";
import { CapitalisationMarche } from "./capitalisation-marche";
import { Chargeur, EnTete } from "./composants";
import { chargerSentiment, libelleSentiment, type PointSentiment } from "./donnees/sentiment";
import { cleActif, type Actif, type Cotation } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";
import { IconeActif } from "./icone-actif";
import { symboleAffiche } from "./noms-affiches";

interface Props {
  groupes: Groupe[];
  cotations: Record<string, Cotation>;
  surOuvrir: (cle: string) => void;
}

/** Couleur d'une tuile : intensité proportionnelle à la variation (saturée à ±6 %). */
function couleurTuile(pct: number | null | undefined): string {
  if (pct == null) return "color-mix(in srgb, var(--color-doux) 25%, var(--color-carte))";
  const intensite = Math.min(Math.abs(pct) / 6, 1);
  const base = pct >= 0 ? "var(--color-hausse)" : "var(--color-baisse)";
  return `color-mix(in srgb, ${base} ${Math.round(18 + intensite * 62)}%, var(--color-carte))`;
}

/** Jauge « Fear & Greed » : valeur du jour + petite courbe des derniers jours. */
function Sentiment() {
  const [points, setPoints] = useState<PointSentiment[] | null>(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    chargerSentiment().then(setPoints).catch(() => setErreur(true));
  }, []);
  if (erreur) return <div className="carte-info p-4 text-xs text-doux">Indice Fear &amp; Greed indisponible.</div>;
  if (!points?.length) return <div className="carte-info p-4"><Chargeur texte="Chargement de l'indice Fear & Greed…" /></div>;
  const dernier = points[points.length - 1];
  const veille = points[points.length - 2];
  return (
    <div className="carte-info p-4" title="Indice de sentiment du marché crypto (0 = peur extrême, 100 = avidité extrême), source alternative.me">
      <div className="text-xs text-doux">Crypto : Fear &amp; Greed</div>
      <div className="flex items-end gap-3">
        <span className="titre-serif text-[52px] leading-none">{dernier.valeur}</span>
        <span className="pb-1">
          {libelleSentiment(dernier.valeur)}
          {veille && <span className="ml-2 text-xs text-doux">veille : {veille.valeur}</span>}
        </span>
      </div>
      <div className="mt-2 flex h-8 items-end gap-0.5">
        {points.map((p) => (
          <div key={p.temps} title={`${new Date(p.temps * 1000).toLocaleDateString("fr-FR")} : ${p.valeur}`} className="flex-1 rounded-sm" style={{ height: `${Math.max(p.valeur, 4)}%`, background: couleurTuile((p.valeur - 50) / 8) }} />
        ))}
      </div>
    </div>
  );
}

/** Onglet « Marché » : carte thermique de la watchlist par catégorie et plus fortes variations. */
export function VueMarche({ groupes, cotations, surOuvrir }: Props) {
  const tous = useMemo(() => groupes.flatMap((g) => g.actifs), [groupes]);
  const nouvelles = useNouvellesActualites(tous, true);
  const variations = useMemo(() => {
    const avec = tous.filter((a) => cotations[cleActif(a)]?.variationPct != null);
    const tri = [...avec].sort((a, b) => cotations[cleActif(b)].variationPct! - cotations[cleActif(a)].variationPct!);
    // Une « hausse » est strictement positive, une « baisse » strictement négative : jamais l'une dans la liste de l'autre.
    const pct = (a: Actif) => cotations[cleActif(a)].variationPct!;
    return { hausses: tri.filter((a) => pct(a) > 0).slice(0, 5), baisses: tri.filter((a) => pct(a) < 0).slice(-5).reverse() };
  }, [tous, cotations]);

  /** Aucune cotation reçue pour l'instant : on montre des barres qui brillent plutôt que des listes vides. */
  const enChargement = tous.length > 0 && tous.every((a) => cotations[cleActif(a)] == null);
  const squelettes = (
    <div className="space-y-2 py-1" role="status" aria-label="Chargement des cotations">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="squelette h-5 w-full" />
      ))}
    </div>
  );

  const ligne = (a: Actif) => {
    const c = cotations[cleActif(a)];
    return (
      <li key={cleActif(a)}>
        <button className="flex w-full items-center justify-between rounded-lg bg-transparent px-2 py-1 text-left text-texte hover:bg-fond" onClick={() => surOuvrir(cleActif(a))}>
          <span className="flex items-center gap-2 font-semibold">
            <IconeActif actif={a} taille={18} />
            {symboleAffiche(a)}
          </span>
          <span className={`font-mono text-xs ${classePct(c?.variationPct)}`}>{formaterPct(c?.variationPct)}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="apparait flex-1 space-y-5 overflow-auto p-6">
      <EnTete titre="Marché" sousTitre="Votre liste en un coup d'œil : couleur selon la variation affichée (24 h glissantes ou depuis 00:00 UTC, au choix dans Réglages)." />
      <div className="grid gap-3 md:grid-cols-3">
        <Sentiment />
        <div className="carte-info p-4">
          <div className="mb-1 text-xs text-doux">Plus fortes hausses (liste suivie)</div>
          {enChargement ? squelettes : <ul className="m-0 list-none p-0">{variations.hausses.map(ligne)}</ul>}
        </div>
        <div className="carte-info p-4">
          <div className="mb-1 text-xs text-doux">Plus fortes baisses (liste suivie)</div>
          {enChargement ? squelettes : <ul className="m-0 list-none p-0">{variations.baisses.map(ligne)}</ul>}
        </div>
      </div>

      <CapitalisationMarche />

      {groupes
        .filter((g) => g.actifs.length)
        .map((g) => (
          <section key={g.nom}>
            <h2 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-doux">{g.nom}</h2>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
              {[...g.actifs]
                .sort((a, b) => (cotations[cleActif(b)]?.variationPct ?? -Infinity) - (cotations[cleActif(a)]?.variationPct ?? -Infinity))
                .map((a) => {
                  const c = cotations[cleActif(a)];
                  const n = nouvelles[cleActif(a)] ?? 0;
                  return (
                    <button
                      key={cleActif(a)}
                      title={`${a.nom} — ${formaterPrix(c?.prix)}${n ? ` · ${n} nouvelle${n > 1 ? "s" : ""} actualité${n > 1 ? "s" : ""}` : ""}`}
                      onClick={() => surOuvrir(cleActif(a))}
                      className="relative flex h-16 flex-col items-center justify-center rounded-2xl border border-ligne text-texte transition-all duration-150 hover:scale-[1.04] hover:shadow-lg"
                      style={{ background: couleurTuile(c?.variationPct) }}
                      data-chargement={c == null ? "" : undefined}
                    >
                      <span className="max-w-full truncate px-1 text-sm font-semibold">{symboleAffiche({ ...a, symbole: a.symbole.replace(/(USDT|USDC|EUR|-USD)$/, "") })}</span>
                      <span className="font-mono text-xs">{formaterPct(c?.variationPct)}</span>
                      {n > 0 && (
                        <span aria-label={`${n} nouvelle${n > 1 ? "s" : ""} actualité${n > 1 ? "s" : ""}`} className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-alerte px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-fond">
                          {n > 9 ? "9+" : n}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      {tous.length === 0 && <p className="text-doux">Ajoutez des actifs pour voir la carte du marché.</p>}
    </div>
  );
}
