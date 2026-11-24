import { useEffect, useRef, useState } from "react";
import { LIBELLE_TRI, type Groupe, type Tri } from "./categories";
import { rechercherTout } from "./donnees";
import { cleActif, type Actif, type Cotation, type ResultatRecherche } from "./donnees/types";
import { classePct, formaterPct, formaterPrix } from "./format";

interface Props {
  groupes: Groupe[];
  categories: string[];
  repliees: string[];
  cotations: Record<string, Cotation>;
  /** Nombre d'alertes armées par actif (clé `source:symbole`). */
  alertesArmees: Record<string, number>;
  selection: string | null;
  tri: Tri;
  surTri: (t: Tri) => void;
  surSelection: (cle: string) => void;
  surAjout: (a: Actif) => void;
  surSuppression: (cle: string) => void;
  surDeplacement: (cle: string, categorie: string) => void;
  surBasculeGroupe: (nom: string) => void;
  surCreationCategorie: (nom: string) => void;
  surRenommageCategorie: (ancien: string, nouveau: string) => void;
  surSuppressionCategorie: (nom: string) => void;
}

/** Colonne de gauche : recherche (symbole, nom ou ISIN) + actifs suivis, regroupés par catégorie. */
export function Watchlist(p: Props) {
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [menu, setMenu] = useState<string | null>(null); // clé de l'actif dont le menu « Déplacer » est ouvert
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
    <aside className="flex w-72 shrink-0 flex-col border-r border-ligne bg-carte">
      <div className="relative border-b border-ligne p-3">
        <input
          id="recherche"
          className="champ w-full"
          placeholder="Symbole, nom ou ISIN…  (Ctrl+K)"
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
                  <span className="font-semibold">{a.symbole}</span>
                  <span className="block max-w-[160px] truncate text-xs text-doux">{a.nom}</span>
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
                  <span className="font-semibold">{r.symbole}</span>
                  <span className="block max-w-[160px] truncate text-xs text-doux">{r.nom}</span>
                </span>
                <span className="shrink-0 text-xs text-doux">{dejaSuivi(r) ? "déjà suivi" : r.detail}</span>
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
          <span>{tous.length} actif{tous.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tous.length === 0 && <p className="p-4 text-doux">La liste est vide. Cherchez un symbole, un nom ou un ISIN ci-dessus.</p>}
        {p.groupes.map((g) => {
          const replie = p.repliees.includes(g.nom);
          return (
            <section key={g.nom}>
              <header className="group sticky top-0 z-10 flex items-center justify-between border-b border-ligne bg-carte px-3 py-1.5 text-xs uppercase tracking-wide text-doux">
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
                    <button className="flex flex-1 items-center gap-1 bg-transparent p-0 text-left uppercase tracking-wide text-doux hover:text-texte" onClick={() => p.surBasculeGroupe(g.nom)}>
                      <span>{replie ? "▸" : "▾"}</span>
                      {g.nom} <span className="normal-case opacity-70">({g.actifs.length})</span>
                    </button>
                    <span className="invisible flex gap-0.5 group-hover:visible">
                      <button className="bouton-icone" title="Renommer la catégorie" aria-label={`Renommer ${g.nom}`} onClick={() => setRenomme(g.nom)}>
                        ✎
                      </button>
                      <button
                        className="bouton-icone"
                        title="Supprimer la catégorie (les actifs sont reclassés)"
                        aria-label={`Supprimer ${g.nom}`}
                        onClick={() => p.surSuppressionCategorie(g.nom)}
                      >
                        ✕
                      </button>
                    </span>
                  </>
                )}
              </header>
              {!replie && (
                <ul className="m-0 list-none p-0">
                  {g.actifs.map((a) => {
                    const cle = cleActif(a);
                    const c = p.cotations[cle];
                    const nbAlertes = p.alertesArmees[cle] ?? 0;
                    return (
                      <li
                        key={cle}
                        data-actif={cle}
                        onClick={() => p.surSelection(cle)}
                        className={`group relative flex cursor-pointer items-center justify-between border-b border-ligne px-3 py-2 hover:bg-fond ${p.selection === cle ? "bg-fond shadow-[inset_3px_0_0_var(--color-accent)]" : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {a.symbole}
                            {nbAlertes > 0 && (
                              <span title={`${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""} armée${nbAlertes > 1 ? "s" : ""}`} className="rounded-full bg-alerte/20 px-1.5 text-[10px] font-normal text-alerte">
                                🔔 {nbAlertes}
                              </span>
                            )}
                          </div>
                          <div className="max-w-[130px] truncate text-xs text-doux">{a.nom}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="text-right font-mono">
                            <div>{formaterPrix(c?.prix)}</div>
                            <div className={`text-xs ${classePct(c?.variationPct)}`}>{formaterPct(c?.variationPct)}</div>
                          </div>
                          <button
                            className="bouton-icone invisible group-hover:visible"
                            title="Déplacer / retirer"
                            aria-label={`Options de ${a.symbole}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenu(menu === cle ? null : cle);
                            }}
                          >
                            ⋯
                          </button>
                        </div>
                        {menu === cle && (
                          <div className="menu-contextuel absolute right-2 top-full z-20 min-w-44 py-1 text-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="px-3 py-1 text-xs text-doux">Déplacer vers</div>
                            {p.categories.map((nom) => (
                              <button
                                key={nom}
                                disabled={nom === g.nom}
                                className="block w-full bg-transparent px-3 py-1.5 text-left text-texte hover:bg-fond disabled:text-doux"
                                onClick={() => {
                                  p.surDeplacement(cle, nom);
                                  setMenu(null);
                                }}
                              >
                                {nom === g.nom ? `✓ ${nom}` : nom}
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
                  {g.actifs.length === 0 && <li className="px-3 py-2 text-xs text-doux">Vide : déplacez-y un actif avec ⋯</li>}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="border-t border-ligne p-2">
        {nouvelle === null ? (
          <button className="bouton w-full text-doux" onClick={() => setNouvelle("")}>
            ＋ Nouvelle catégorie
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
