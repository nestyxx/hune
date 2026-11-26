import { useEffect, useMemo, useState } from "react";
import { fournisseur } from "./donnees";
import { tauxVersEur } from "./donnees/change";
import { cleActif, type Actif } from "./donnees/types";
import { formaterPrix } from "./format";
import { analyserCsv, plateformeDepuisNom, planifierImport, resoudreTokens, synthetiser, type AnalyseCsv, type ResolutionToken } from "./import-transactions";
import type { Position } from "./portefeuille";

interface Props {
  fichier: File;
  actifs: Actif[];
  positions: Position[];
  surAjouterActifs: (nouveaux: Actif[]) => void;
  surPositions: (modifier: (l: Position[]) => Position[]) => void;
  /** Referme le panneau ; `message` est affiché dans le portefeuille. */
  surFermer: (message?: string) => void;
}

const quantite = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: q >= 1000 ? 0 : q >= 1 ? 4 : 8 });

/**
 * Aperçu d'un import de transactions CSV (CoinMarketCap, courtiers, exchanges…) : rien n'est écrit tant que
 * vous n'avez pas cliqué sur « Importer ». Quantités et PAMP sont recalculés à partir des achats et des ventes.
 */
export function ImportTransactions({ fichier, actifs, positions, surAjouterActifs, surPositions, surFermer }: Props) {
  const [texte, setTexte] = useState<string | null>(null);
  const [plateforme, setPlateforme] = useState(() => plateformeDepuisNom(fichier.name));
  const [retirerDoublons, setRetirerDoublons] = useState(true);
  const [resolutions, setResolutions] = useState<Map<string, ResolutionToken | null> | null>(null);
  const [taux, setTaux] = useState<Record<string, number>>({ EUR: 1 });

  useEffect(() => {
    let annule = false;
    void fichier.text().then((t) => !annule && setTexte(t));
    return () => {
      annule = true;
    };
  }, [fichier]);

  const analyse = useMemo((): { ok: AnalyseCsv } | { erreur: string } | null => {
    if (texte == null) return null;
    try {
      return { ok: analyserCsv(texte, retirerDoublons) };
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : String(e) };
    }
  }, [texte, retirerDoublons]);

  const synthese = useMemo(() => (analyse && "ok" in analyse ? synthetiser(analyse.ok.transactions) : null), [analyse]);
  const tokens = useMemo(() => (synthese ? synthese.lignes.map((l) => l.token).sort().join(",") : ""), [synthese]);
  const deviseFichier = analyse && "ok" in analyse ? analyse.ok.devise : "EUR";

  // Association token → actif, puis taux de change pour convertir le PAMP vers la devise de chaque actif.
  useEffect(() => {
    if (!tokens) return;
    let annule = false;
    setResolutions(null);
    void (async () => {
      const r = await resoudreTokens(tokens.split(","), {
        actifs,
        rechercher: (q) => fournisseur("binance").rechercher(q),
        devise: (a) => fournisseur(a.source).devise(a.symbole),
      });
      const devises = [...new Set([deviseFichier, ...[...r.values()].flatMap((x) => (x ? [x.devise] : []))])];
      const t = await tauxVersEur(devises).catch(() => ({ EUR: 1 }) as Record<string, number>);
      if (!annule) {
        setTaux(t);
        setResolutions(r);
      }
    })();
    return () => {
      annule = true;
    };
    // `actifs` change quand on ajoute un actif : on ne relance que si la liste de tokens change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, deviseFichier]);

  const plan = useMemo(() => (synthese && resolutions ? planifierImport(synthese, resolutions, plateforme.trim(), deviseFichier, taux, positions, actifs) : null), [synthese, resolutions, plateforme, deviseFichier, taux, positions, actifs]);
  const plateformes = useMemo(() => [...new Set(positions.map((p) => p.plateforme).filter((x): x is string => !!x))], [positions]);

  const importer = () => {
    if (!plan || !plan.positions.length || !plateforme.trim()) return;
    const ids = new Set(plan.remplacees.map((p) => p.id));
    surAjouterActifs(plan.actifs);
    surPositions((l) => [...l.filter((p) => !ids.has(p.id)), ...plan.positions]);
    const n = plan.positions.length;
    surFermer(`${n} position${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""} depuis ${fichier.name}${plan.actifs.length ? `, ${plan.actifs.length} actif${plan.actifs.length > 1 ? "s" : ""} ajouté${plan.actifs.length > 1 ? "s" : ""} à la watchlist` : ""}${plan.remplacees.length ? `, ${plan.remplacees.length} lot${plan.remplacees.length > 1 ? "s" : ""} existant${plan.remplacees.length > 1 ? "s" : ""} remplacé${plan.remplacees.length > 1 ? "s" : ""}` : ""}.`);
  };

  const introuvables = synthese && resolutions ? synthese.lignes.filter((l) => !resolutions.get(l.token)) : [];

  return (
    <div className="carte-info space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">Importer des transactions</h2>
        <button className="bouton" onClick={() => surFermer()}>
          Annuler
        </button>
      </div>

      {analyse == null && <p className="m-0 text-xs text-doux">Lecture du fichier…</p>}
      {analyse && "erreur" in analyse && <p className="m-0 text-sm text-baisse">{analyse.erreur}</p>}

      {analyse && "ok" in analyse && synthese && (
        <>
          <p className="m-0 text-xs text-doux">
            <b className="text-texte">{fichier.name}</b> · format reconnu : {analyse.ok.format} · {analyse.ok.transactions.length} transaction{analyse.ok.transactions.length > 1 ? "s" : ""} (achats et ventes) · montants en {analyse.ok.devise}. Les quantités et les PAMP ci-dessous sont recalculés à partir de l'historique (frais d'achat inclus). Rien n'est écrit tant que vous n'avez pas cliqué sur « Importer ».
          </p>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs text-doux">
              Plateforme (pour la répartition)
              <input className="champ w-48" list="plateformes-import" value={plateforme} onChange={(e) => setPlateforme(e.target.value)} placeholder="ex. Trade Republic" />
              <datalist id="plateformes-import">
                {plateformes.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="flex items-center gap-2 text-xs" title="Deux lignes au même instant, même token, même quantité et même montant : typique d'une migration de ticker (MATIC → POL) consignée deux fois.">
              <input type="checkbox" checked={retirerDoublons} onChange={(e) => setRetirerDoublons(e.target.checked)} />
              Retirer les lignes strictement identiques
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-ligne">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ligne text-xs text-doux">
                  <th className="px-2 py-2 text-left font-normal">Token</th>
                  <th className="px-2 py-2 text-right font-normal">Quantité</th>
                  <th className="px-2 py-2 text-right font-normal">PAMP ({analyse.ok.devise})</th>
                  <th className="px-2 py-2 text-right font-normal">Achats / ventes</th>
                  <th className="px-2 py-2 text-left font-normal">Actif suivi</th>
                </tr>
              </thead>
              <tbody>
                {synthese.lignes.map((l) => {
                  const r = resolutions?.get(l.token);
                  return (
                    <tr key={l.token} className="border-b border-ligne last:border-0">
                      <td className="px-2 py-1.5 font-semibold">{l.token}</td>
                      <td className="px-2 text-right font-mono">{quantite(l.quantite)}</td>
                      <td className="px-2 text-right font-mono text-doux">{formaterPrix(l.pamp)}</td>
                      <td className="px-2 text-right font-mono text-doux">
                        {l.achats} / {l.ventes}
                      </td>
                      <td className="px-2 text-xs">
                        {resolutions == null ? (
                          <span className="text-doux">recherche…</span>
                        ) : r == null ? (
                          <span className="text-baisse">introuvable sur Binance : ignoré</span>
                        ) : (
                          <>
                            {r.actif.symbole} <span className="text-doux">{r.existant ? "· déjà suivi" : "· sera ajouté"}</span>
                            {r.devise !== analyse.ok.devise &&
                              (taux[r.devise] == null || taux[analyse.ok.devise] == null ? (
                                <span className="text-alerte"> · taux de change indisponible : PAMP non importé</span>
                              ) : (
                                <span className="text-doux"> · PAMP converti en {r.devise} au taux du jour</span>
                              ))}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="m-0 list-disc space-y-0.5 pl-5 text-xs text-doux">
            {synthese.soldes.length > 0 && <li>Entièrement vendu, donc non importé : {synthese.soldes.join(", ")}.</li>}
            {analyse.ok.ignorees.map((i) => (
              <li key={i.motif}>
                {i.nombre} ligne{i.nombre > 1 ? "s" : ""} ignorée{i.nombre > 1 ? "s" : ""} : {i.motif}.
              </li>
            ))}
            {[...analyse.ok.avertissements, ...synthese.avertissements].map((a) => (
              <li key={a}>{a}</li>
            ))}
            {introuvables.length > 0 && <li className="text-alerte">Sans cotation Binance : {introuvables.map((l) => l.token).join(", ")} (à ajouter à la main depuis la recherche).</li>}
            {plan && plan.remplacees.length > 0 && (
              <li>
                {plan.remplacees.length} lot{plan.remplacees.length > 1 ? "s" : ""} déjà saisi{plan.remplacees.length > 1 ? "s" : ""} pour « {plateforme.trim()} » sur ces actifs {plan.remplacees.length > 1 ? "seront remplacés" : "sera remplacé"} (objectifs conservés) ; les lots des autres plateformes ne sont pas touchés.
              </li>
            )}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button className="bouton bouton-actif" disabled={!plan || !plan.positions.length || !plateforme.trim()} onClick={importer}>
              {plan ? `Importer ${plan.positions.length} position${plan.positions.length > 1 ? "s" : ""}` : "Préparation…"}
            </button>
            {!plateforme.trim() && <span className="text-xs text-alerte">Indiquez la plateforme.</span>}
            {plan && plan.actifs.length > 0 && <span className="text-xs text-doux">{plan.actifs.map((a) => cleActif(a).split(":")[1]).join(", ")} rejoin{plan.actifs.length > 1 ? "dront" : "dra"} la watchlist.</span>}
          </div>
        </>
      )}
    </div>
  );
}
