import { libelleSecondaire, nomAffiche, useNomsCryptos } from "./noms-cryptos";
import { symboleAffiche } from "./noms-affiches";
import { TOUCHE_RACCOURCI } from "./plateforme";
import { Activity, Bell, Check, ChevronDown, ChevronRight, Ellipsis, Pencil, Plus, Rows3, Search, StretchHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LIBELLE_TRI, type Groupe, type Tri } from "./categories";
import { rechercherTout } from "./donnees";
import { cleActif, type Actif, type Cotation, type ResultatRecherche } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";
import { IconeActif } from "./icone-actif";
import { MiniCourbe } from "./mini-courbe";

interface Props {
  groupes: Groupe[];
  categories: string[];
  repliees: string[];
  cotations: Record<string, Cotation>;
  /** Nombre d'alertes armées par actif (clé `source:symbole`). */
  /** Alertes déclenchées par actif (clé `source:symbole`). */
  alertesDeclenchees: Record<string, number>;
  selection: string | null;
  tri: Tri;
  surTri: (t: Tri) => void;
  surSelection: (cle: string) => void;
  surAjout: (a: Actif) => void;
  surSuppression: (cle: string) => void;
  surDeplacement: (cle: string, categorie: string) => void;
  /** Glisser-déposer : place l'actif devant `avantCle` (ou en fin de catégorie `groupe` si null). */
  surReordonner: (cle: string, avantCle: string | null, groupe: string) => void;
  surBasculeGroupe: (nom: string) => void;
  surCreationCategorie: (nom: string) => void;
  surRenommageCategorie: (ancien: string, nouveau: string) => void;
  /** Glisser-déposer d'une catégorie : la place devant `avant` (ou en dernier si null). */
  surReordonnerCategorie: (nom: string, avant: string | null) => void;
  surSuppressionCategorie: (nom: string) => void;
  /** Mode compact : la liste occupe toute la largeur de la fenêtre. */
  pleineLargeur?: boolean;
  /** Une seule ligne par actif (symbole, prix, variation) : plus d'actifs visibles sans défiler. */
  uneLigne: boolean;
  surUneLigne: () => void;
  /** Mini-courbes de 7 jours (clé `source:symbole` → cours) et leur affichage. */
  courbes: Record<string, number[]>;
  afficherCourbes: boolean;
  surCourbes: () => void;
}

/** Colonne de gauche : recherche (symbole, nom ou ISIN) + actifs suivis, regroupés par catégorie. */
export function Watchlist(p: Props) {
  /** Glisser-déposer d'un actif (au pointeur : le glisser-déposer HTML est capté par la fenêtre dans l'application). */
  const [glisse, setGlisse] = useState<{ cle: string; cible: { cle: string | null; groupe: string; apres: boolean } | null } | null>(null);
  const groupesRef = useRef(p.groupes);
  groupesRef.current = p.groupes;
  const reordonnerRef = useRef(p.surReordonner);
  reordonnerRef.current = p.surReordonner;
  const apresGlisse = useRef(false);

  const demarrerGlisse = (e: React.PointerEvent, cle: string) => {
    if (e.button !== 0 || (e.target as Element).closest("button, input, select")) return;
    const depart = { x: e.clientX, y: e.clientY };
    let actif = false;
    let cible: { cle: string | null; groupe: string; apres: boolean } | null = null;
    const trouver = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const ligne = el?.closest("[data-actif]") as HTMLElement | null;
      if (ligne) {
        const g = groupesRef.current.find((x) => x.actifs.some((a) => cleActif(a) === ligne.dataset.actif));
        if (!g) return null;
        const r = ligne.getBoundingClientRect();
        return { cle: ligne.dataset.actif ?? null, groupe: g.nom, apres: ev.clientY > r.top + r.height / 2 };
      }
      const entete = el?.closest("[data-groupe]") as HTMLElement | null;
      return entete?.dataset.groupe ? { cle: null, groupe: entete.dataset.groupe, apres: true } : null;
    };
    const bouger = (ev: PointerEvent) => {
      if (!actif) {
        if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < 6) return;
        actif = true;
      }
      cible = trouver(ev);
      setGlisse({ cle, cible });
    };
    const fin = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", relacher);
      window.removeEventListener("keydown", echap);
      setGlisse(null);
    };
    const relacher = () => {
      const c = cible;
      const etait = actif;
      fin();
      if (!etait) return;
      apresGlisse.current = true;
      setTimeout(() => (apresGlisse.current = false), 0);
      if (!c) return;
      if (c.cle === null) return reordonnerRef.current(cle, null, c.groupe);
      const g = groupesRef.current.find((x) => x.nom === c.groupe);
      if (!g) return;
      const i = g.actifs.findIndex((a) => cleActif(a) === c.cle);
      const avant = c.apres ? (g.actifs[i + 1] ? cleActif(g.actifs[i + 1]) : null) : c.cle;
      reordonnerRef.current(cle, avant, c.groupe);
    };
    const echap = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        cible = null;
        actif = false;
        fin();
      }
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", relacher);
    window.addEventListener("keydown", echap);
  };

  /** Glisser-déposer d'une catégorie (par son en-tête). */
  const [glisseCat, setGlisseCat] = useState<{ nom: string; cible: { nom: string; apres: boolean } | null } | null>(null);
  const reordonnerCatRef = useRef(p.surReordonnerCategorie);
  reordonnerCatRef.current = p.surReordonnerCategorie;
  const demarrerGlisseCategorie = (e: React.PointerEvent, nom: string) => {
    if (e.button !== 0 || (e.target as Element).closest("input, select, [data-sans-glisse]")) return;
    const depart = { x: e.clientX, y: e.clientY };
    let actif = false;
    let cible: { nom: string; apres: boolean } | null = null;
    const trouver = (ev: PointerEvent) => {
      const section = (document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-section]") ?? null) as HTMLElement | null;
      if (!section?.dataset.section) return null;
      const r = section.getBoundingClientRect();
      return { nom: section.dataset.section, apres: ev.clientY > r.top + Math.min(r.height / 2, 40) };
    };
    const bouger = (ev: PointerEvent) => {
      if (!actif) {
        if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < 6) return;
        actif = true;
      }
      cible = trouver(ev);
      setGlisseCat({ nom, cible });
    };
    const fin = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", relacher);
      window.removeEventListener("keydown", echap);
      setGlisseCat(null);
    };
    const relacher = () => {
      const c = cible;
      const etait = actif;
      fin();
      if (!etait) return;
      apresGlisse.current = true;
      setTimeout(() => (apresGlisse.current = false), 0);
      if (!c || c.nom === nom) return;
      const noms = groupesRef.current.map((g) => g.nom);
      const i = noms.indexOf(c.nom);
      reordonnerCatRef.current(nom, c.apres ? (noms[i + 1] ?? null) : c.nom);
    };
    const echap = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        cible = null;
        actif = false;
        fin();
      }
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", relacher);
    window.addEventListener("keydown", echap);
  };

  useNomsCryptos(p.groupes.flatMap((g) => g.actifs));
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [menu, setMenu] = useState<string | null>(null); // clé de l'actif dont le menu « Déplacer » est ouvert
  const [menuHaut, setMenuHaut] = useState(false); // le menu s'ouvre vers le haut quand la ligne est près du bas de la fenêtre
  const [renomme, setRenomme] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState<string | null>(null); // saisie d'une nouvelle catégorie (null = fermé)
  const numero = useRef(0);
  const tous = p.groupes.flatMap((g) => g.actifs);

  // Recherche avec un petit délai pour ne pas interroger les API à chaque frappe.
  useEffect(() => {
    if (!saisie.trim()) {
      setResultats([]);
      setMessage(null);
      return;
    }
    const n = ++numero.current;
    const t = setTimeout(async () => {
      const { resultats, erreurs, note } = await rechercherTout(saisie);
      if (n !== numero.current) return; // une saisie plus récente a pris le relais
      setResultats(resultats);
      const infos = [resultats.length || erreurs.length || note ? null : "Aucun résultat", note, ...erreurs].filter(Boolean);
      setMessage(infos.length ? infos.join(" · ") : null);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  // Ferme le menu « Déplacer » au clic ailleurs.
  useEffect(() => {
    if (!menu) return;
    const fermer = () => setMenu(null);
    window.addEventListener("click", fermer);
    return () => window.removeEventListener("click", fermer);
  }, [menu]);

  const dejaSuivi = (r: ResultatRecherche) => tous.some((a) => cleActif(a) === cleActif(r));
  // Actifs déjà suivis qui correspondent à la saisie : proposés en premier (utile avec une longue liste).
  const requete = saisie.trim().toLowerCase();
  const locaux = requete ? tous.filter((a) => a.symbole.toLowerCase().includes(requete) || a.nom.toLowerCase().includes(requete)).slice(0, 6) : [];

  return (
    <aside className={`flex shrink-0 flex-col bg-carte ${p.pleineLargeur ? "min-h-0 flex-1" : `${p.afficherCourbes ? "w-[22rem]" : "w-80"} border-r border-ligne`}`}>
      <div className="relative border-b border-ligne p-3">
        <Search size={15} className="pointer-events-none absolute left-[25px] top-[25px] text-doux" aria-hidden />
        <input
          id="recherche"
          className="champ w-full !pl-9"
          placeholder={`Symbole, nom ou ISIN…  (${TOUCHE_RACCOURCI}+K)`}
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOuvert(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter") {
              // Entrée : d'abord un actif déjà suivi qui correspond, sinon on ajoute le premier résultat de recherche.
              if (locaux.length) {
                p.surSelection(cleActif(locaux[0]));
                setSaisie("");
                setOuvert(false);
                return;
              }
              const premier = resultats.find((r) => !dejaSuivi(r));
              if (premier) {
                p.surAjout({ source: premier.source, symbole: premier.symbole, nom: premier.nom });
                setSaisie("");
                setOuvert(false);
              }
            }
          }}
        />
        {ouvert && saisie.trim() && (
          <div className="menu-contextuel absolute left-3 right-3 top-[52px] z-30 max-h-80 overflow-auto">
            {locaux.length > 0 && <div className="px-3 pt-2 text-xs uppercase tracking-wide text-doux">Dans ma liste</div>}
            {locaux.map((a) => (
              <button
                key={`local-${cleActif(a)}`}
                className="flex w-full items-center justify-between gap-2 bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond"
                onClick={() => {
                  p.surSelection(cleActif(a));
                  setSaisie("");
                  setOuvert(false);
                }}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{symboleAffiche(a)}</span>
                  <span className="block max-w-[160px] truncate text-xs text-doux">{libelleSecondaire(a)}</span>
                </span>
                <span className="shrink-0 text-xs text-doux">ouvrir</span>
              </button>
            ))}
            {resultats.length > 0 && locaux.length > 0 && <div className="px-3 pt-2 text-xs uppercase tracking-wide text-doux">Ajouter</div>}
            {resultats.map((r) => (
              <button
                key={cleActif(r)}
                disabled={dejaSuivi(r)}
                className="flex w-full items-center justify-between gap-2 bg-transparent px-3 py-2 text-left text-texte hover:bg-fond disabled:opacity-40"
                onClick={() => {
                  p.surAjout({ source: r.source, symbole: r.symbole, nom: r.nom });
                  setSaisie("");
                  setOuvert(false);
                }}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{symboleAffiche(r)}</span>
                  <span className="block max-w-[160px] truncate text-xs text-doux">{r.symbole !== symboleAffiche(r) ? `${r.symbole} · ${r.nom}` : r.nom}</span>
                </span>
                <span className="max-w-[45%] shrink-0 truncate text-xs text-doux" title={dejaSuivi(r) ? undefined : r.detail}>{dejaSuivi(r) ? "déjà suivi" : r.detail}</span>
              </button>
            ))}
            {message && <div className="px-3 py-2 text-xs text-doux">{message}</div>}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-doux">
          <label className="flex items-center gap-1">
            Tri
            <select className="champ !px-1 !py-0.5 text-xs" value={p.tri} onChange={(e) => p.surTri(e.target.value as Tri)}>
              {(Object.keys(LIBELLE_TRI) as Tri[]).map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_TRI[t]}
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-1.5">
            {tous.length} actif{tous.length > 1 ? "s" : ""}
            <button className="bouton-icone" aria-pressed={p.afficherCourbes} title={p.afficherCourbes ? "Masquer les mini-courbes (7 jours)" : "Afficher une mini-courbe de 7 jours par actif"} aria-label="Mini-courbes de la liste" onClick={p.surCourbes}>
              <Activity size={15} className={p.afficherCourbes ? "text-accent" : undefined} />
            </button>
            <button
              className="bouton-icone"
              aria-pressed={p.uneLigne}
              title={p.uneLigne ? "Afficher le nom sous chaque symbole" : "Une seule ligne par actif (plus de lignes visibles)"}
              aria-label="Affichage de la liste sur une ligne"
              onClick={p.surUneLigne}
            >
              {p.uneLigne ? <Rows3 size={15} /> : <StretchHorizontal size={15} />}
            </button>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tous.length === 0 && <p className="p-4 text-doux">La liste est vide. Cherchez un symbole, un nom ou un ISIN ci-dessus.</p>}
        {p.groupes.map((g) => {
          const replie = p.repliees.includes(g.nom);
          return (
            <section key={g.nom} data-section={g.nom} className={glisseCat?.nom === g.nom ? "opacity-40" : ""}>
              <header
                data-groupe={g.nom}
                onPointerDown={(e) => demarrerGlisseCategorie(e, g.nom)}
                className={`group sticky top-0 z-10 flex select-none items-center justify-between border-b border-ligne bg-carte px-3 py-1.5 text-xs uppercase tracking-wide text-doux ${glisse?.cible?.cle === null && glisse.cible.groupe === g.nom ? "!bg-accent-doux" : ""} ${glisseCat?.cible?.nom === g.nom && glisseCat.nom !== g.nom ? (glisseCat.cible.apres ? "!border-b-2 !border-b-accent" : "shadow-[inset_0_2px_0_var(--color-accent)]") : ""}`}
              >
                {renomme === g.nom ? (
                  <input
                    autoFocus
                    className="champ w-full !py-0.5 text-xs normal-case"
                    defaultValue={g.nom}
                    onBlur={() => setRenomme(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setRenomme(null);
                      if (e.key === "Enter") {
                        p.surRenommageCategorie(g.nom, (e.target as HTMLInputElement).value);
                        setRenomme(null);
                      }
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="flex flex-1 cursor-grab items-center gap-1 bg-transparent p-0 text-left uppercase tracking-wide text-doux hover:text-texte"
                      title="Cliquer pour replier · glisser pour déplacer la catégorie · double-clic pour la renommer"
                      onClick={() => !apresGlisse.current && p.surBasculeGroupe(g.nom)}
                      onDoubleClick={() => setRenomme(g.nom)}
                    >
                      {replie ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      {g.nom} <span className="normal-case opacity-70">({g.actifs.length})</span>
                    </button>
                    <span className="flex gap-0.5 opacity-40 transition-opacity group-hover:opacity-100" data-sans-glisse>
                      <button className="bouton-icone" title="Renommer la catégorie" aria-label={`Renommer ${g.nom}`} onClick={() => setRenomme(g.nom)}>
                        <Pencil size={13} />
                      </button>
                      {p.categories.includes(g.nom) && (
                        <button className="bouton-icone" title="Supprimer la catégorie (les actifs sont reclassés)" aria-label={`Supprimer ${g.nom}`} onClick={() => p.surSuppressionCategorie(g.nom)}>
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  </>
                )}
              </header>
              {!replie && (
                <ul className="m-0 list-none p-0">
                  {g.actifs.map((a) => {
                    const cle = cleActif(a);
                    const c = p.cotations[cle];
                    const nbAlertes = p.alertesDeclenchees[cle] ?? 0;
                    return (
                      <li
                        key={cle}
                        data-actif={cle}
                        onClick={() => !apresGlisse.current && p.surSelection(cle)}
                        onPointerDown={(e) => demarrerGlisse(e, cle)}
                        title={p.uneLigne ? `${nomAffiche(a)} (${libelleSecondaire(a)})` : undefined}
                        className={`group relative flex cursor-pointer select-none items-center justify-between border-b border-ligne px-3 hover:bg-fond/80 ${p.uneLigne ? "py-1" : "py-2"} ${p.selection === cle ? "bg-accent-doux shadow-[inset_3px_0_0_var(--color-accent)]" : ""} ${glisse?.cle === cle ? "opacity-40" : ""} ${glisse?.cible?.cle === cle && glisse.cle !== cle ? (glisse.cible.apres ? "!border-b-2 !border-b-accent" : "shadow-[inset_0_2px_0_var(--color-accent)]") : ""}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden pr-2">
                        <IconeActif actif={a} taille={p.uneLigne ? 18 : 28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold">
                            <span className="truncate">{symboleAffiche(a)}</span>
                            {nbAlertes > 0 && (
                              <span title={`${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""} déclenchée${nbAlertes > 1 ? "s" : ""}`} className="inline-flex items-center gap-0.5 rounded-full bg-alerte px-1.5 text-[10px] font-semibold text-white">
                                <Bell size={10} /> {nbAlertes}
                              </span>
                            )}
                          </div>
                          {!p.uneLigne && <div className="max-w-[130px] truncate text-xs text-doux">{libelleSecondaire(a)}</div>}
                        </div>
                        </div>
                        {p.afficherCourbes && <MiniCourbe valeurs={p.courbes[cle]} />}
                        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                          {p.uneLigne ? (
                            // Une ligne : prix et variation côte à côte, variation sur une largeur fixe pour aligner la colonne.
                            <div className="flex items-baseline gap-2 whitespace-nowrap text-right font-mono">
                              <span className="text-sm">{formaterPrix(c?.prix)}</span>
                              <span className={`w-[58px] text-xs ${classePct(c?.variationPct)}`}>{formaterPct(c?.variationPct)}</span>
                            </div>
                          ) : (
                            <div className="text-right font-mono">
                              <div>{formaterPrix(c?.prix)}</div>
                              <div className={`text-xs ${classePct(c?.variationPct)}`}>{formaterPct(c?.variationPct)}</div>
                            </div>
                          )}
                          <button
                            // Colonne réservée à droite : le bouton n'apparaît qu'au survol mais ne recouvre plus jamais le pourcentage.
                            className="bouton-icone invisible -mr-1 shrink-0 group-hover:visible"
                            title="Déplacer / retirer"
                            aria-label={`Options de ${symboleAffiche(a)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuHaut(e.clientY > window.innerHeight - 300);
                              setMenu(menu === cle ? null : cle);
                            }}
                          >
                            <Ellipsis size={15} />
                          </button>
                        </div>
                        {menu === cle && (
                          <div className={`menu-contextuel absolute right-2 z-20 min-w-44 py-1 text-sm ${menuHaut ? "bottom-full" : "top-full"}`} onClick={(e) => e.stopPropagation()}>
                            <div className="px-3 py-1 text-xs text-doux">Déplacer vers</div>
                            {p.categories.map((nom) => (
                              <button
                                key={nom}
                                disabled={nom === g.nom}
                                className="flex w-full items-center gap-2 bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond disabled:text-doux"
                                onClick={() => {
                                  p.surDeplacement(cle, nom);
                                  setMenu(null);
                                }}
                              >
                                {nom === g.nom ? <><Check size={14} /> {nom}</> : nom}
                              </button>
                            ))}
                            <hr className="my-1 border-ligne" />
                            <button
                              className="block w-full bg-transparent px-3 py-1.5 text-left text-baisse hover:bg-fond"
                              onClick={() => {
                                p.surSuppression(cle);
                                setMenu(null);
                              }}
                            >
                              Retirer de la liste
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {g.actifs.length === 0 && <li className="px-3 py-2 text-xs text-doux">Vide : glissez-y un actif, ou utilisez ⋯</li>}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="border-t border-ligne p-2">
        {nouvelle === null ? (
          <button className="bouton w-full text-doux" onClick={() => setNouvelle("")}>
            <Plus size={14} /> Nouvelle catégorie
          </button>
        ) : (
          <input
            autoFocus
            className="champ w-full"
            placeholder="Nom de la catégorie (Entrée)"
            value={nouvelle}
            onChange={(e) => setNouvelle(e.target.value)}
            onBlur={() => setNouvelle(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setNouvelle(null);
              if (e.key === "Enter" && nouvelle.trim()) {
                p.surCreationCategorie(nouvelle.trim());
                setNouvelle(null);
              }
            }}
          />
        )}
      </div>
    </aside>
  );
}
