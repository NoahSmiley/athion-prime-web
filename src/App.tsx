import { useCallback, useState } from "react";
import "./App.css";
import { useNavigation } from "@/lib/nav";
import { useJellyfin } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { MainContent } from "@/components/MainContent";
import { BreadcrumbHeader } from "@/components/BreadcrumbHeader";
import { PrimePlayer, type PlaybackContext } from "@/components/player/PrimePlayer";
import type { View } from "@/types";
import type { BaseItemDto } from "@/lib/jellyfin/types";

function App() {
  const nav = useNavigation();
  const client = useJellyfin();
  const [playback, setPlayback] = useState<PlaybackContext | null>(null);

  const onSidebarChange = (next: View) => nav.reset(next);
  const onContentNavigate = (next: View) => nav.navigate(next);

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
        <PrimePlayer
          ctx={playback}
          onClose={() => setPlayback(null)}
          onAdvance={(next) => void startPlayback(next)}
        />
      ) : null}
    </div>
  );
}

export default App;
