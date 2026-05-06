/**
 * Tauri compatibility shim for the browser.
 *
 * Phase 1: every `@tauri-apps/*` import is redirected here so the app can boot
 * in a plain browser. All commands return empty/no-op results. Phase 3 will
 * incrementally replace these with real Jellyfin client calls.
 */

// ---------- @tauri-apps/api/core ----------

const ARRAY_RESPONSES = new Set<string>([
  "get_libraries",
  "get_people_in_library",
  "get_entries_for_person",
  "get_show_seasons",
  "get_season_episodes",
  "get_player_tracks",
  "get_playlists",
  "get_playlist_contents",
  "search_tmdb_movie",
  "search_tmdb_show",
]);

export async function invoke<T = unknown>(cmd: string, args?: unknown): Promise<T> {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[tauri-shim] invoke("${cmd}")`, args);
  }
  // Specific shapes that the UI destructures
  if (cmd === "get_entries" || cmd === "search_entries") {
    return {
      entries: [],
      sort_mode: "alpha",
      format: "video",
      selected_preset_id: null,
      presets: [],
    } as unknown as T;
  }
  if (cmd === "get_settings") return {} as T;
  if (cmd === "get_app_version") return "0.0.0-stub" as unknown as T;
  if (cmd === "check_for_update") return null as unknown as T;
  if (cmd === "check_entry_has_files") return true as unknown as T;
  if (cmd === "get_file_size") return 0 as unknown as T;
  if (cmd === "get_movie_file_path" || cmd === "get_episode_file_path") {
    return null as unknown as T;
  }
  if (ARRAY_RESPONSES.has(cmd)) return [] as unknown as T;
  if (cmd.startsWith("get_") || cmd.startsWith("search_")) {
    return [] as unknown as T;
  }
  // Mutations / unknowns: resolve with undefined
  return undefined as unknown as T;
}

export function convertFileSrc(filePath: string, _protocol = "asset"): string {
  // In a browser context there's no asset:// protocol. Return as-is so
  // <img src> at least produces a deterministic broken-image rather than throwing.
  return filePath;
}

// ---------- @tauri-apps/api/event ----------

export type UnlistenFn = () => void;

export async function listen<T = unknown>(
  _event: string,
  _handler: (payload: { payload: T }) => void
): Promise<UnlistenFn> {
  return () => {
    /* no-op */
  };
}

// ---------- @tauri-apps/api/window ----------

interface StubWindow {
  setTitle(title: string): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  setZoom(zoom: number): Promise<void>;
  innerSize(): Promise<{ width: number; height: number }>;
  onResized(handler: (...args: unknown[]) => void): Promise<UnlistenFn>;
  setDecorations(decorations: boolean): Promise<void>;
  startDragging(): Promise<void>;
}

const stubWindow: StubWindow = {
  async setTitle() {},
  async minimize() {},
  async toggleMaximize() {},
  async close() {
    window.close();
  },
  async isMaximized() {
    return false;
  },
  async isFullscreen() {
    return !!document.fullscreenElement;
  },
  async setFullscreen(fs: boolean) {
    if (fs && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else if (!fs && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  },
  async setZoom() {},
  async innerSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  },
  async onResized() {
    return () => {};
  },
  async setDecorations() {},
  async startDragging() {},
};

export function getCurrentWindow(): StubWindow {
  return stubWindow;
}

// ---------- @tauri-apps/api/webviewWindow ----------

export function getCurrentWebviewWindow(): StubWindow {
  return stubWindow;
}

// ---------- @tauri-apps/plugin-process ----------

export async function relaunch(): Promise<void> {
  window.location.reload();
}

// ---------- @tauri-apps/plugin-dialog ----------

interface OpenDialogOptions {
  multiple?: boolean;
  directory?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  title?: string;
}

export async function open(_opts?: OpenDialogOptions): Promise<string | string[] | null> {
  // In a browser we can't open native file pickers from arbitrary code.
  // Phase 1: return null (user cancelled). Library/cover dialogs that depend
  // on this are slated for removal in Phase 3 anyway.
  return null;
}

interface ConfirmOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
}

export async function confirm(message: string, _opts?: ConfirmOptions | string): Promise<boolean> {
  return window.confirm(message);
}
