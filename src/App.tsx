import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import "./App.css";
import { useNavigation } from "@/lib/nav";
import { useJellyfin } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { MainContent } from "@/components/MainContent";
import { BreadcrumbHeader } from "@/components/BreadcrumbHeader";
import type { PlaybackContext } from "@/components/player/PrimePlayer";
import type { View } from "@/types";
import type { BaseItemDto } from "@/lib/jellyfin/types";

// Lazy: PrimePlayer pulls in hls.js (~370 KB). Defer until something plays.
const PrimePlayer = lazy(() =>
  import("@/components/player/PrimePlayer").then((m) => ({ default: m.PrimePlayer })),
);

function App() {
  const nav = useNavigation();
  const client = useJellyfin();
  const [playback, setPlayback] = useState<PlaybackContext | null>(null);

  const onSidebarChange = (next: View) => nav.reset(next);
  const onContentNavigate = (next: View) => nav.navigate(next);

  // Once the home view has rendered, idle-prefetch the heavy chunks the
  // user is most likely to open next — Movies / TV grid, Live TV, the
  // player. By the time they click, the chunk is in cache and the
  // navigation is instant.
  useEffect(() => {
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (window as Window & {
            requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
          }).requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1500);
    const handle = idle(
      () => {
        // Fire-and-forget — Vite caches resolved modules so duplicate work
        // is cheap; failures are silent (we'll just hit the chunk live).
        void import("@/components/views/SearchView");
        void import("@/components/views/LiveTvView");
        void import("@/components/views/SettingsView");
        void import("@/components/player/PrimePlayer");
      },
      { timeout: 4000 },
    );
    return () => {
      const w = window as Window & {
        cancelIdleCallback?: (h: number) => void;
      };
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  /**
   * Build a PlaybackContext for any playable item, resolving nextItem when
   * we're playing an episode (so auto-advance has something to land on).
   */
  const startPlayback = useCallback(
    async (item: BaseItemDto) => {
      let nextItem: BaseItemDto | null = null;
      if (item.Type === "Episode" && item.SeriesId && item.SeasonId) {
        const seasonEps = await client.getEpisodes(item.SeriesId, item.SeasonId);
        const idx = seasonEps.findIndex((e) => e.Id === item.Id);
        if (idx >= 0 && idx + 1 < seasonEps.length) nextItem = seasonEps[idx + 1];
      }
      setPlayback({ item, nextItem });
    },
    [client]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar view={nav.current} onChange={onSidebarChange} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <BreadcrumbHeader nav={nav} />
        <div className="flex-1 overflow-hidden">
          <MainContent
            view={nav.current}
            onNavigate={onContentNavigate}
            onPlay={startPlayback}
          />
        </div>
      </main>
      {playback ? (
        <Suspense fallback={null}>
          <PrimePlayer
            ctx={playback}
            onClose={() => setPlayback(null)}
            onAdvance={(next) => void startPlayback(next)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default App;
