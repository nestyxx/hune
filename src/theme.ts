import { useEffect, useLayoutEffect, useState } from "react";

/** Préférence de l'utilisateur ; « auto » suit le thème de Windows. */
export type PreferenceTheme = "auto" | "clair" | "sombre";
export type ThemeResolu = "clair" | "sombre";

const requete = () => window.matchMedia("(prefers-color-scheme: light)");

/** Pose data-theme sur <html> (les jetons CSS font le reste) et renvoie le thème effectivement appliqué. */
export function useTheme(preference: PreferenceTheme): ThemeResolu {
  const [systeme, setSysteme] = useState<ThemeResolu>(() => (requete().matches ? "clair" : "sombre"));
  useEffect(() => {
    const q = requete();
    const maj = () => setSysteme(q.matches ? "clair" : "sombre");
    q.addEventListener("change", maj);
    return () => q.removeEventListener("change", maj);
  }, []);
  const resolu = preference === "auto" ? systeme : preference;
  // useLayoutEffect : l'attribut doit être posé avant les effets des composants enfants (le graphique relit les couleurs CSS).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolu;
  }, [resolu]);
  return resolu;
}

/** Couleurs du graphique : lues dans les jetons CSS pour rester cohérentes avec l'interface. */
export function paletteGraphique() {
  const css = getComputedStyle(document.documentElement);
  const v = (nom: string) => css.getPropertyValue(nom).trim();
  return {
    fond: v("--color-carte"), // le graphique est posé sur le panneau blanc, pas sur le fond teinté de l'application
    texte: v("--color-doux"),
    ligne: v("--color-ligne"),
    grille: v("--color-ligne") + "66", // grille plus discrète que les bordures
    hausse: v("--color-hausse"),
    baisse: v("--color-baisse"),
    alerte: v("--color-alerte"),
    accent: v("--color-accent"),
  };
}
