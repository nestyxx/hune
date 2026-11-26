import { fournisseur } from "./donnees";
import type { Actif, Cotation } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";
import { IconeActif } from "./icone-actif";

/** Bandeau au-dessus du graphique : actif, prix, variation et — surtout — nature des données (temps réel ou différées). */
export function EnteteActif({ actif, cotation, prixLive }: { actif: Actif; cotation?: Cotation; prixLive: number | null }) {
  const f = fournisseur(actif.source);
  const prix = prixLive ?? cotation?.prix;
  return (
    <header className="flex items-end justify-between gap-4 px-6 pb-3 pt-5">
      <div className="min-w-0">
        <h1 className="m-0 flex items-center gap-2 truncate text-[13px] font-medium text-doux">
          <IconeActif actif={actif} taille={22} />
          <span className="truncate">
            <span className="text-texte">{actif.symbole}</span> · {actif.nom}
          </span>
        </h1>
        <div className="mt-0.5 flex items-baseline gap-3">
          <span className="titre-serif text-[44px] leading-none">{formaterPrix(prix)}</span>
          <span className={`text-lg font-medium ${classePct(cotation?.variationPct)}`}>{formaterPct(cotation?.variationPct)}</span>
        </div>
      </div>
      <span
        title={f.noteDonnees}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${f.differe ? "border-alerte/50 bg-alerte/10 text-alerte" : "border-hausse/50 bg-hausse/10 text-hausse"}`}
      >
        {f.differe ? "● Données différées" : "● Temps réel"} · {f.nom}
      </span>
    </header>
  );
}
