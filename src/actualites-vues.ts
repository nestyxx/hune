import { useEffect, useMemo, useState } from "react";
import { actualitesActif, nombreNouvelles, type Actualite } from "./donnees/actualites";
import { cleActif, type Actif } from "./donnees/types";

const CLE_VU = "hune.actualites.vu";

/** Instant (ms) de la dernière ouverture des actualités de chaque actif ; simple confort d'affichage, perdu sans conséquence. */
export function lireVus(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLE_VU) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function ecrireVu(cle: string, ms: number): void {
  try {
    localStorage.setItem(CLE_VU, JSON.stringify({ ...lireVus(), [cle]: ms }));
  } catch {
    // stockage indisponible : la bulle réapparaîtra, rien de grave
  }
}

/**
 * Nombre d'actualités nouvelles de chaque actif de la liste (clé de l'actif → nombre, absent si zéro ou inconnu).
 * Les actifs sont interrogés deux par deux, une fois toutes les 10 minutes ; une source en échec n'affiche simplement rien.
 */
export function useNouvellesActualites(actifs: Actif[], actif: boolean): Record<string, number> {
  const [actus, setActus] = useState<Record<string, Actualite[]>>({});
  const cles = actifs.map(cleActif).join(",");
  useEffect(() => {
    if (!actif) return;
    let annule = false;
    const charger = async () => {
      const file = [...actifs];
      const travailleur = async () => {
        for (let a = file.shift(); a !== undefined && !annule; a = file.shift()) {
          const cle = cleActif(a);
          try {
            const liste = await actualitesActif(a);
            if (!annule) setActus((p) => ({ ...p, [cle]: liste }));
          } catch {
            // source indisponible pour cet actif
          }
        }
      };
      await Promise.all([travailleur(), travailleur()]);
    };
    void charger();
    const t = setInterval(() => void charger(), 10 * 60_000);
    return () => {
      annule = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cles, actif]);
  return useMemo(() => {
    const vus = lireVus();
    const maintenant = Date.now();
    const sortie: Record<string, number> = {};
    for (const [cle, liste] of Object.entries(actus)) {
      const n = nombreNouvelles(liste, vus[cle] ?? 0, maintenant);
      if (n > 0) sortie[cle] = n;
    }
    return sortie;
  }, [actus]);
}
