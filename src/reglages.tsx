import { useEffect, useRef, useState } from "react";
import { notifier } from "./alertes/notifier";
import { EnTete } from "./composants";
import { dansTauri } from "./donnees/http";
import { construireSauvegarde, fusionner, lireSauvegarde, restaurer, telecharger, type Sauvegarde } from "./sauvegarde";
import type { useMiseAJour } from "./miseajour";
import { listerCopies, type CopieAuto } from "./restauration";
import type { PreferenceTheme } from "./theme";

export interface Reglages {
  /** Période de vérification des alertes, en secondes (30 à 60). */
  periodeAlertesS: number;
  theme: PreferenceTheme;
}
export const REGLAGES_PAR_DEFAUT: Reglages = { periodeAlertesS: 45, theme: "auto" };

const RACCOURCIS: [string, string][] = [
  ["Ctrl + K", "Aller à la recherche"],
  ["↑ / ↓", "Actif précédent / suivant dans la liste"],
  ["1 à 6", "Intervalle 15 min · 1 h · 4 h · 1 j · 1 sem · 1 mois"],
  ["L", "Afficher / masquer la liste des actifs"],
  ["R", "Recentrer le graphique (ou double-clic)"],
  ["G · F · M · A · P", "Onglets Graphique / Portefeuille / Marché / Alertes / Réglages"],
  ["Clic droit sur le graphique", "Créer une alerte de prix à ce niveau"],
];

interface Props {
  reglages: Reglages;
  surChangement: (r: Reglages) => void;
  maj: ReturnType<typeof useMiseAJour>;
}

/** Onglet « Réglages » : apparence, vérification des alertes, démarrage avec Windows, mises à jour, sauvegarde, raccourcis. */
export function PanneauReglages({ reglages, surChangement, maj }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (dansTauri()) import("@tauri-apps/api/app").then(({ getVersion }) => getVersion()).then(setVersion).catch(() => {});
  }, []);
  const [demarrage, setDemarrage] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [importEnAttente, setImportEnAttente] = useState<{ donnees: Sauvegarde["donnees"]; resume: string } | null>(null);
  const [infoSauvegarde, setInfoSauvegarde] = useState<string | null>(null);
  const [copies, setCopies] = useState<CopieAuto[]>([]);
  const [aRestaurer, setARestaurer] = useState<CopieAuto | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listerCopies().then(setCopies);
  }, []);

  useEffect(() => {
    if (!dansTauri()) return setDemarrage(null);
    import("@tauri-apps/plugin-autostart").then(({ isEnabled }) => isEnabled()).then(setDemarrage).catch((e) => setErreur(String(e)));
  }, []);

  const basculerDemarrage = async (actif: boolean) => {
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      await (actif ? enable() : disable());
      setDemarrage(actif);
      setErreur(null);
    } catch (e) {
      setErreur(`Impossible de modifier le démarrage automatique : ${e}`);
    }
  };

  const exporter = async () => {
    const s = await construireSauvegarde();
    telecharger(`hune-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 2));
    setInfoSauvegarde("Sauvegarde exportée (dossier Téléchargements).");
  };

  const choisirFichier = async (f: File | undefined) => {
    if (!f) return;
    try {
      const donnees = lireSauvegarde(await f.text());
      const nbA = Array.isArray(donnees.actifs) ? donnees.actifs.length : 0;
      const nbAl = Array.isArray(donnees.alertes) ? donnees.alertes.length : 0;
      const nbP = Array.isArray(donnees.positions) ? donnees.positions.length : 0;
      setImportEnAttente({ donnees, resume: `${nbA} actif${nbA > 1 ? "s" : ""}, ${nbP} position${nbP > 1 ? "s" : ""}, ${nbAl} alerte${nbAl > 1 ? "s" : ""}` });
      setInfoSauvegarde(null);
    } catch (e) {
      setImportEnAttente(null);
      setInfoSauvegarde(e instanceof Error ? e.message : String(e));
    }
    if (fichier.current) fichier.current.value = "";
  };

  return (
    <div className="apparait flex-1 space-y-5 overflow-auto p-6">
      <EnTete titre="Réglages" sousTitre="Apparence, alertes, mises à jour et sauvegardes." />
      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Apparence</h2>
        <div className="flex gap-1" role="radiogroup" aria-label="Thème">
          {(["auto", "clair", "sombre"] as PreferenceTheme[]).map((t) => (
            <button key={t} role="radio" aria-checked={reglages.theme === t} className={`bouton ${reglages.theme === t ? "bouton-actif" : ""}`} onClick={() => surChangement({ ...reglages, theme: t })}>
              {t === "auto" ? "Auto (Windows)" : t === "clair" ? "Clair" : "Sombre"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Alertes</h2>
        <label className="flex items-center gap-3">
          Vérifier les alertes toutes les
          <select className="champ" value={reglages.periodeAlertesS} onChange={(e) => surChangement({ ...reglages, periodeAlertesS: Number(e.target.value) })}>
            {[30, 45, 60].map((s) => (
              <option key={s} value={s}>
                {s} secondes
              </option>
            ))}
          </select>
        </label>
        <button className="bouton mt-3" onClick={() => void notifier("Hune", "Notification de test : tout fonctionne.")}>
          Tester la notification
        </button>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Application</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!demarrage} disabled={demarrage === null} onChange={(e) => void basculerDemarrage(e.target.checked)} />
          Démarrer avec Windows (réduite dans la zone de notification)
        </label>
        {demarrage === null && !erreur && <p className="m-0 mt-2 text-xs text-doux">Disponible uniquement dans l'application installée ou lancée avec Tauri.</p>}
        {erreur && <p className="m-0 mt-2 text-xs text-baisse">{erreur}</p>}
        <p className="m-0 mt-3 text-xs text-doux">Fermer la fenêtre ne quitte pas l'application : elle reste dans la zone de notification pour surveiller les alertes. Pour quitter : clic droit sur l'icône › Quitter.</p>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Mises à jour</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span>Hune {version ?? "(version de développement)"}</span>
          <button className="bouton" disabled={!dansTauri() || maj.etat.etat === "verification" || maj.etat.etat === "telechargement"} onClick={() => void maj.verifier(true)}>
            Rechercher une mise à jour
          </button>
          {maj.etat.etat === "verification" && <span className="text-xs text-doux">Vérification…</span>}
          {maj.etat.etat === "a-jour" && <span className="text-xs text-hausse">À jour (vérifié à {new Date(maj.etat.verifieLe).toLocaleTimeString("fr-FR")})</span>}
          {maj.etat.etat === "disponible" && (
            <>
              <span className="text-xs text-alerte">Version {maj.etat.version} disponible</span>
              <button className="bouton bouton-actif" onClick={() => void maj.installer()}>
                Installer et redémarrer
              </button>
            </>
          )}
          {maj.etat.etat === "telechargement" && <span className="text-xs text-doux">Téléchargement{maj.etat.pct != null ? ` : ${maj.etat.pct} %` : "…"}</span>}
          {maj.etat.etat === "erreur" && <span className="text-xs text-baisse">Échec : {maj.etat.message}</span>}
        </div>
        <p className="m-0 mt-2 text-xs text-doux">Vérification automatique au démarrage puis toutes les 6 h. Les mises à jour sont signées : l'application refuse tout fichier qui ne l'est pas, et rien n'est installé sans votre clic.</p>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Sauvegarde</h2>
        <p className="m-0 mb-3 text-xs text-doux">Watchlist, catégories, alertes et réglages dans un fichier JSON : pour changer de PC ou garder une copie. Aucune clé ni donnée de compte n'est stockée. Une copie automatique est aussi faite chaque jour au démarrage (14 jours conservés) dans <code>%APPDATA%\io.github.nestyxx.hune\sauvegardes</code> : pour restaurer, fermez Hune puis recopiez une de ces copies par-dessus <code>hune.json</code>.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="bouton" onClick={() => void exporter()}>
            Exporter…
          </button>
          <button className="bouton" onClick={() => fichier.current?.click()}>
            Importer…
          </button>
          <input ref={fichier} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void choisirFichier(e.target.files?.[0])} />
        </div>
        {importEnAttente && (
          <div className="mt-3 rounded border border-alerte/60 p-3 text-sm">
            Importer {importEnAttente.resume} ?
            <div className="mt-1 text-xs text-doux">
              <b>Fusionner</b> ajoute ou met à jour sans rien supprimer (vos alertes et réglages sont conservés). <b>Remplacer</b> écrase les données actuelles correspondantes.
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="bouton bouton-actif"
                onClick={async () => {
                  const courant = (await construireSauvegarde()).donnees;
                  await restaurer(fusionner(courant, importEnAttente.donnees));
                  location.reload(); // l'interface se recharge avec les données importées
                }}
              >
                Fusionner et recharger
              </button>
              <button
                className="bouton"
                onClick={async () => {
                  await restaurer(importEnAttente.donnees);
                  location.reload();
                }}
              >
                Remplacer et recharger
              </button>
              <button className="bouton" onClick={() => setImportEnAttente(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {infoSauvegarde && <p className="m-0 mt-2 text-xs text-doux">{infoSauvegarde}</p>}

        {copies.length > 0 && (
          <div className="mt-4">
            <h3 className="m-0 mb-2 text-sm font-semibold">Copies automatiques</h3>
            <ul className="m-0 list-none space-y-1 p-0">
              {copies.map((c) => (
                <li key={c.nom} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ligne px-3 py-1.5 text-sm">
                  <span>
                    {c.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    <span className="ml-2 text-xs text-doux">
                      {c.actifs} actif{c.actifs > 1 ? "s" : ""} · {c.positions} position{c.positions > 1 ? "s" : ""} · {c.alertes} alerte{c.alertes > 1 ? "s" : ""}
                    </span>
                  </span>
                  {aRestaurer?.nom === c.nom ? (
                    <span className="flex items-center gap-2 text-xs">
                      Remplacer vos données actuelles ?
                      <button
                        className="bouton bouton-actif !py-0.5"
                        onClick={async () => {
                          await restaurer(c.donnees);
                          location.reload(); // l'interface se recharge avec les données restaurées
                        }}
                      >
                        Restaurer
                      </button>
                      <button className="bouton !py-0.5" onClick={() => setARestaurer(null)}>
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <button className="bouton !py-0.5 text-xs" onClick={() => setARestaurer(c)}>
                      Restaurer…
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Raccourcis</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {RACCOURCIS.map(([touche, effet]) => (
            <div key={touche} className="contents">
              <dt className="font-mono text-doux">{touche}</dt>
              <dd className="m-0">{effet}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5 text-xs text-doux">
        Lecture seule : aucune fonction de trading, aucun compte, aucune clé API. Crypto : API publique Binance (temps réel). Actions : Yahoo Finance, endpoint non officiel, données différées.
      </section>
    </div>
  );
}
