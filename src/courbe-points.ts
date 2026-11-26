/** Points d'une mini-courbe (« sparkline ») dans un cadre largeur × hauteur, avec une marge pour que le trait ne soit pas rogné. */
export function pointsCourbe(valeurs: number[], largeur: number, hauteur: number, marge = 2): string {
  const v = valeurs.filter((x) => Number.isFinite(x));
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const etendue = max - min || 1; // courbe plate : milieu du cadre
  return v
    .map((x, i) => {
      const px = marge + (i / (v.length - 1)) * (largeur - 2 * marge);
      const py = max === min ? hauteur / 2 : marge + (1 - (x - min) / etendue) * (hauteur - 2 * marge);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
}

/** La courbe termine-t-elle au-dessus de son départ ? (true par défaut quand il n'y a pas assez de points). */
export function courbeMonte(valeurs: number[]): boolean {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length < 2 || v[v.length - 1] >= v[0];
}
