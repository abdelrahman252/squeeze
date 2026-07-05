import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__ || !(window as any).__TAURI_INTERNALS__.metadata) {
      return;
    }
    try {
      const win = getCurrentWindow();
      win.isMaximized().then(setMaximized).catch(() => {});
      const unlisten = win.onResized(async () => {
        try {
          setMaximized(await win.isMaximized());
        } catch {}
      });
      return () => {
        unlisten.then((f) => f()).catch(() => {});
      };
    } catch (e) {
      console.warn("Tauri window APIs not available:", e);
    }
  }, []);

  return maximized;
}
