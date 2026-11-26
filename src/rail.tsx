import { Bell, ChartCandlestick, Download, LayoutGrid, Minimize2, Moon, PanelLeft, PanelLeftClose, PanelLeftOpen, Settings, Sun, SunMoon, Wallet, type LucideIcon } from "lucide-react";
import type { PreferenceTheme } from "./theme";

export type Onglet = "graphique" | "portefeuille" | "marche" | "alertes" | "reglages";

const ELEMENTS: { id: Onglet; libelle: string; icone: LucideIcon; touche: string }[] = [
  { id: "graphique", libelle: "Graphique", icone: ChartCandlestick, touche: "G" },
  { id: "portefeuille", libelle: "Portefeuille", icone: Wallet, touche: "F" },
  { id: "marche", libelle: "Marché", icone: LayoutGrid, touche: "M" },
  { id: "alertes", libelle: "Alertes", icone: Bell, touche: "A" },
  { id: "reglages", libelle: "Réglages", icone: Settings, touche: "P" },
];

const ICONE_THEME: Record<PreferenceTheme, LucideIcon> = { auto: SunMoon, clair: Sun, sombre: Moon };
const LIBELLE_THEME: Record<PreferenceTheme, string> = { auto: "Thème : auto", clair: "Thème : clair", sombre: "Thème : sombre" };

interface Props {
  onglet: Onglet;
  surOnglet: (o: Onglet) => void;
  reduit: boolean;
  surReduire: () => void;
  listeVisible: boolean;
  /** La liste d'actifs n'existe que sur l'onglet Graphique : le bouton n'a de sens que là. */
  listeApplicable: boolean;
  surBasculerListe: () => void;
  /** Alertes déclenchées depuis la dernière visite de l'onglet Alertes. */
  nouvellesDeclenchees: number;
  majDisponible: string | null;
  theme: PreferenceTheme;
  surBasculerTheme: () => void;
  surCompact: () => void;
}

/** Navigation latérale : icônes seules en mode réduit, avec info-bulles. */
export function Rail({ onglet, surOnglet, reduit, surReduire, listeVisible, listeApplicable, surBasculerListe, nouvellesDeclenchees, majDisponible, theme, surBasculerTheme, surCompact }: Props) {
  const IconeTheme = ICONE_THEME[theme];
  const action = (icone: LucideIcon, libelle: string, onClick: () => void, titre = libelle) => {
    const Icone = icone;
    return (
      <button className="nav-item" onClick={onClick} title={titre} aria-label={libelle}>
        <Icone size={18} />
        {!reduit && <span>{libelle}</span>}
      </button>
    );
  };

  const onglets = ({ id, libelle, icone: Icone, touche }: (typeof ELEMENTS)[number]) => (
    <button key={id} className="nav-item" aria-current={onglet === id ? "page" : undefined} onClick={() => surOnglet(id)} title={`${libelle} (${touche})`}>
      <Icone size={18} />
      {!reduit && <span className="flex-1">{libelle}</span>}
      {id === "alertes" && nouvellesDeclenchees > 0 && (
        <span
          className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-alerte px-1 text-[11px] font-semibold leading-none text-white ${reduit ? "absolute right-1 top-1" : ""}`}
          title={`${nouvellesDeclenchees} alerte${nouvellesDeclenchees > 1 ? "s" : ""} déclenchée${nouvellesDeclenchees > 1 ? "s" : ""} depuis votre dernière visite`}
        >
          {nouvellesDeclenchees}
        </span>
      )}
    </button>
  );

  return (
    <nav className={`flex shrink-0 flex-col justify-between px-2 pb-2 pt-1 transition-[width] duration-200 ${reduit ? "w-[60px]" : "w-[200px]"}`} aria-label="Navigation principale">
      <div className="space-y-0.5">{ELEMENTS.filter((e) => e.id !== "reglages").map(onglets)}</div>

      <div className="space-y-0.5">
        {majDisponible && (
          <button className="nav-item !bg-alerte/15 !text-alerte" onClick={() => surOnglet("reglages")} title={`Hune ${majDisponible} est disponible`}>
            <Download size={18} />
            {!reduit && <span>Version {majDisponible}</span>}
          </button>
        )}
        {listeApplicable && action(PanelLeft, listeVisible ? "Masquer la liste" : "Afficher la liste", surBasculerListe, listeVisible ? "Masquer la liste des actifs" : "Afficher la liste des actifs")}
        {action(Minimize2, "Mode compact", surCompact, "Mode compact : petite fenêtre avec la liste seule")}
        {action(IconeTheme, LIBELLE_THEME[theme], surBasculerTheme, "Changer de thème (auto, clair, sombre)")}
        {ELEMENTS.filter((e) => e.id === "reglages").map(onglets)}
        {action(reduit ? PanelLeftOpen : PanelLeftClose, reduit ? "Agrandir le menu" : "Réduire le menu", surReduire)}
      </div>
    </nav>
  );
}
