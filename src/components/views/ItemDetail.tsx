import { useEffect, useState } from "react";
import { Play, Clock, Star } from "lucide-react";
import { useJellyfin } from "@/components/AuthProvider";
import { SpareBackdrop } from "@/components/SpareBackdrop";
import { useTheme } from "@/lib/use-theme";
import type { BaseItemDto } from "@/lib/jellyfin/types";

const TICKS_PER_SECOND = 10_000_000;
const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;

export function ItemDetail({
  item: initial,
  onPlay,
}: {
  item: BaseItemDto;
  onPlay: (item: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const [theme] = useTheme();
  // Re-fetch with full fields (cast/chapters etc.) — getItems() only returns a thin slice.
  const [item, setItem] = useState<BaseItemDto>(initial);
  useEffect(() => {
    if (!initial.Id) return;
    let cancelled = false;
    client.getItem(initial.Id).then((full) => {
      if (!cancelled && full) setItem(full);
    });
    return () => {
      cancelled = true;
    };
  }, [client, initial.Id]);

  const tag = item.BackdropImageTags?.[0];
  const backdrop = item.Id && tag
    ? client.imageUrl(item.Id, { type: "Backdrop" as never, maxWidth: 1920, tag })
    : null;

  const posterTag = item.ImageTags?.Primary;
  const poster = item.Id
    ? client.imageUrl(item.Id, { type: "Primary" as never, maxWidth: 600, tag: posterTag })
    : null;

  const runtimeMin = item.RunTimeTicks
    ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE)
    : null;
  const cast = item.People?.filter((p) => p.Type === "Actor").slice(0, 8) ?? [];
  const directors = item.People?.filter((p) => p.Type === "Director").map((p) => p.Name).filter(Boolean) ?? [];
  const writers = item.People?.filter((p) => p.Type === "Writer").map((p) => p.Name).filter(Boolean) ?? [];
  const resumePct = item.UserData?.PlayedPercentage;

  if (theme === "spare") {
    return (
      <SpareItemDetail
        item={item}
        backdrop={backdrop}
        runtimeMin={runtimeMin}
        directors={directors.filter((d): d is string => !!d)}
        writers={writers.filter((w): w is string => !!w)}
        cast={cast}
        resumePct={resumePct ?? undefined}
        onPlay={onPlay}
      />
    );
  }

  return (
    <div className="relative h-full overflow-auto">
      {backdrop ? (
        <div
          className="absolute inset-x-0 top-0 h-[50vh] bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[50vh] bg-gradient-to-b from-transparent via-background/60 to-background"
      />

      <div className="relative px-10 pb-12 pt-12">
        <div className="flex flex-col gap-8 lg:flex-row">
          {poster ? (
            <div className="flex-shrink-0">
              <img
                src={poster}
                alt={item.Name ?? ""}
                className="h-auto w-56 rounded-md ring-1 ring-border"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-medium text-foreground">{item.Name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {item.ProductionYear ? <span>{item.ProductionYear}</span> : null}
              {runtimeMin ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatRuntime(runtimeMin)}
                </span>
              ) : null}
              {item.OfficialRating ? <span>{item.OfficialRating}</span> : null}
              {item.CommunityRating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 text-[#ffd700]" /> {item.CommunityRating.toFixed(1)}
                </span>
              ) : null}
              {item.Genres && item.Genres.length > 0 ? (
                <span>{item.Genres.slice(0, 4).join(" · ")}</span>
              ) : null}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onPlay(item)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                <Play className="h-4 w-4 fill-black" />
                {resumePct != null && resumePct > 0 && resumePct < 100 ? "Resume" : "Play"}
              </button>
              {resumePct != null && resumePct > 0 && resumePct < 100 ? (
                <div className="text-xs text-muted-foreground">
                  {Math.round(resumePct)}% watched
                </div>
              ) : null}
            </div>

            {item.Overview ? (
              <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/80">
                {item.Overview}
              </p>
            ) : null}

            {(directors.length > 0 || writers.length > 0) ? (
              <dl className="mt-6 grid max-w-3xl grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-xs">
                {directors.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Director</dt>
                    <dd className="text-foreground/80">{directors.join(", ")}</dd>
                  </>
                ) : null}
                {writers.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Writer</dt>
                    <dd className="text-foreground/80">{writers.join(", ")}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            {cast.length > 0 ? (
              <div className="mt-8">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cast
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {cast.map((p) => {
                    const portrait = p.Id
                      ? client.imageUrl(p.Id, { type: "Primary" as never, maxWidth: 200, tag: p.PrimaryImageTag ?? undefined })
                      : null;
                    return (
                      <div key={p.Id ?? p.Name} className="flex items-center gap-2">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                          {portrait ? (
                            <img
                              src={portrait}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-foreground">
                            {p.Name}
                          </div>
                          {p.Role ? (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {p.Role}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Spare-mode detail layout — narrow column with a faint top backdrop
 * wash, a poster floated as a `<figure>` so the overview text wraps
 * around it like a newspaper article. Matches athion.me's article-page
 * vibe while still showing media context.
 */
function SpareItemDetail({
  item,
  backdrop,
  runtimeMin,
  directors,
  writers,
  cast,
  resumePct,
  onPlay,
}: {
  item: BaseItemDto;
  backdrop: string | null;
  runtimeMin: number | null;
  directors: string[];
  writers: string[];
  cast: { Id?: string | null; Name?: string | null; Role?: string | null }[];
  resumePct: number | undefined;
  onPlay: (item: BaseItemDto) => void;
}) {
  const meta: string[] = [];
  if (item.ProductionYear) meta.push(String(item.ProductionYear));
  if (runtimeMin) meta.push(formatRuntime(runtimeMin));
  if (item.OfficialRating) meta.push(item.OfficialRating);
  if (item.CommunityRating) meta.push(`★ ${item.CommunityRating.toFixed(1)}`);
  if (item.Genres && item.Genres.length > 0) meta.push(item.Genres.slice(0, 4).join(" · "));
  const isResume = resumePct != null && resumePct > 0 && resumePct < 100;

  return (
    <div className="h-full overflow-auto">
      <article className="mx-auto flex max-w-[700px] flex-col gap-6 pt-8 pb-12 text-[13px]">
        {/* Hero band first — sized inside the column. Pulled tight to
            the nav so the eye lands on something immediately instead
            of a slab of black. */}
        {backdrop ? <SpareBackdrop src={backdrop} /> : null}

        {/* Title row owns the page weight: large title on the left,
            Play button on the right, meta beneath. The button is the
            primary action — placing it here removes the standalone
            stripe that used to sit between hero and overview. */}
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="flex-1 text-[26px] font-semibold leading-tight text-foreground">
              {item.Name}
            </h1>
            <button
              type="button"
              onClick={() => onPlay(item)}
              className="shrink-0 border border-foreground/60 px-5 py-2 text-[13px] font-medium text-foreground transition hover:bg-accent"
            >
              {isResume ? `Resume · ${Math.round(resumePct ?? 0)}%` : "Play"}
            </button>
          </div>
          {meta.length > 0 ? (
            <div className="text-[12px] text-muted-foreground">{meta.join(" · ")}</div>
          ) : null}
        </header>

        {item.Overview ? (
          <p className="text-[14px] leading-relaxed text-foreground/85">{item.Overview}</p>
        ) : null}

        {/* Inline credits paragraph — Director/Writer/Cast as one
            running text block rather than a labeled fact-sheet table.
            Reads like a film page, not a database record. */}
        {(directors.length > 0 || writers.length > 0 || cast.length > 0) ? (
          <div className="border-t border-border/40 pt-4 text-[12px] leading-relaxed text-muted-foreground">
            {directors.length > 0 ? (
              <p>
                <span className="text-foreground/80">Directed by</span>{" "}
                {directors.join(", ")}.
              </p>
            ) : null}
            {writers.length > 0 ? (
              <p>
                <span className="text-foreground/80">Written by</span>{" "}
                {writers.join(", ")}.
              </p>
            ) : null}
            {cast.length > 0 ? (
              <p>
                <span className="text-foreground/80">Starring</span>{" "}
                {cast.map((p) => p.Name).filter(Boolean).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
      </article>
    </div>
  );
}
