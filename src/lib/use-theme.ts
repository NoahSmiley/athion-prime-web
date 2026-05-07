import { useEffect, useState } from "react";
import { applyTheme, loadSettings, saveSettings, type ThemeKey } from "./settings";

/**
 * Subscribes to the persisted theme. Returns the current value and a setter
 * that persists the change and applies it to <html data-theme=...> in one
 * step. All listeners (across browser tabs and within the same tab) update
 * via a 'storage' event + a synthetic 'prime:theme-change' event.
 */
const EVENT = "prime:theme-change";

export function useTheme(): [ThemeKey, (next: ThemeKey) => void] {
  const [theme, setTheme] = useState<ThemeKey>(() => loadSettings().theme);

  useEffect(() => {
    const onChange = () => setTheme(loadSettings().theme);
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (next: ThemeKey) => {
    const current = loadSettings();
    saveSettings({ ...current, theme: next });
    applyTheme(next);
    setTheme(next);
    window.dispatchEvent(new Event(EVENT));
  };

  return [theme, update];
}
