import { courbeMonte, pointsCourbe } from "./courbe-points";

/** Mini-courbe de tendance (7 jours) : verte si l'actif termine au-dessus de son départ, rouge sinon. */
export function MiniCourbe({ valeurs, largeur = 54, hauteur = 20 }: { valeurs: number[] | undefined; largeur?: number; hauteur?: number }) {
  const points = valeurs ? pointsCourbe(valeurs, largeur, hauteur) : "";
  if (!points) return <span aria-hidden style={{ width: largeur, height: hauteur }} className="inline-block shrink-0" />;
  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden className={`shrink-0 ${courbeMonte(valeurs!) ? "text-hausse" : "text-baisse"}`}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
