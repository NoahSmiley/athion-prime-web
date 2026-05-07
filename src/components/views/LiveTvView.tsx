import { useEffect, useMemo, useRef, useState } from "react";
import { xtream, type XtreamCategory, type XtreamEPGEntry, type XtreamStream } from "@/lib/xtream/client";

/** Section ordering + keyword mapping mirrors tvOS Athion Prime. */
const SECTION_ORDER: { name: string; keywords: string[] }[] = [
  { name: "Entertainment", keywords: ["ENTERTAINMENT"] },
  { name: "Sports", keywords: ["SPORTS"] },
  { name: "News", keywords: ["NEWS"] },
  { name: "Kids", keywords: ["KIDS"] },
  { name: "Movies", keywords: ["MOVIES"] },
  { name: "Music", keywords: ["MUSIC"] },
  { name: "Lifestyle", keywords: ["SPECTRUM", "PEACOCK", "PRIME", "DIREC"] },
  { name: "4K Ultra HD", keywords: ["4K"] },
];

type Section = { name: string; categoryIds: string[] };

/**
 * Live TV view — section sidebar + channel grid + overlay player.
 * Sections are derived from Xtream's category list using the same keyword
 * heuristic as tvOS, so the SPA matches the Apple TV experience.
 */
export function LiveTvView() {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [streamsBySection, setStreamsBySection] = useState<Record<string, XtreamStream[]>>({});
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<XtreamStream | null>(null);
  const [search, setSearch] = useState("");

  // Initial: fetch categories, group into sections, pick the first section.
  useEffect(() => {
    let cancelled = false;
    xtream
      .getCategories()
      .then((cats) => {
        if (cancelled) return;
        const built = buildSections(cats);
        setSections(built);
        if (built.length > 0) setActiveSection(built[0].name);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever the active section changes, fetch its streams (if not cached).
  useEffect(() => {
    if (!activeSection || !sections) return;
    if (streamsBySection[activeSection]) return; // already loaded
    const section = sections.find((s) => s.name === activeSection);
    if (!section) return;

    let cancelled = false;
    setLoadingStreams(true);
    // Fetch each category independently — one upstream flake shouldn't
    // take down the whole section. allSettled means we get whatever did
    // load even if a category times out or 503s.
    Promise.allSettled(section.categoryIds.map((id) => xtream.getLiveStreams(id)))
      .then((results) => {
        if (cancelled) return;
        const failures: string[] = [];
        const ok: XtreamStream[] = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            ok.push(...r.value);
          } else {
            failures.push(section.categoryIds[i]);
          }
        });
        if (failures.length) {
          // eslint-disable-next-line no-console
          console.warn(`[live-tv] dropped ${failures.length} failed categor${failures.length === 1 ? "y" : "ies"}: ${failures.join(", ")}`);
        }
        // Some Xtream providers emit divider rows like "##### NAME #####" as
        // fake channels for visual grouping in legacy clients. Strip them.
        const filtered = ok.filter((s) => !/^#+\s/.test(s.name));
        const all = dedupeByName(filtered);
        setStreamsBySection((prev) => ({ ...prev, [activeSection]: all }));
        setLoadingStreams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, sections, streamsBySection]);

  const visibleStreams = useMemo(() => {
    if (!activeSection) return [];
    const list = streamsBySection[activeSection] ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [activeSection, streamsBySection, search]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center">
        <div className="max-w-md">
          <h2 className="mb-2 text-base font-medium text-foreground">Couldn't load Live TV</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (sections === null) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">Loading channels…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-end justify-between gap-4 border-b border-border px-8 py-5">
        <div>
          <h1 className="text-xl font-medium text-foreground">Live TV</h1>
          <p className="text-xs text-muted-foreground">
            {activeSection ?? "—"}
            {visibleStreams.length > 0 ? ` · ${visibleStreams.length} channel${visibleStreams.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels…"
          className="w-72 rounded-md border border-border bg-card/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/60"
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Section list */}
        <nav className="w-44 shrink-0 overflow-auto border-r border-border py-4">
          <ul className="flex flex-col">
            {sections.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => setActiveSection(s.name)}
                  className={`block w-full px-6 py-2 text-left text-sm transition ${
                    activeSection === s.name
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Channel grid */}
        <div className="flex-1 overflow-auto p-6">
          {loadingStreams ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-video animate-pulse rounded-md bg-muted/50" />
              ))}
            </div>
          ) : visibleStreams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.trim() ? `No channels match "${search.trim()}".` : "No channels in this section."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleStreams.map((s) => (
                <ChannelCard key={s.stream_id} stream={s} onSelect={setPlaying} />
              ))}
            </div>
          )}
        </div>
      </div>

      {playing && <ChannelPlayer stream={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/**
 * Maps Xtream categories into our 8-section model. A category goes into the
 * first section whose keyword appears in its uppercased name.
 */
function buildSections(categories: XtreamCategory[]): Section[] {
  const sections: Section[] = SECTION_ORDER.map((s) => ({ name: s.name, categoryIds: [] }));
  for (const cat of categories) {
    const upper = cat.category_name.toUpperCase();
    for (let i = 0; i < SECTION_ORDER.length; i++) {
      if (SECTION_ORDER[i].keywords.some((kw) => upper.includes(kw))) {
        sections[i].categoryIds.push(cat.category_id);
        break;
      }
    }
  }
  return sections.filter((s) => s.categoryIds.length > 0);
}

function dedupeByName(streams: XtreamStream[]): XtreamStream[] {
  const seen = new Set<string>();
  const out: XtreamStream[] = [];
  for (const s of streams) {
    const key = s.name.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Tiny in-process EPG fetcher: caps concurrency at MAX_INFLIGHT so we don't
 * fire 400+ requests when a section first opens. FIFO queue, deduped per
 * stream id so cards remounted on scroll don't refetch.
 */
const MAX_INFLIGHT = 6;
const epgCache = new Map<number, XtreamEPGEntry | null>();
const epgPending = new Map<number, Promise<XtreamEPGEntry | null>>();
const epgQueue: Array<() => void> = [];
let epgInflight = 0;

function pumpQueue() {
  while (epgInflight < MAX_INFLIGHT && epgQueue.length > 0) {
    const next = epgQueue.shift();
    next?.();
  }
}

function fetchCurrentEPG(streamId: number): Promise<XtreamEPGEntry | null> {
  if (epgCache.has(streamId)) return Promise.resolve(epgCache.get(streamId) ?? null);
  const existing = epgPending.get(streamId);
  if (existing) return existing;

  const p = new Promise<XtreamEPGEntry | null>((resolve) => {
    const run = async () => {
      epgInflight++;
      try {
        const entries = await xtream.getEPG(streamId);
        const now = Date.now();
        const current = entries.find((e) => {
          const start = parseUtcXtream(e.start);
          const end = parseUtcXtream(e.end);
          if (!start || !end) return false;
          return now >= start && now < end;
        }) ?? null;
        epgCache.set(streamId, current);
        resolve(current);
      } catch {
        epgCache.set(streamId, null);
        resolve(null);
      } finally {
        epgInflight--;
        epgPending.delete(streamId);
        pumpQueue();
      }
    };
    epgQueue.push(run);
    pumpQueue();
  });
  epgPending.set(streamId, p);
  return p;
}

/**
 * Single channel card — logo (or letter fallback) + name + current EPG title.
 * EPG is fetched lazily, only when the card scrolls into view, capped to
 * MAX_INFLIGHT in-flight requests so we don't slam the proxy.
 */
function ChannelCard({ stream, onSelect }: { stream: XtreamStream; onSelect: (s: XtreamStream) => void }) {
  const [epg, setEpg] = useState<XtreamEPGEntry | null>(epgCache.get(stream.stream_id) ?? null);
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (epgCache.has(stream.stream_id)) return; // already resolved
    const node = cardRef.current;
    if (!node) return;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      let cancelled = false;
      fetchCurrentEPG(stream.stream_id).then((current) => {
        if (!cancelled) setEpg(current);
      });
      return () => {
        cancelled = true;
      };
    };

    if (typeof IntersectionObserver === "undefined") {
      // Safety net: trigger immediately if IO isn't available.
      start();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            start();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [stream.stream_id]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelect(stream)}
      className="group flex flex-col gap-2 text-left focus:outline-none"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted ring-1 ring-border transition duration-200 group-hover:ring-2 group-hover:ring-foreground/60">
        {stream.stream_icon ? (
          <img
            src={stream.stream_icon}
            alt={stream.name}
            loading="lazy"
            className="h-full w-full object-contain p-3"
            // Some logos 404; just hide on error.
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
            {stream.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <div className="px-0.5">
        <div className="line-clamp-1 text-sm font-medium text-foreground transition group-hover:underline group-hover:underline-offset-2">
          {stream.name}
        </div>
        <div className="line-clamp-1 text-xs text-muted-foreground">
          {epg ? epg.title : "—"}
        </div>
      </div>
    </button>
  );
}

/** Xtream EPG timestamps are `YYYY-MM-DD HH:MM:SS` UTC. Returns ms since epoch or null. */
function parseUtcXtream(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/**
 * Fullscreen channel player. Live HLS via hls.js (or native on Safari).
 * No progress reporting — these are live streams, not Jellyfin items.
 */
function ChannelPlayer({ stream, onClose }: { stream: XtreamStream; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy(): void } | null = null;
    let cancelled = false;

    const url = xtream.playUrl(stream.stream_id);

    (async () => {
      const HlsModule = (await import("hls.js")).default;
      if (cancelled) return;
      if (HlsModule.isSupported()) {
        const h = new HlsModule({ enableWorker: true, lowLatencyMode: true });
        h.loadSource(url);
        h.attachMedia(video);
        h.on(HlsModule.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            setError(`Playback error: ${data.type} / ${data.details}`);
          }
        });
        hls = h;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else {
        setError("This browser doesn't support HLS playback.");
        return;
      }
      video.play().catch(() => {});
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      hls?.destroy();
      video.pause();
      video.src = "";
    };
  }, [stream.stream_id, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-6 py-3 text-foreground">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{stream.name}</span>
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Close
        </button>
      </div>
      <div className="relative flex-1">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="h-full w-full bg-black"
        />
        {error ? (
          <div className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded bg-destructive/90 px-4 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
