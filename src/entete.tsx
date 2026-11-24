import { fournisseur } from "./donnees";
import type { Actif, Cotation } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";

/** Bandeau au-dessus du graphique : actif, prix, variation et — surtout — nature des données (temps réel ou différées). */
export function EnteteActif({ actif, cotation, prixLive }: { actif: Actif; cotation?: Cotation; prixLive: number | null }) {
  const f = fournisseur(actif.source);
  const prix = prixLive ?? cotation?.prix;
  return (
    <header className="flex items-center justify-between gap-4 border-b border-ligne px-4 py-3">
      <div className="min-w-0">
        <h1 className="m-0 truncate text-lg font-semibold">
          {actif.symbole} <span className="text-sm font-normal text-doux">{actif.nom}</span>
        </h1>
        <div className="mt-0.5 font-mono text-2xl">
          {formaterPrix(prix)} <span className={`text-base ${classePct(cotation?.variationPct)}`}>{formaterPct(cotation?.variationPct)}</span>
        </div>
      </div>
      <span
        title={f.noteDonnees}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs ${f.differe ? "border-alerte/60 text-alerte" : "border-hausse/60 text-hausse"}`}
      >
        {f.differe ? "● Données différées" : "● Temps réel"} · {f.nom}
      </span>
    </header>
  );
}
