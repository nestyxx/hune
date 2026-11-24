import { useCallback, useEffect, useRef, useState } from "react";
import { fournisseur } from "../donnees";
import { cleActif, type Bougie, type Intervalle } from "../donnees/types";
import { evaluer, type Alerte } from "./moteur";

/**
 * Boucle de vérification des alertes, toutes les `periodeS` secondes.
 *
 * Elle tourne dans la page web, qui reste vivante quand la fenêtre est fermée (la coque Tauri se contente
 * de la masquer et garde l'icône dans la zone de notification). Une seule vérification à la fois.
 * Les données passent par les sources (donc par leur cache et leur backoff) : plusieurs alertes sur le
 * même actif ne coûtent qu'une requête.
 */
export function useVerificationAlertes(
  alertes: Alerte[] | null,
  surDeclenchement: (alerte: Alerte, valeur: number) => void,
  periodeS: number,
) {
  const [derniereVerification, setDerniere] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const alertesRef = useRef(alertes);
  alertesRef.current = alertes;
  const rappelRef = useRef(surDeclenchement);
  rappelRef.current = surDeclenchement;
  const enCours = useRef(false);

  const verifier = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    const erreurs: string[] = [];
    try {
      const armees = (alertesRef.current ?? []).filter((a) => a.statut === "armee");
      // Regroupement par actif : une série de requêtes par actif, quel que soit le nombre d'alertes.
      const parActif = new Map<string, Alerte[]>();
      for (const a of armees) parActif.set(cleActif(a.actif), [...(parActif.get(cleActif(a.actif)) ?? []), a]);

      for (const [cle, liste] of parActif) {
        const { source, symbole } = liste[0].actif;
        const f = fournisseur(source);
        try {
          const prix = (await f.cotations([symbole]))[0]?.prix;
          if (prix == null) throw new Error("prix indisponible");
          const maintenant = Math.floor(Date.now() / 1000);
          const bougies15m = liste.some((a) => a.condition.type === "variation") ? await f.bougies(symbole, "15m") : undefined;
          // RSI, croisements et franchissements travaillent sur les bougies de l'intervalle propre à l'alerte.
          const intervallesUtiles = new Set<Intervalle>(liste.flatMap((a) => ("intervalle" in a.condition ? [a.condition.intervalle] : [])));
          const bougiesIntervalle = new Map<Intervalle, Bougie[]>();
          for (const i of intervallesUtiles) bougiesIntervalle.set(i, await f.bougies(symbole, i));

          for (const a of liste) {
            const { declenche, valeur } = evaluer(a.condition, {
              prix,
              bougies15m,
              bougiesIntervalle: "intervalle" in a.condition ? bougiesIntervalle.get(a.condition.intervalle) : undefined,
              maintenant,
              creeeLe: a.creeeLe,
            });
            if (declenche && valeur != null) rappelRef.current(a, valeur);
          }
        } catch (e) {
          erreurs.push(`${cle} : ${e instanceof Error ? e.message : e}`);
        }
      }
    } finally {
      enCours.current = false;
      setDerniere(Date.now());
      setErreur(erreurs.length ? erreurs.join(" · ") : null);
    }
  }, []);

  // Boucle périodique.
  useEffect(() => {
    const t = setInterval(() => void verifier(), periodeS * 1000);
    return () => clearInterval(t);
  }, [periodeS, verifier]);

  // Dès qu'une alerte est créée ou réarmée, on vérifie sans attendre le prochain tour.
  const signature = (alertes ?? []).filter((a) => a.statut === "armee").map((a) => a.id).join(",");
  useEffect(() => {
    if (!signature) return;
    const t = setTimeout(() => void verifier(), 500);
    return () => clearTimeout(t);
  }, [signature, verifier]);

  return { derniereVerification, erreur, verifier };
}
