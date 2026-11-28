import { useEffect, useRef, useState } from "react";
import { notifier } from "./alertes/notifier";
import { EnTete } from "./composants";
import { dansTauri } from "./donnees/http";
import type { ModeVariation } from "./donnees/types";
import { PERIODE_PORTEFEUILLE_PAR_DEFAUT, type PeriodePortefeuille } from "./historique-portefeuille";
import { TRI_PORTEFEUILLE_PAR_DEFAUT, type DeviseAffichage, type TriPortefeuille } from "./portefeuille";
import { NOM_SYSTEME, TOUCHE_RACCOURCI, ZONE_ICONE } from "./plateforme";
import { construireSauvegarde, fusionner, lireSauvegarde, restaurer, telecharger, type Sauvegarde } from "./sauvegarde";
import type { useMiseAJour } from "./miseajour";
import { SectionSynchro } from "./sync/section-synchro";
import { SectionNotifications } from "./notifications/section-notifications";
import type { ConfigNotifications } from "./notifications/config";
import type { EntreesRecap } from "./notifications/recap-donnees";
import type { useSynchro } from "./sync/use-synchro";
import { definirLogosActions, useLogosActions } from "./icone-actif";
import { listerCopies, type CopieAuto } from "./restauration";
import type { PreferenceTheme } from "./theme";

export interface Reglages {
  /** Période de vérification des alertes, en secondes (30 à 60). */
  periodeAlertesS: number;
  theme: PreferenceTheme;
  /** Variation affichée pour les cryptos : 24 h glissantes ou journée UTC (voir `ModeVariation`). */
  variation: ModeVariation;
  /** Devise d'affichage du portefeuille (€ ou $). */
  devise: DeviseAffichage;
  /** Colonne et sens de tri du tableau du portefeuille. */
  triPortefeuille: TriPortefeuille;
  /** Période du graphique de valeur du portefeuille. */
  periodePortefeuille: PeriodePortefeuille;
  /** Valeurs affichées aux sommets et aux creux du graphique. */
  sommets: boolean;
}
export const REGLAGES_PAR_DEFAUT: Reglages = { periodeAlertesS: 45, theme: "auto", variation: "24h", devise: "EUR", triPortefeuille: TRI_PORTEFEUILLE_PAR_DEFAUT, periodePortefeuille: PERIODE_PORTEFEUILLE_PAR_DEFAUT, sommets: true };

const RACCOURCIS: [string, string][] = [
  [`${TOUCHE_RACCOURCI} + K`, "Aller à la recherche"],
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
  synchro: ReturnType<typeof useSynchro>;
  notifications: { config: ConfigNotifications; surChangement: (c: ConfigNotifications) => void; lireEntrees: () => Omit<EntreesRecap, "depuisMs"> };
}

/** Onglet « Réglages » : apparence, vérification des alertes, démarrage avec Windows, mises à jour, sauvegarde, raccourcis. */
export function PanneauReglages({ reglages, surChangement, maj, synchro, notifications }: Props) {
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

  const logos = useLogosActions();
  return (
    <div className="apparait flex-1 space-y-5 overflow-auto p-6">
      <EnTete titre="Réglages" sousTitre="Apparence, alertes, notifications, IA, mises à jour et sauvegardes." />
      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Apparence</h2>
        <div className="flex gap-1" role="radiogroup" aria-label="Thème">
          {(["auto", "clair", "sombre"] as PreferenceTheme[]).map((t) => (
            <button key={t} role="radio" aria-checked={reglages.theme === t} className={`bouton ${reglages.theme === t ? "bouton-actif" : ""}`} onClick={() => surChangement({ ...reglages, theme: t })}>
              {t === "auto" ? "Auto (Windows)" : t === "clair" ? "Clair" : "Sombre"}
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={logos} onChange={(e) => definirLogosActions(e.target.checked)} />
          <span>
            Logos des actions et ETF
            <span className="block text-xs text-doux">Chargés depuis Financial Modeling Prep (image publique) pour les seuls titres que vous suivez ; le symbole est alors envoyé à ce site. Décochez pour des initiales, sans aucune requête. Les cryptos ont leurs icônes dans l'application.</span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Variation des cryptos</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Définition de la variation">
          {(
            [
              ["24h", "24 h glissantes"],
              ["jour", "Depuis 00:00 UTC (jour)"],
            ] as const
          ).map(([v, libelle]) => (
            <button key={v} role="radio" aria-checked={reglages.variation === v} className={`bouton ${reglages.variation === v ? "bouton-actif" : ""}`} onClick={() => surChangement({ ...reglages, variation: v })}>
              {libelle}
            </button>
          ))}
        </div>
        <p className="m-0 mt-2 text-xs text-doux">
          <b>24 h glissantes</b> : le prix actuel comparé à celui d'il y a 24 heures (valeur de Binance). <b>Depuis 00:00 UTC</b> : comparé à l'ouverture du jour (01:00 en France l'hiver, 02:00 l'été), comme sur TradingView, donc la variation repart de zéro chaque nuit. S'applique à la liste, à la carte Marché et à l'en-tête. Les actions sont toujours comparées à la clôture précédente.
        </p>
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

      <SectionNotifications config={notifications.config} surChangement={notifications.surChangement} lireEntrees={notifications.lireEntrees} />

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Application</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!demarrage} disabled={demarrage === null} onChange={(e) => void basculerDemarrage(e.target.checked)} />
          Démarrer avec {NOM_SYSTEME} (réduite dans la {ZONE_ICONE})
        </label>
        {demarrage === null && !erreur && <p className="m-0 mt-2 text-xs text-doux">Disponible uniquement dans l'application installée ou lancée avec Tauri.</p>}
        {erreur && <p className="m-0 mt-2 text-xs text-baisse">{erreur}</p>}
        <p className="m-0 mt-3 text-xs text-doux">Fermer la fenêtre ne quitte pas l'application : elle reste dans la {ZONE_ICONE} pour surveiller les alertes. Pour quitter : clic droit sur l'icône › Quitter.</p>
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

      <SectionSynchro synchro={synchro} />

      <section className="rounded-2xl border border-ligne bg-carte p-5">
        <h2 className="m-0 mb-3 text-base font-semibold">Sauvegarde</h2>
        <p className="m-0 mb-3 text-xs text-doux">Watchlist, catégories, alertes et réglages dans un fichier JSON : pour changer de PC ou garder une copie. Aucun mot de passe, jeton ni clé n'y figure : ils restent dans le coffre du système, et la configuration des notifications reste sur ce PC. Une copie automatique est aussi faite chaque jour au démarrage (14 jours conservés) dans <code>%APPDATA%\io.github.nestyxx.hune\sauvegardes</code> : pour restaurer, fermez Hune puis recopiez une de ces copies par-dessus <code>hune.json</code>.</p>
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
          <div className="mt-3 rounded-xl border border-alerte/60 p-3 text-sm">
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
                <li key={c.nom} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ligne px-3 py-1.5 text-sm">
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
        Lecture seule : aucune fonction de trading, aucun compte de courtier. Les notifications et l'IA sont facultatives et n'utilisent que vos propres comptes (ntfy, SMTP, Brevo, OVH, Telegram, OpenRouter…). Crypto : API publique Binance (temps réel). Actions : Yahoo Finance, endpoint non officiel, données différées. Logos d'actions : Financial Modeling Prep (désactivable).
      </section>
    </div>
  );
}
