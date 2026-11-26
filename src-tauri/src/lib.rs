//! Hune : coque Tauri minimale.
//!
//! Toute la logique (sources de données, indicateurs, alertes, portefeuille) vit côté interface (TypeScript) :
//! la coque ne fait que fournir la fenêtre, la zone de notification (tray), le démarrage avec Windows,
//! le stockage local (fichier JSON), les notifications natives, les requêtes HTTP hors CORS (Yahoo)
//! et les mises à jour automatiques (signées, depuis les releases GitHub).
//! Fermer la fenêtre la masque seulement : la page continue de tourner et vérifie les alertes.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

/// Argument ajouté par le démarrage automatique : l'application démarre réduite dans la zone de notification.
const ARG_REDUIT: &str = "--reduit";

/// Affiche la fenêtre principale et lui donne le focus.
fn montrer_fenetre(app: &AppHandle) {
    if let Some(f) = app.get_webview_window("main") {
        let _ = f.show();
        let _ = f.unminimize();
        let _ = f.set_focus();
    }
}

/// Date UTC (AAAAMMJJ) d'un instant exprimé en secondes depuis 1970 (algorithme « civil from days » de H. Hinnant).
fn jour_depuis_epoch(secondes: u64) -> String {
    let z = (secondes / 86_400) as i64 + 719_468;
    let ere = z.div_euclid(146_097);
    let jour_ere = z.rem_euclid(146_097);
    let annee_ere = (jour_ere - jour_ere / 1_460 + jour_ere / 36_524 - jour_ere / 146_096) / 365;
    let jour_annee = jour_ere - (365 * annee_ere + annee_ere / 4 - annee_ere / 100);
    let mp = (5 * jour_annee + 2) / 153;
    let jour = jour_annee - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let annee = annee_ere + ere * 400 + i64::from(mois <= 2);
    format!("{annee:04}{mois:02}{jour:02}")
}

/// Copie quotidienne de `hune.json` dans `sauvegardes/` (14 jours conservés), faite au démarrage avant que l'interface
/// n'ouvre le fichier. On ne copie que si le fichier contient réellement des données (actifs ou positions) : un fichier
/// vide ne doit jamais faire sortir, par rotation, une copie utile. Pour restaurer : fermer Hune, recopier la sauvegarde
/// voulue par-dessus `hune.json`.
fn sauvegarde_quotidienne(app: &tauri::App) {
    let Ok(dossier) = app.path().app_data_dir() else { return };
    let fichier = dossier.join("hune.json");
    let Ok(contenu) = std::fs::read_to_string(&fichier) else { return };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contenu) else { return };
    let non_vide = |cle: &str| json.get(cle).and_then(|v| v.as_array()).is_some_and(|a| !a.is_empty());
    if !(non_vide("actifs") || non_vide("positions")) {
        return;
    }
    let destination = dossier.join("sauvegardes");
    if std::fs::create_dir_all(&destination).is_err() {
        return;
    }
    let maintenant = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let cible = destination.join(format!("hune-{}.json", jour_depuis_epoch(maintenant)));
    if !cible.exists() {
        let _ = std::fs::copy(&fichier, &cible);
    }
    // Rotation : les noms contiennent la date, le tri alphabétique est donc chronologique.
    if let Ok(entrees) = std::fs::read_dir(&destination) {
        let mut copies: Vec<_> = entrees.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect();
        copies.sort();
        while copies.len() > 14 {
            let _ = std::fs::remove_file(copies.remove(0));
        }
    }
}

/// Un nom de sauvegarde valide est exactement « hune-AAAAMMJJ.json » : aucun séparateur de chemin n'est possible,
/// l'interface ne peut donc lire que les copies automatiques et rien d'autre sur le disque.
fn nom_sauvegarde_valide(nom: &str) -> bool {
    nom.len() == 18 && nom.starts_with("hune-") && nom.ends_with(".json") && nom[5..13].chars().all(|c| c.is_ascii_digit())
}

/// Noms des sauvegardes automatiques, de la plus récente à la plus ancienne.
#[tauri::command]
fn lister_sauvegardes(app: AppHandle) -> Vec<String> {
    let Ok(dossier) = app.path().app_data_dir() else { return vec![] };
    let Ok(entrees) = std::fs::read_dir(dossier.join("sauvegardes")) else { return vec![] };
    let mut noms: Vec<String> = entrees.filter_map(|e| e.ok()).filter_map(|e| e.file_name().into_string().ok()).filter(|n| nom_sauvegarde_valide(n)).collect();
    noms.sort_by(|a, b| b.cmp(a));
    noms
}

/// Le disque contient-il déjà des données de l'application (fichier de données non vide ou copie automatique) ?
/// L'interface s'en sert pour distinguer un premier lancement d'une lecture qui a échoué.
#[tauri::command]
fn donnees_presentes(app: AppHandle) -> bool {
    let Ok(dossier) = app.path().app_data_dir() else { return false };
    let fichier_non_vide = std::fs::metadata(dossier.join("hune.json")).map(|m| m.len() > 200).unwrap_or(false);
    fichier_non_vide || !lister_sauvegardes(app).is_empty()
}

/// Contenu d'une sauvegarde automatique (JSON brut, validé ensuite par l'interface avant toute restauration).
#[tauri::command]
fn lire_sauvegarde(app: AppHandle, nom: String) -> Result<String, String> {
    if !nom_sauvegarde_valide(&nom) {
        return Err("Nom de sauvegarde invalide".into());
    }
    let dossier = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::read_to_string(dossier.join("sauvegardes").join(nom)).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{jour_depuis_epoch, nom_sauvegarde_valide};

    #[test]
    fn noms_de_sauvegarde() {
        assert!(nom_sauvegarde_valide("hune-20261124.json"));
        for mauvais in ["hune-2026112.json", "hune-2026112a.json", "../hune-20261124.json", "hune-20261124.json.bak", "autre-20261124.json", "hune-20261124/../x.json"] {
            assert!(!nom_sauvegarde_valide(mauvais), "{mauvais}");
        }
    }

    #[test]
    fn dates_connues() {
        assert_eq!(jour_depuis_epoch(0), "19700101");
        assert_eq!(jour_depuis_epoch(86_400 * 365), "19710101");
        assert_eq!(jour_depuis_epoch(951_782_400), "20000229"); // année bissextile
        assert_eq!(jour_depuis_epoch(951_868_800), "20000301");
        assert_eq!(jour_depuis_epoch(1_795_564_800), "20261125"); // 25 novembre 2026, 00:00 UTC
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Une seule instance : relancer l'application ramène simplement la fenêtre.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| montrer_fenetre(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![ARG_REDUIT])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![lister_sauvegardes, lire_sauvegarde, donnees_presentes])
        .on_window_event(|fenetre, evenement| {
            // Croix de la fenêtre : on la masque, l'application reste dans la zone de notification.
            if let WindowEvent::CloseRequested { api, .. } = evenement {
                api.prevent_close();
                let _ = fenetre.hide();
            }
        })
        .setup(|app| {
            sauvegarde_quotidienne(app);

            let ouvrir = MenuItem::with_id(app, "ouvrir", "Ouvrir", true, None::<&str>)?;
            let quitter = MenuItem::with_id(app, "quitter", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&ouvrir, &quitter])?;

            let mut tray = TrayIconBuilder::with_id("principal")
                .tooltip("Hune")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, evt| match evt.id().as_ref() {
                    "ouvrir" => montrer_fenetre(app),
                    "quitter" => app.exit(0),
                    _ => {}
                })
                // Clic gauche sur l'icône = ouvrir.
                .on_tray_icon_event(|tray, evt| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evt {
                        montrer_fenetre(tray.app_handle());
                    }
                });
            if let Some(icone) = app.default_window_icon() {
                tray = tray.icon(icone.clone());
            }
            tray.build(app)?;

            // Démarrage avec Windows : la fenêtre reste masquée, seules les alertes tournent.
            if std::env::args().any(|a| a == ARG_REDUIT) {
                if let Some(f) = app.get_webview_window("main") {
                    let _ = f.hide();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application");
}
