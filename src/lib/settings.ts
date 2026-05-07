/**
 * App-wide preferences persisted to localStorage. Single read on mount,
 * single write on save — no SSR concerns since this is a Vite SPA.
 */

const STORAGE_KEY = "athion-prime:settings";

export type QualityKey = "local" | "remote-40" | "remote-10";

export const QUALITY_OPTIONS: { key: QualityKey; label: string; bitrate: number; hint: string }[] = [
  { key: "local", label: "Local 4K Remux", bitrate: 80_000_000, hint: "Best — only works on a fast home network." },
  { key: "remote-40", label: "Remote 40 Mbps", bitrate: 40_000_000, hint: "1080p+ over a strong remote connection." },
  { key: "remote-10", label: "Remote 10 Mbps", bitrate: 10_000_000, hint: "Safer for spotty connections; 1080p still possible." },
];

export interface PrimeSettings {
  quality: QualityKey;
}

export const DEFAULT_SETTINGS: PrimeSettings = {
  quality: "local",
};

export function loadSettings(): PrimeSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrimeSettings>;
    // Defensive: drop unrecognized keys / values rather than blowing up.
    const valid: PrimeSettings = { ...DEFAULT_SETTINGS };
    if (parsed.quality && QUALITY_OPTIONS.some((q) => q.key === parsed.quality)) {
      valid.quality = parsed.quality;
    }
    return valid;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: PrimeSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function maxBitrateFor(quality: QualityKey): number {
  const opt = QUALITY_OPTIONS.find((q) => q.key === quality);
  return opt?.bitrate ?? QUALITY_OPTIONS[0].bitrate;
}
