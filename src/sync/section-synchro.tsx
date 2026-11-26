import { FolderSync } from "lucide-react";
import { useState } from "react";
import type { useSynchro } from "./use-synchro";

function ilYa(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
}

/** Section « Synchronisation » des Réglages : dossier partagé (Drive…), chiffrement facultatif, état de la dernière synchronisation. */
export function SectionSynchro({ synchro }: { synchro: ReturnType<typeof useSynchro> }) {
  const { disponible, config, statut } = synchro;
  const [motDePasse, setMotDePasse] = useState("");
  const [arret, setArret] = useState(false);
  const actif = !!config?.dossier;
  const libelleStatut =
    statut.phase === "en-cours" ? "Synchronisation en cours…" : statut.phase === "ok" && statut.derniere ? `Synchronisé ${ilYa(statut.derniere)}` : statut.phase === "erreur" ? "Synchronisation en échec" : "";

  return (
    <section className="rounded-2xl border border-ligne bg-carte p-5">
      <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-semibold">
        <FolderSync size={18} /> Synchronisation entre appareils
      </h2>
      <p className="m-0 mb-3 text-xs text-doux">
        Retrouvez votre liste, votre portefeuille, vos alertes et vos tracés sur plusieurs ordinateurs. Choisissez un dossier que vous synchronisez déjà (OneDrive, iCloud Drive, Google Drive, Synology Drive, Syncthing…) : Hune y garde un seul fichier,{" "}
        <code>hune-sync.json</code>, et le fusionne avec ses données à chaque modification, au démarrage et chaque minute. Aucun serveur, aucun compte : c'est votre Drive qui transporte le fichier. Les préférences d'affichage (thème, fenêtre, indicateurs) restent propres à chaque appareil.
      </p>
      {!disponible ? (
        <p className="m-0 text-sm text-doux">Disponible dans l'application installée (Windows ou Mac), pas dans le navigateur de test.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button className={`bouton ${actif ? "" : "bouton-actif"}`} onClick={() => void synchro.choisir()}>
              {actif ? "Changer de dossier…" : "Choisir le dossier…"}
            </button>
            {actif && (
              <>
                <button className="bouton" disabled={statut.phase === "en-cours"} onClick={synchro.maintenant}>
                  Synchroniser maintenant
                </button>
                <button
                  className={`bouton ${arret ? "!border-baisse !text-baisse" : ""}`}
                  onClick={() => {
                    if (arret) {
                      void synchro.arreter();
                      setArret(false);
                    } else setArret(true);
                  }}
                >
                  {arret ? "Confirmer l'arrêt" : "Arrêter"}
                </button>
              </>
            )}
          </div>
          {actif && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="break-all text-xs text-doux" title="Dossier de synchronisation">
                {config?.dossier}
              </div>
              {libelleStatut && <div className={statut.phase === "erreur" ? "text-alerte" : "text-doux"}>{libelleStatut}</div>}
              {statut.message && <div className="rounded-xl border border-alerte/60 p-3 text-xs">{statut.message}</div>}
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <label className="flex flex-col gap-1 text-xs text-doux">
                  Mot de passe de chiffrement (facultatif, le même sur chaque appareil)
                  <input type="password" className="champ w-64" value={motDePasse} placeholder={config?.motDePasse ? "•••••••• (défini)" : "Aucun : fichier lisible"} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="off" />
                </label>
                <button
                  className="bouton"
                  disabled={motDePasse === (config?.motDePasse ?? "")}
                  onClick={() => {
                    void synchro.definirMotDePasse(motDePasse);
                    setMotDePasse("");
                  }}
                >
                  {motDePasse ? "Enregistrer et chiffrer" : "Retirer le chiffrement"}
                </button>
              </div>
              <p className="m-0 text-xs text-doux">
                Chiffré (AES-256), le fichier est illisible sans ce mot de passe, même pour votre fournisseur de Drive. Il est mémorisé sur cet appareil ; si vous l'oubliez, vos données locales restent intactes mais le fichier ne peut plus être relu. Une copie de la version précédente est gardée à côté (<code>hune-sync.precedent.json</code>).
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
