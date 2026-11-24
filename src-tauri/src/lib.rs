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
        .on_window_event(|fenetre, evenement| {
            // Croix de la fenêtre : on la masque, l'application reste dans la zone de notification.
            if let WindowEvent::CloseRequested { api, .. } = evenement {
                api.prevent_close();
                let _ = fenetre.hide();
            }
        })
        .setup(|app| {
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
