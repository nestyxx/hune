import { dansTauri } from "./donnees/http";

/** Met à jour l'info-bulle de l'icône de la zone de notification (nombre d'alertes surveillées). */
export async function majInfobulleTray(alertesArmees: number): Promise<void> {
  if (!dansTauri()) return;
  try {
    const { TrayIcon } = await import("@tauri-apps/api/tray");
    const icone = await TrayIcon.getById("principal");
    const texte = alertesArmees > 0 ? `Hune — ${alertesArmees} alerte${alertesArmees > 1 ? "s" : ""} surveillée${alertesArmees > 1 ? "s" : ""}` : "Hune — aucune alerte armée";
    await icone?.setTooltip(texte);
  } catch (e) {
    console.warn("Info-bulle du tray non mise à jour :", e);
  }
}
