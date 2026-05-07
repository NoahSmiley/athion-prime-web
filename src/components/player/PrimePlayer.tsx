import { useEffect, useRef, useState, useMemo } from "react";
import Hls from "hls.js";
import { ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import { useJellyfin } from "@/components/AuthProvider";
import type { BaseItemDto, ChapterInfo } from "@/lib/jellyfin/types";
import { loadSettings, maxBitrateFor } from "@/lib/settings";

const TICKS_PER_SECOND = 10_000_000;
const PROGRESS_INTERVAL_MS = 5000;

export interface PlaybackContext {
  /** Item being played. Source of truth for ID, runtime, chapters, resume. */
  item: BaseItemDto;
  /** Optional next item to auto-advance to when this one ends (e.g. next episode). */
  nextItem?: BaseItemDto | null;
}

export function PrimePlayer({
  ctx,
  onClose,
  onAdvance,
}: {
  ctx: PlaybackContext;
  onClose: () => void;
  onAdvance: (next: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemId = ctx.item.Id ?? "";
  const startPositionTicks = ctx.item.UserData?.PlaybackPositionTicks ?? 0;
  const chapters = ctx.item.Chapters ?? [];
  const [url, setUrl] = useState<string | null>(null);
  // If hls.js fires an incompatible-codec error, force an h264 retry by
  // bumping this — getPlaybackUrl() then asks Jellyfin for an h264 transcode.
  const [forceH264, setForceH264] = useState(false);

  // Resolve the playback URL via PlaybackInfo, capping bitrate by the user's
  // Settings preference (Local 4K Remux / Remote 40 Mbps / Remote 10 Mbps).
  // forceH264 retries are not subject to the cap — the retry uses
  // getPlaybackUrl's own 1080p ceiling for safety.
  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setUrl(null);
    const maxBitrate = maxBitrateFor(loadSettings().quality);
    const opts = forceH264 ? { forceH264: true } : { maxBitrate };
    client
      .getPlaybackUrl(itemId, opts)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [client, itemId, forceH264]);

  // Source-of-truth: which chapter are we currently in?
  const activeChapter = useMemo(() => classifyActiveChapter(chapters, currentTime), [chapters, currentTime]);

  // Mount: wire hls.js + native fallback, attach event listeners, resume.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        // Codec incompatibility — typically HEVC manifested when the browser
        // can't decode it. Re-fetch with forceH264 to get a transcode.
        if (
          data.fatal &&
          (data.details === "manifestIncompatibleCodecsError" ||
            data.details === "bufferIncompatibleCodecsError")
        ) {
          if (!forceH264) {
            // eslint-disable-next-line no-console
            console.warn("[player] codec mismatch, retrying with h264-only profile");
            setForceH264(true);
            return;
          }
        }
        if (data.fatal) {
          setError(`Playback error: ${data.type} / ${data.details}`);
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari has native HLS
      video.src = url;
    } else {
      setError("This browser doesn't support HLS playback.");
      return;
    }

    const onLoaded = () => {
      setDuration(video.duration);
      if (startPositionTicks > 0) {
        video.currentTime = startPositionTicks / TICKS_PER_SECOND;
      }
      void video.play().catch(() => {});
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onEnded = () => {
      if (ctx.nextItem) onAdvance(ctx.nextItem);
      else onClose();
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, startPositionTicks, ctx.nextItem, onAdvance, onClose]);

  // Playback reporting: start on mount, progress every 5s, stopped on unmount.
  useEffect(() => {
    if (!itemId) return;
    let stopped = false;
    let interval: number | null = null;

    void client.reportPlaybackStart(itemId, startPositionTicks);

    interval = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const ticks = Math.round(v.currentTime * TICKS_PER_SECOND);
      void client.reportPlaybackProgress(itemId, ticks, v.paused);
    }, PROGRESS_INTERVAL_MS);

    return () => {
      stopped = true;
      if (interval !== null) window.clearInterval(interval);
      const v = videoRef.current;
      const ticks = v ? Math.round(v.currentTime * TICKS_PER_SECOND) : 0;
      void client.reportPlaybackStopped(itemId, ticks);
      void stopped;
    };
  }, [client, itemId, startPositionTicks]);

  // Fullscreen sync (Esc key etc. fires fullscreenchange)
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Esc to close (when not in fullscreen — fullscreen exits on Esc first)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        v.paused ? void v.play() : v.pause();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await videoRef.current?.parentElement?.requestFullscreen().catch(() => {});
    }
  };

  const skipChapter = () => {
    if (!activeChapter) return;
    const v = videoRef.current;
    if (!v) return;
    if (activeChapter.kind === "intro" && activeChapter.endSec) {
      v.currentTime = activeChapter.endSec;
    } else if (activeChapter.kind === "outro" && ctx.nextItem) {
      onAdvance(ctx.nextItem);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  const skipLabel =
    activeChapter?.kind === "intro"
      ? "Skip Intro"
      : activeChapter?.kind === "outro" && ctx.nextItem
      ? `Next Episode: ${ctx.nextItem.Name ?? ""}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        playsInline
        autoPlay
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-6 py-3 text-foreground">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{ctx.item.Name}</div>
          {ctx.item.SeriesName ? (
            <div className="truncate text-xs text-muted-foreground">
              {ctx.item.SeriesName} · S{ctx.item.ParentIndexNumber}E{ctx.item.IndexNumber}
            </div>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
          title="Close (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Skip Intro / Next Episode floating button (bottom-right above controls) */}
      {skipLabel ? (
        <div className="relative z-10 flex justify-end px-6 pb-3">
          <button
            onClick={skipChapter}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-lg hover:bg-white/90"
          >
            {skipLabel}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Bottom bar */}
      <div className="relative z-10 flex flex-col gap-2 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
        {/* Scrubber */}
        <div
          className="group relative h-1 cursor-pointer rounded-full bg-white/20"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-white/80">
          <button
            onClick={togglePlay}
            className="rounded p-1 hover:bg-white/10"
            title={paused ? "Play (Space)" : "Pause (Space)"}
          >
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <span className="font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button
            onClick={toggleFullscreen}
            className="rounded p-1 hover:bg-white/10"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6 text-center">
          <div className="max-w-md">
            <p className="mb-2 text-sm font-medium text-white">Playback failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded bg-white/10 px-4 py-1.5 text-xs hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ActiveChapter {
  kind: "intro" | "outro" | "other";
  endSec?: number;
}

/**
 * Mirrors tvOS Prime's chapter classification: chapters whose name contains
 * "intro" trigger Skip Intro; "credit"/"end"/"outro" trigger Next Episode.
 */
function classifyActiveChapter(
  chapters: ChapterInfo[],
  currentTimeSec: number
): ActiveChapter | null {
  if (chapters.length === 0) return null;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const startSec = (ch.StartPositionTicks ?? 0) / TICKS_PER_SECOND;
    const next = chapters[i + 1];
    const endSec = next
      ? (next.StartPositionTicks ?? 0) / TICKS_PER_SECOND
      : Number.POSITIVE_INFINITY;
    if (currentTimeSec < startSec || currentTimeSec >= endSec) continue;
    const name = (ch.Name ?? "").toLowerCase();
    if (name.includes("intro") || name.includes("opening")) {
      return { kind: "intro", endSec: isFinite(endSec) ? endSec : undefined };
    }
    if (name.includes("credit") || name.includes("outro") || name.includes("end")) {
      return { kind: "outro" };
    }
    return { kind: "other" };
  }
  return null;
}
