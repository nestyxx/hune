import { ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { fournisseur } from "./donnees";
import { actualiteNouvelle, actualitesActif, type Actualite } from "./donnees/actualites";
import { cleActif, type Actif, type Cotation } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";
import { IconeActif } from "./icone-actif";
import { liensExternes } from "./liens";
import { ouvrirLien } from "./ouvrir-lien";

const CLE_VU = "hune.actualites.vu";

/** Instant (ms) de la dernière ouverture des actualités de chaque actif ; simple confort d'affichage, perdu sans conséquence. */
function lireVus(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLE_VU) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function ecrireVu(cle: string, ms: number) {
  try {
    localStorage.setItem(CLE_VU, JSON.stringify({ ...lireVus(), [cle]: ms }));
  } catch {
    // stockage indisponible : la puce réapparaîtra, rien de grave
  }
}

function depuis(dateS: number): string {
  const h = Math.max(0, Math.round((Date.now() / 1000 - dateS) / 3600));
  return h < 1 ? "il y a moins d'une heure" : h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

/** Actualités de l'actif (rafraîchies toutes les 10 min) et date de dernière ouverture. Une source indisponible n'affiche rien. */
function useActualites(actif: Actif) {
  const cle = cleActif(actif);
  const [actus, setActus] = useState<Actualite[]>([]);
  const [vuLe, setVuLe] = useState(0);
  useEffect(() => {
    let actuel = true;
    setActus([]);
    setVuLe(lireVus()[cle] ?? 0);
    const charger = () =>
      actualitesActif(actif)
        .then((a) => actuel && setActus(a))
        .catch(() => undefined);
    void charger();
    const t = setInterval(charger, 10 * 60_000);
    return () => {
      actuel = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  const nouvelle = actualiteNouvelle(actus, vuLe, Date.now());
  const marquerVu = () => {
    const maintenant = Date.now();
    ecrireVu(cle, maintenant);
    setVuLe(maintenant);
  };
  return { nouvelle, marquerVu };
}

/** Bandeau au-dessus du graphique : actif, prix, variation et — surtout — nature des données (temps réel ou différées). */
export function EnteteActif({ actif, cotation, prixLive }: { actif: Actif; cotation?: Cotation; prixLive: number | null }) {
  const f = fournisseur(actif.source);
  const prix = prixLive ?? cotation?.prix;
  const { nouvelle, marquerVu } = useActualites(actif);
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
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span
          title={f.noteDonnees}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${f.differe ? "border-alerte/50 bg-alerte/10 text-alerte" : "border-hausse/50 bg-hausse/10 text-hausse"}`}
        >
          {f.differe ? "● Données différées" : "● Temps réel"} · {f.nom}
        </span>
        <div className="flex gap-1.5">
          {liensExternes(actif).map((l, i) => (
            <button
              key={l.url}
              className="puce relative !py-[2px] text-xs"
              title={i === 0 && nouvelle ? `Nouveau : ${nouvelle.titre} (${nouvelle.editeur}, ${depuis(nouvelle.date)})` : l.aide}
              onClick={() => {
                if (i === 0) marquerVu();
                void ouvrirLien(l.url);
              }}
            >
              {i === 0 ? <Newspaper size={12} /> : <ExternalLink size={12} />} {l.libelle}
              {i === 0 && nouvelle && <span aria-label="Nouvelle actualité" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-alerte ring-2 ring-carte" />}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
