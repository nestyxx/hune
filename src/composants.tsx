import type { ReactNode } from "react";

/** En-tête d'un onglet : titre en serif, sous-titre discret et zone d'actions à droite. */
export function EnTete({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="titre-serif m-0 text-[34px] leading-none">{titre}</h1>
        {sousTitre && <p className="m-0 mt-1.5 text-[13px] text-doux">{sousTitre}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Roue de chargement avec un libellé : à poser dans une carte pendant qu'une donnée arrive. */
export function Chargeur({ texte, className = "" }: { texte: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-xs text-doux ${className}`} role="status">
      <div className="chargeur shrink-0" />
      {texte}
    </div>
  );
}
