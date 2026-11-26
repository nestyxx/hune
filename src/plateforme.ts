/** Système de l'ordinateur, pour adapter les textes et la barre de titre (Windows par défaut, macOS reconnu). */
export const estMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);

/** Où l'icône de Hune reste quand la fenêtre est fermée. */
export const ZONE_ICONE = estMac ? "barre de menus" : "zone de notification";

/** Touche de raccourci principale (⌘ sur Mac, Ctrl ailleurs). */
export const TOUCHE_RACCOURCI = estMac ? "⌘" : "Ctrl";

/** Nom du système, pour « démarrer avec … ». */
export const NOM_SYSTEME = estMac ? "macOS" : "Windows";
