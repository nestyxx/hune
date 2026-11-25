import { Copy, Minus, Pin, PinOff, Square, X } from "lucide-react";
import type { useFenetre } from "./fenetre";
import { Logo } from "./logo";

/**
 * Barre de titre personnalisée (la fenêtre n'a pas de cadre Windows) : logo, nom en serif, zone de glisser-déposer
 * et boutons de fenêtre. Hors de l'application (navigateur de test), seuls le logo et le nom s'affichent.
 */
export function BarreTitre({ fenetre, compact }: { fenetre: ReturnType<typeof useFenetre>; compact?: boolean }) {
  return (
    <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-center justify-between pl-5">
      {/* pointer-events-none : le clic traverse jusqu'à la zone de glisser-déposer.
          pl-5 et gap-[11px] : le logo tombe à l'aplomb des icônes de navigation (8 px de marge + 12 px de remplissage)
          et le nom à l'aplomb de leurs libellés (icône 18 px + 11 px). */}
      <div className="pointer-events-none flex items-center gap-[11px]">
        <Logo taille={18} />
        <span className="titre-serif text-[20px] leading-none">Hune</span>
      </div>
      {fenetre.disponible && (
        <div className="flex h-full items-stretch">
          <button className="bouton-fenetre" aria-pressed={fenetre.toujoursDevant} title={fenetre.toujoursDevant ? "Ne plus garder au premier plan" : "Garder au premier plan"} onClick={() => void fenetre.basculerToujoursDevant()}>
            {fenetre.toujoursDevant ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
          <button className="bouton-fenetre" aria-label="Réduire" title="Réduire" onClick={fenetre.minimiser}>
            <Minus size={16} />
          </button>
          {!compact && (
            <button className="bouton-fenetre" aria-label={fenetre.maximisee ? "Restaurer" : "Agrandir"} title={fenetre.maximisee ? "Restaurer" : "Agrandir"} onClick={fenetre.basculerMaximisation}>
              {fenetre.maximisee ? <Copy size={13} /> : <Square size={13} />}
            </button>
          )}
          <button className="bouton-fenetre bouton-fenetre-fermer" aria-label="Fermer (reste dans la zone de notification)" title="Fermer (Hune reste dans la zone de notification)" onClick={fenetre.fermer}>
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
