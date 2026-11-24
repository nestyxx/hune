import { dansTauri } from "../donnees/http";

/** Notification native Windows (toast). Hors Tauri (navigateur de test), repli sur l'API Notification du navigateur. */
export async function notifier(titre: string, corps: string): Promise<void> {
  try {
    if (dansTauri()) {
      const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
      if (!(await isPermissionGranted())) await requestPermission();
      sendNotification({ title: titre, body: corps });
    } else if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") new Notification(titre, { body: corps });
    }
  } catch (e) {
    console.warn("Notification impossible :", e);
  }
}
