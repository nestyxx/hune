import { useEffect, useMemo, useRef, useState } from "react";
import { ImportTransactions } from "./import-transactions-panneau";
import { categorieDe } from "./categories";
import { EnTete } from "./composants";
import { fournisseur } from "./donnees";
import { tauxVersEur } from "./donnees/change";
import { cleActif, type Actif, type Cotation } from "./donnees/types";
import { classePct, espaceOrdinaire, formaterPct, formaterPrix } from "./format";
import { agreger, repartition, totaux, valeurLotEur, type LignePortefeuille, type PartRepartition, type Position } from "./portefeuille";

interface Props {
  actifs: Actif[];
  categories: string[];
  cotations: Record<string, Cotation>;
  positions: Position[];
  surPositions: (modifier: (l: Position[]) => Position[]) => void;
  /** Ajoute des actifs à la watchlist (ceux qui y sont déjà sont ignorés). */
  surAjouterActifs: (nouveaux: Actif[]) => void;
  surOuvrir: (cle: string) => void;
  /** Crée des alertes de prix aux objectifs fournis ; renvoie le nombre réellement créé (hors doublons). */
  surAlertesObjectifs: (objectifs: { actif: Actif; prix: number }[]) => number;
  /** Alertes de prix « au-dessus » déjà armées, pour ne pas créer de doublons. */
  alertesExistantes: { cle: string; seuil: number }[];
}

type Colonne = "valeurEur" | "pnlPct" | "pnlEur" | "poids" | "versObjectifPct" | "symbole";

const eur = (v: number | null, decimales = 0) => (v == null ? "—" : espaceOrdinaire(v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: decimales, minimumFractionDigits: decimales })));
const quantite = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: q >= 1000 ? 0 : q >= 1 ? 4 : 8 });
const pourcent = (p: number | null) => (p == null ? "—" : `${(p * 100).toFixed(1).replace(".", ",")} %`);

/** Nombre saisi (virgule acceptée) ; chaîne vide = pas de valeur ; null si invalide. */
function lireNombre(s: string): number | undefined | null {
  if (!s.trim()) return undefined;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Barre de répartition empilée avec légende. */
function BarreRepartition({ titre, parts }: { titre: string; parts: PartRepartition[] }) {
  const couleurs = ["#2f81f7", "#26a69a", "#e08a00", "#8e6bff", "#d3569a", "#6ca6c1", "#9aa75b", "#c2674a"];
  if (!parts.length) return null;
  return (
    <div className="carte-info p-4">
      <div className="mb-2 text-xs text-doux">{titre}</div>
      <div className="flex h-3 overflow-hidden rounded-full bg-fond">
        {parts.map((p, i) => (
          <div key={p.nom} title={`${p.nom} : ${eur(p.valeurEur)} (${pourcent(p.part)})`} style={{ width: `${p.part * 100}%`, background: couleurs[i % couleurs.length] }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p, i) => (
          <span key={p.nom} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: couleurs[i % couleurs.length] }} />
            {p.nom} <span className="text-doux">{pourcent(p.part)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Champ numérique d'un lot : validé à la sortie du champ (Entrée ou perte du focus). */
function ChampLot({ valeur, surChangement, placeholder, large = "w-28" }: { valeur: number | undefined; surChangement: (v: number | undefined) => void; placeholder: string; large?: string }) {
  const [invalide, setInvalide] = useState(false);
  return (
    <input
      key={valeur ?? "vide"}
      defaultValue={valeur ?? ""}
      placeholder={placeholder}
      inputMode="decimal"
      className={`champ ${large} !py-1 text-xs ${invalide ? "!border-baisse" : ""}`}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => {
        const n = lireNombre(e.target.value);
        setInvalide(n === null);
        if (n !== null && n !== valeur) surChangement(n);
      }}
    />
  );
}

export function VuePortefeuille({ actifs, categories, cotations, positions, surPositions, surAjouterActifs, surOuvrir, surAlertesObjectifs, alertesExistantes }: Props) {
  const choixCsv = useRef<HTMLInputElement>(null);
  const [fichierCsv, setFichierCsv] = useState<File | null>(null);
  const [devises, setDevises] = useState<Record<string, string>>({});
  const [taux, setTaux] = useState<Record<string, number>>({ EUR: 1 });
  const [tri, setTri] = useState<{ col: Colonne; sens: 1 | -1 }>({ col: "valeurEur", sens: -1 });
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  const [confirmationTp, setConfirmationTp] = useState<{ actif: Actif; prix: number }[] | null>(null);
  const [formulaire, setFormulaire] = useState<{ cle: string; quantite: string; pamp: string; objectif: string; plateforme: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const actifsParCle = useMemo(() => Object.fromEntries(actifs.map((a) => [cleActif(a), a])), [actifs]);
  const clesDetenues = useMemo(() => [...new Set(positions.map((p) => p.cle))].filter((c) => actifsParCle[c]), [positions, actifsParCle]);

  // Devise de chaque actif détenu (une seule fois par actif ; mise en cache côté source).
  useEffect(() => {
    const manquantes = clesDetenues.filter((c) => !devises[c]);
    if (!manquantes.length) return;
    let annule = false;
    void Promise.allSettled(
      manquantes.map(async (c) => [c, await fournisseur(actifsParCle[c].source).devise(actifsParCle[c].symbole)] as const),
    ).then((rs) => {
      if (annule) return;
      const ajout = Object.fromEntries(rs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
      if (Object.keys(ajout).length) setDevises((d) => ({ ...d, ...ajout }));
    });
    return () => {
      annule = true;
    };
  }, [clesDetenues, devises, actifsParCle]);

  // Taux de change vers l'euro, rafraîchis toutes les 5 minutes.
  const listeDevises = useMemo(() => [...new Set(Object.values(devises))].sort().join(","), [devises]);
  useEffect(() => {
    if (!listeDevises) return;
    let annule = false;
    const charger = () => tauxVersEur(listeDevises.split(",")).then((t) => !annule && setTaux(t)).catch(() => {});
    void charger();
    const t = setInterval(charger, 5 * 60_000);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [listeDevises]);

  // Lots importés avec un montant en euros mais sans quantité : on déduit la quantité du premier prix reçu (puis on la fige).
  useEffect(() => {
    const aEstimer = positions.filter((p) => p.quantite == null && p.montantEur != null);
    if (!aEstimer.length) return;
    const calculs = new Map<string, number>();
    for (const p of aEstimer) {
      const prix = cotations[p.cle]?.prix;
      const t = devises[p.cle] ? taux[devises[p.cle]] : undefined;
      if (prix && t) calculs.set(p.id, p.montantEur! / (prix * t));
    }
    if (calculs.size) surPositions((l) => l.map((p) => (calculs.has(p.id) ? { ...p, quantite: calculs.get(p.id), estimee: true } : p)));
  }, [positions, cotations, devises, taux, surPositions]);

  const entrees = useMemo(() => ({ actifs: actifsParCle, cotations, devises, taux }), [actifsParCle, cotations, devises, taux]);
  const lignes = useMemo(() => agreger(positions, entrees), [positions, entrees]);
  const tot = useMemo(() => totaux(lignes), [lignes]);

  const parCategorie = useMemo(() => repartition(lignes.map((l) => ({ nom: categorieDe(l.actif, categories), valeurEur: l.valeurEur }))), [lignes, categories]);
  const parPlateforme = useMemo(
    () => repartition(positions.filter((p) => actifsParCle[p.cle]).map((p) => ({ nom: p.plateforme ?? "Non précisée", valeurEur: valeurLotEur(p, entrees) }))),
    [positions, actifsParCle, entrees],
  );

  const affichees = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const liste = lignes.filter((l) => !f || l.actif.symbole.toLowerCase().includes(f) || l.actif.nom.toLowerCase().includes(f));
    const valeur = (l: LignePortefeuille) => (tri.col === "symbole" ? l.actif.symbole : (l[tri.col] ?? -Infinity));
    return liste.sort((a, b) => {
      const x = valeur(a);
      const y = valeur(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "fr") : (x as number) - (y as number)) * tri.sens;
    });
  }, [lignes, filtre, tri]);

  const entete = (col: Colonne, libelle: string, droite = true) => (
    <th className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-normal text-doux hover:text-texte ${droite ? "text-right" : "text-left"}`} onClick={() => setTri((t) => ({ col, sens: t.col === col ? (-t.sens as 1 | -1) : -1 }))}>
      {libelle} {tri.col === col ? (tri.sens === -1 ? "▾" : "▴") : ""}
    </th>
  );

  const preparerAlertesTp = () => {
    const deja = new Set(alertesExistantes.map((a) => `${a.cle}:${a.seuil}`));
    // Seuls les objectifs encore au-dessus du prix : une alerte déjà « atteinte » se déclencherait aussitôt pour rien.
    const objectifs = lignes
      .filter((l) => l.objectif != null && (l.versObjectifPct == null || l.versObjectifPct > 0) && !deja.has(`${l.cle}:${l.objectif}`))
      .map((l) => ({ actif: l.actif, prix: l.objectif! }));
    if (!objectifs.length) return setInfo("Aucun objectif à transformer en alerte (déjà créées, déjà atteints, ou aucun objectif saisi).");
    setConfirmationTp(objectifs);
  };

  const ajouterPosition = () => {
    if (!formulaire) return;
    const q = lireNombre(formulaire.quantite);
    const pamp = lireNombre(formulaire.pamp);
    const objectif = lireNombre(formulaire.objectif);
    if (!formulaire.cle || q == null || q <= 0 || pamp === null || objectif === null) return setInfo("Choisissez un actif et saisissez une quantité positive (PAMP et objectif doivent être des nombres).");
    surPositions((l) => [...l, { id: crypto.randomUUID(), cle: formulaire.cle, quantite: q, pamp, objectif, plateforme: formulaire.plateforme.trim() || undefined }]);
    setFormulaire(null);
    setInfo(null);
  };

  const majLot = (id: string, patch: Partial<Position>) => surPositions((l) => l.map((p) => (p.id === id ? { ...p, ...patch, estimee: "quantite" in patch ? false : p.estimee } : p)));

  return (
    <div className="apparait flex-1 space-y-5 overflow-auto p-6">
      <EnTete titre="Portefeuille" sousTitre="Valeur en euros, plus-values latentes et répartition de vos positions. Lecture seule : rien n'est envoyé nulle part." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="carte-info p-4">
          <div className="text-xs text-doux">Valeur totale</div>
          <div className="titre-serif whitespace-nowrap text-[34px] leading-none">{eur(tot.valeurEur)}</div>
          {tot.nonValorisees > 0 && <div className="text-xs text-alerte">{tot.nonValorisees} ligne{tot.nonValorisees > 1 ? "s" : ""} non valorisée{tot.nonValorisees > 1 ? "s" : ""} (prix ou change manquant)</div>}
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux" title="Calculé sur les lots dont le prix d'achat moyen (PAMP) est connu">P&amp;L latent</div>
          <div className={`titre-serif whitespace-nowrap text-[34px] leading-none ${classePct(tot.pnlEur)}`}>{eur(tot.pnlEur)}</div>
          <div className={`text-xs ${classePct(tot.pnlPct)}`}>{formaterPct(tot.pnlPct)}</div>
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux">Lignes / lots</div>
          <div className="titre-serif whitespace-nowrap text-[34px] leading-none">{lignes.length} / {positions.length}</div>
        </div>
        <div className="carte-info p-4">
          <div className="text-xs text-doux" title="Taux utilisés pour convertir les cotations en euros">Taux de change</div>
          <div className="text-xs">{Object.entries(taux).filter(([d]) => d !== "EUR" && d !== "GBp").map(([d, t]) => `1 ${d} = ${t.toFixed(4).replace(".", ",")} €`).join(" · ") || "—"}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <BarreRepartition titre="Répartition par catégorie" parts={parCategorie} />
        <BarreRepartition titre="Répartition par plateforme" parts={parPlateforme} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="champ" placeholder="Filtrer…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <button className="bouton" onClick={() => setFormulaire(formulaire ? null : { cle: actifs[0] ? cleActif(actifs[0]) : "", quantite: "", pamp: "", objectif: "", plateforme: "" })}>
          ＋ Ajouter une position
        </button>
        <button className="bouton" title="Crée une alerte « prix ≥ objectif » pour chaque objectif saisi" onClick={preparerAlertesTp}>
          🔔 Alertes aux objectifs (TP)
        </button>
        <button className="bouton" title="Reconstitue quantités et PAMP à partir d'un historique d'achats et de ventes (CoinMarketCap, courtier, exchange…)" onClick={() => choixCsv.current?.click()}>
          ⇪ Importer des transactions (CSV)
        </button>
        <input
          ref={choixCsv}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            setFichierCsv(e.target.files?.[0] ?? null);
            e.target.value = ""; // permet de rechoisir le même fichier
          }}
        />
      </div>

      {fichierCsv && (
        <ImportTransactions
          fichier={fichierCsv}
          actifs={actifs}
          positions={positions}
          surAjouterActifs={surAjouterActifs}
          surPositions={surPositions}
          surFermer={(message) => {
            setFichierCsv(null);
            if (message) setInfo(message);
          }}
        />
      )}

      {confirmationTp && (
        <div className="rounded border border-alerte/60 p-3 text-sm">
          Créer <b>{confirmationTp.length}</b> alerte{confirmationTp.length > 1 ? "s" : ""} « prix ≥ objectif » ({confirmationTp.slice(0, 6).map((o) => o.actif.symbole).join(", ")}{confirmationTp.length > 6 ? "…" : ""}) ?
          <div className="mt-2 flex gap-2">
            <button
              className="bouton bouton-actif"
              onClick={() => {
                const n = surAlertesObjectifs(confirmationTp);
                setConfirmationTp(null);
                setInfo(`${n} alerte${n > 1 ? "s" : ""} créée${n > 1 ? "s" : ""}.`);
              }}
            >
              Créer
            </button>
            <button className="bouton" onClick={() => setConfirmationTp(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {formulaire && (
        <div className="flex flex-wrap items-end gap-2 carte-info p-4">
          <label className="flex flex-col gap-1 text-xs text-doux">
            Actif
            <select className="champ max-w-52" value={formulaire.cle} onChange={(e) => setFormulaire({ ...formulaire, cle: e.target.value })}>
              {actifs.map((a) => (
                <option key={cleActif(a)} value={cleActif(a)}>
                  {a.symbole} — {a.nom.slice(0, 22)}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["quantite", "Quantité", "w-28"],
              ["pamp", "PAMP (devise de cotation)", "w-36"],
              ["objectif", "Objectif (TP)", "w-28"],
              ["plateforme", "Plateforme", "w-28"],
            ] as const
          ).map(([k, titre, large]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-doux">
              {titre}
              <input className={`champ ${large}`} value={formulaire[k]} onChange={(e) => setFormulaire({ ...formulaire, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && ajouterPosition()} />
            </label>
          ))}
          <button className="bouton bouton-actif" onClick={ajouterPosition}>
            Ajouter
          </button>
        </div>
      )}
      {info && <p className="m-0 text-xs text-doux">{info}</p>}

      {lignes.length === 0 ? (
        <p className="text-doux">Aucune position. Ajoutez-en une ci-dessus, ou importez vos données (Réglages › Sauvegarde › Importer).</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ligne">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ligne">
                {entete("symbole", "Actif", false)}
                <th className="px-2 py-2 text-right font-normal text-doux">Quantité</th>
                <th className="px-2 py-2 text-right font-normal text-doux">PAMP</th>
                <th className="px-2 py-2 text-right font-normal text-doux">Prix</th>
                {entete("valeurEur", "Valeur")}
                {entete("pnlPct", "P&L %")}
                {entete("pnlEur", "P&L €")}
                {entete("poids", "Poids")}
                {entete("versObjectifPct", "Objectif (TP)")}
              </tr>
            </thead>
            <tbody>
              {affichees.map((l) => (
                <LigneTableau key={l.cle} l={l} ouverte={ouverte === l.cle} surBascule={() => setOuverte(ouverte === l.cle ? null : l.cle)} surOuvrir={() => surOuvrir(l.cle)} majLot={majLot} suppr={(id) => surPositions((p) => p.filter((x) => x.id !== id))} ajouterLot={() => surPositions((p) => [...p, { id: crypto.randomUUID(), cle: l.cle, quantite: 0 }])} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LigneTableau({ l, ouverte, surBascule, surOuvrir, majLot, suppr, ajouterLot }: { l: LignePortefeuille; ouverte: boolean; surBascule: () => void; surOuvrir: () => void; majLot: (id: string, p: Partial<Position>) => void; suppr: (id: string) => void; ajouterLot: () => void }) {
  return (
    <>
      <tr className="border-b border-ligne hover:bg-fond">
        <td className="px-2 py-1.5">
          <button className="mr-1 bg-transparent p-0 text-doux hover:text-texte" aria-label="Détail des lots" title="Lots" onClick={surBascule}>
            {ouverte ? "▾" : "▸"}
          </button>
          <button className="bg-transparent p-0 font-semibold text-texte hover:text-accent" title="Voir le graphique" onClick={surOuvrir}>
            {l.actif.symbole}
          </button>{" "}
          <span className="inline-block max-w-[170px] truncate align-bottom text-xs text-doux" title={l.actif.nom}>
            {l.actif.nom}
          </span>
          {l.lots.length > 1 && <span className="ml-1 text-xs text-doux">({l.lots.length} lots)</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {quantite(l.quantite)}
          {l.estimee && <span title="Quantité estimée à partir du montant importé" className="text-alerte"> ≈</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono text-doux">
          {l.pamp != null ? formaterPrix(l.pamp) : "—"}
          {l.pampPartiel && <span title="Certains lots n'ont pas de PAMP : le P&L les ignore" className="text-alerte"> *</span>}
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {formaterPrix(l.prix)} <span className="text-xs text-doux">{l.devise ?? ""}</span>
        </td>
        <td className="whitespace-nowrap px-2 text-right font-mono">{eur(l.valeurEur)}</td>
        <td className={`whitespace-nowrap px-2 text-right font-mono ${classePct(l.pnlPct)}`}>{formaterPct(l.pnlPct)}</td>
        <td className={`whitespace-nowrap px-2 text-right font-mono ${classePct(l.pnlEur)}`}>{eur(l.pnlEur)}</td>
        <td className="whitespace-nowrap px-2 text-right font-mono">{pourcent(l.poids)}</td>
        <td className="whitespace-nowrap px-2 text-right font-mono">
          {l.objectif != null ? (
            <>
              {formaterPrix(l.objectif)} <span className={`text-xs ${l.versObjectifPct != null && l.versObjectifPct <= 0 ? "text-hausse" : "text-doux"}`}>{l.versObjectifPct != null ? (l.versObjectifPct <= 0 ? "atteint" : `+${l.versObjectifPct.toFixed(0)} %`) : ""}</span>
            </>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {ouverte && (
        <tr className="border-b border-ligne bg-fond">
          <td colSpan={9} className="px-4 py-2">
            <div className="space-y-1">
              {l.lots.map((lot) => (
                <div key={lot.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <ChampLot valeur={lot.quantite} placeholder="Quantité" surChangement={(v) => majLot(lot.id, { quantite: v })} />
                  <ChampLot valeur={lot.pamp} placeholder="PAMP" surChangement={(v) => majLot(lot.id, { pamp: v })} />
                  <ChampLot valeur={lot.objectif} placeholder="Objectif" surChangement={(v) => majLot(lot.id, { objectif: v })} />
                  <input defaultValue={lot.plateforme ?? ""} placeholder="Plateforme" className="champ w-28 !py-1 text-xs" onBlur={(e) => majLot(lot.id, { plateforme: e.target.value.trim() || undefined })} />
                  {lot.montantEur != null && <span className="text-doux">importé : {eur(lot.montantEur, 2)}</span>}
                  <button className="bouton-icone" title="Supprimer ce lot" aria-label="Supprimer ce lot" onClick={() => suppr(lot.id)}>
                    ✕
                  </button>
                </div>
              ))}
              <button className="bouton !py-0.5 text-xs" onClick={ajouterLot}>
                ＋ Ajouter un lot
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
