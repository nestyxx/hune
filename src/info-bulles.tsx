import { useEffect, useRef, useState } from "react";

interface Bulle {
  texte: string;
  x: number;
  y: number;
  /** Placée sous l'élément quand il n'y a pas la place au-dessus. */
  dessous: boolean;
}

const DELAI_MS = 400;

/**
 * Infobulles aux couleurs de l'application, à la place de celles de Windows.
 * Toute balise portant un attribut `title` en profite : au survol, le texte passe dans `data-info` (ce qui supprime l'infobulle
 * native) et s'affiche dans une carte stylée ; sans texte visible, il devient le `aria-label` de l'élément pour les lecteurs d'écran.
 */
export function InfoBulles() {
  const [bulle, setBulle] = useState<Bulle | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const courant = useRef<Element | null>(null);

  useEffect(() => {
    const annuler = () => {
      if (minuterie.current) clearTimeout(minuterie.current);
      minuterie.current = null;
      courant.current = null;
      setBulle(null);
    };
    const cible = (e: Event): HTMLElement | null => {
      const t = e.target;
      return t instanceof Element ? (t.closest("[title],[data-info]") as HTMLElement | null) : null;
    };
    const entrer = (e: MouseEvent) => {
      const el = cible(e);
      if (!el) return annuler();
      if (el === courant.current) return;
      annuler();
      const titre = el.getAttribute("title");
      if (titre) {
        el.setAttribute("data-info", titre);
        el.removeAttribute("title");
        if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", titre);
      }
      const texte = el.getAttribute("data-info");
      if (!texte) return;
      courant.current = el;
      minuterie.current = setTimeout(() => {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        const dessous = r.top < 56;
        setBulle({ texte, x: r.left + r.width / 2, y: dessous ? r.bottom + 8 : r.top - 8, dessous });
      }, DELAI_MS);
    };
    document.addEventListener("mouseover", entrer);
    document.addEventListener("mousedown", annuler, true);
    document.addEventListener("keydown", annuler, true);
    window.addEventListener("scroll", annuler, true);
    window.addEventListener("blur", annuler);
    return () => {
      document.removeEventListener("mouseover", entrer);
      document.removeEventListener("mousedown", annuler, true);
      document.removeEventListener("keydown", annuler, true);
      window.removeEventListener("scroll", annuler, true);
      window.removeEventListener("blur", annuler);
      if (minuterie.current) clearTimeout(minuterie.current);
    };
  }, []);

  if (!bulle) return null;
  // Largeur maximale 288 px : on garde la carte dans la fenêtre en décalant son point d'ancrage si besoin.
  const marge = 152;
  const x = Math.min(Math.max(bulle.x, marge), window.innerWidth - marge);
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[1000] max-w-72 rounded-lg border border-ligne bg-carte px-2.5 py-1.5 text-xs leading-snug text-texte shadow-lg"
      style={{ left: x, top: bulle.y, transform: bulle.dessous ? "translateX(-50%)" : "translate(-50%, -100%)", boxShadow: "0 8px 24px rgb(16 24 40 / 0.18)" }}
    >
      {bulle.texte}
    </div>
  );
}
