import { useEffect, useState } from "react";
import { Play, Clock, Star } from "lucide-react";
import { useJellyfin } from "@/components/AuthProvider";
import { SpareBackdrop } from "@/components/SpareBackdrop";
import { useTheme } from "@/lib/use-theme";
import type { BaseItemDto } from "@/lib/jellyfin/types";

const TICKS_PER_SECOND = 10_000_000;
const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;

export function SeriesDetail({
  series: initial,
  onPlay,
}: {
  series: BaseItemDto;
  onPlay: (episode: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const [theme] = useTheme();
  const [series, setSeries] = useState<BaseItemDto>(initial);
  const [seasons, setSeasons] = useState<BaseItemDto[] | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<BaseItemDto[] | null>(null);

  // Re-fetch series with full fields
  useEffect(() => {
    if (!initial.Id) return;
    let cancelled = false;
    client.getItem(initial.Id).then((full) => {
      if (!cancelled && full) setSeries(full);
    });
    return () => {
      cancelled = true;
    };
  }, [client, initial.Id]);

  // Load seasons
  useEffect(() => {
    if (!series.Id) return;
    let cancelled = false;
    client.getSeasons(series.Id).then((rows) => {
      if (cancelled) return;
      setSeasons(rows);
      const first = rows[0]?.Id ?? null;
      setActiveSeasonId(first);
    });
    return () => {
      cancelled = true;
    };
  }, [client, series.Id]);

  // Load episodes for active season
  useEffect(() => {
    if (!series.Id || !activeSeasonId) return;
    let cancelled = false;
    setEpisodes(null);
    client.getEpisodes(series.Id, activeSeasonId).then((rows) => {
      if (!cancelled) setEpisodes(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [client, series.Id, activeSeasonId]);

  const tag = series.BackdropImageTags?.[0];
  const backdrop = series.Id && tag
    ? client.imageUrl(series.Id, { type: "Backdrop" as never, maxWidth: 1920, tag })
    : null;

  const posterTag = series.ImageTags?.Primary;
  const poster = series.Id && posterTag
    ? client.imageUrl(series.Id, { type: "Primary" as never, maxWidth: 600, tag: posterTag })
    : null;

  // Pick the next-up episode: lowest-indexed unwatched, or first
  const nextUp = pickNextEpisode(episodes ?? []);

  if (theme === "spare") {
    return (
      <SpareSeriesDetail
        series={series}
        backdrop={backdrop}
        poster={poster}
        seasons={seasons}
        activeSeasonId={activeSeasonId}
        onChangeSeason={setActiveSeasonId}
        episodes={episodes}
        nextUp={nextUp}
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
        <h1 className="text-3xl font-medium text-foreground">{series.Name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.ProductionYear ? <span>{series.ProductionYear}</span> : null}
          {series.OfficialRating ? <span>{series.OfficialRating}</span> : null}
          {series.CommunityRating ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-[#ffd700]" /> {series.CommunityRating.toFixed(1)}
            </span>
          ) : null}
          {series.Genres && series.Genres.length > 0 ? (
            <span>{series.Genres.slice(0, 4).join(" · ")}</span>
          ) : null}
        </div>

        {nextUp ? (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay(nextUp)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              <Play className="h-4 w-4 fill-black" />
              {nextUp.UserData?.PlaybackPositionTicks
                ? `Resume S${nextUp.ParentIndexNumber}E${nextUp.IndexNumber}`
                : `Play S${nextUp.ParentIndexNumber}E${nextUp.IndexNumber}`}
            </button>
            <span className="text-xs text-muted-foreground">{nextUp.Name}</span>
          </div>
        ) : null}

        {series.Overview ? (
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/80">
            {series.Overview}
          </p>
        ) : null}

        {/* Season tabs */}
        {seasons && seasons.length > 0 ? (
          <div className="mt-10">
            <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
              {seasons.map((s) => {
                const active = s.Id === activeSeasonId;
                return (
                  <button
                    key={s.Id}
                    onClick={() => s.Id && setActiveSeasonId(s.Id)}
                    className={[
                      "border-b-2 px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {s.Name}
                  </button>
                );
              })}
            </div>

            <ul className="space-y-2">
              {episodes === null ? (
                <li className="text-sm text-muted-foreground">Loading episodes…</li>
              ) : episodes.length === 0 ? (
                <li className="text-sm text-muted-foreground">No episodes in this season.</li>
              ) : (
                episodes.map((ep) => <EpisodeRow key={ep.Id} episode={ep} onPlay={onPlay} />)
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EpisodeRow({
  episode,
  onPlay,
}: {
  episode: BaseItemDto;
  onPlay: (item: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const tag = episode.ImageTags?.Primary;
  const thumb = episode.Id
    ? client.imageUrl(episode.Id, { type: "Primary" as never, maxWidth: 320, tag })
    : null;
  const runtimeMin = episode.RunTimeTicks
    ? Math.round(episode.RunTimeTicks / TICKS_PER_MINUTE)
    : null;
  const playedPct = episode.UserData?.PlayedPercentage ?? 0;
  const watched = episode.UserData?.Played ?? false;

  return (
    <li>
      <button
        type="button"
        onClick={() => onPlay(episode)}
        className="group flex w-full items-start gap-4 rounded-md border border-border bg-card/40 p-3 text-left transition-colors hover:bg-accent"
      >
        <div className="relative aspect-video w-40 flex-shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : null}
          {playedPct > 0 && playedPct < 100 ? (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/30">
              <div className="h-full bg-white" style={{ width: `${playedPct}%` }} />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">
              S{episode.ParentIndexNumber}E{episode.IndexNumber}
            </span>
            <span className="truncate text-sm font-medium text-foreground">{episode.Name}</span>
            {watched ? (
              <span className="text-xs text-[#4cc434]">✓</span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            {runtimeMin ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {runtimeMin}m
              </span>
            ) : null}
            {episode.PremiereDate ? (
              <span>{new Date(episode.PremiereDate).toLocaleDateString()}</span>
            ) : null}
          </div>
          {episode.Overview ? (
            <p className="mt-2 line-clamp-2 text-xs text-foreground/70">{episode.Overview}</p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/**
 * Pick the next episode the user should watch:
 *   1. If any episode has a resume position (>0% but <100%), play that.
 *   2. Else first unwatched episode.
 *   3. Else first episode.
 */
function pickNextEpisode(episodes: BaseItemDto[]): BaseItemDto | null {
  if (episodes.length === 0) return null;
  const resumable = episodes.find((e) => {
    const pct = e.UserData?.PlayedPercentage ?? 0;
    return pct > 0 && pct < 100;
  });
  if (resumable) return resumable;
  const unwatched = episodes.find((e) => !e.UserData?.Played);
  return unwatched ?? episodes[0];
}

/**
 * Spare-mode series view: faint backdrop wash up top, poster floated as
 * a `<figure>` so the overview wraps around it, season switcher as a
 * thin text row, episodes rendered as a directory table.
 */
function SpareSeriesDetail({
  series,
  backdrop,
  poster,
  seasons,
  activeSeasonId,
  onChangeSeason,
  episodes,
  nextUp,
  onPlay,
}: {
  series: BaseItemDto;
  backdrop: string | null;
  poster: string | null;
  seasons: BaseItemDto[] | null;
  activeSeasonId: string | null;
  onChangeSeason: (id: string) => void;
  episodes: BaseItemDto[] | null;
  nextUp: BaseItemDto | null;
  onPlay: (episode: BaseItemDto) => void;
}) {
  const meta: string[] = [];
  if (series.ProductionYear) meta.push(String(series.ProductionYear));
  if (series.OfficialRating) meta.push(series.OfficialRating);
  if (series.CommunityRating) meta.push(`★ ${series.CommunityRating.toFixed(1)}`);
  if (series.Genres && series.Genres.length > 0) meta.push(series.Genres.slice(0, 4).join(" · "));

  return (
    <div className="h-full overflow-auto">
      <article className="mx-auto flex max-w-[700px] flex-col gap-5 pt-8 pb-12 text-[13px]">
        {backdrop ? <SpareBackdrop src={backdrop} /> : null}
        <header className="flex flex-col gap-2">
          <h1 className="text-[18px] font-medium text-foreground">{series.Name}</h1>
          {meta.length > 0 ? (
            <div className="text-[11px] text-muted-foreground">{meta.join(" · ")}</div>
          ) : null}
        </header>

        {nextUp ? (
          <div>
            <button
              type="button"
              onClick={() => onPlay(nextUp)}
              className="border border-foreground/60 px-4 py-1.5 text-foreground transition hover:bg-accent"
            >
              {nextUp.UserData?.PlaybackPositionTicks
                ? `Resume · S${nextUp.ParentIndexNumber}E${nextUp.IndexNumber} ${nextUp.Name ?? ""}`
                : `Play · S${nextUp.ParentIndexNumber}E${nextUp.IndexNumber} ${nextUp.Name ?? ""}`}
            </button>
          </div>
        ) : null}

        {series.Overview || poster ? (
          <div className="overflow-hidden">
            {poster ? (
              <figure className="float-left mb-2 mr-5">
                <img
                  src={poster}
                  alt={series.Name ?? ""}
                  className="w-32 border border-border sm:w-36"
                />
              </figure>
            ) : null}
            {series.Overview ? (
              <p className="text-foreground/80 leading-relaxed">{series.Overview}</p>
            ) : null}
          </div>
        ) : null}

        {seasons && seasons.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/40 py-3 text-[12px]">
            {seasons.map((s) => {
              const id = s.Id ?? "";
              const isActive = id === activeSeasonId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeSeason(id)}
                  className={isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
                >
                  {s.Name ?? `Season ${s.IndexNumber ?? "?"}`}
                </button>
              );
            })}
          </div>
        ) : null}

        {episodes === null ? (
          <p className="text-muted-foreground">Loading episodes…</p>
        ) : episodes.length === 0 ? (
          <p className="text-muted-foreground">No episodes.</p>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {episodes.map((e) => {
                const pct = e.UserData?.PlayedPercentage ?? 0;
                const partial = pct > 0 && pct < 100;
                const watched = e.UserData?.Played;
                return (
                  <tr
                    key={e.Id ?? e.Name}
                    onClick={() => onPlay(e)}
                    className="cursor-pointer border-b border-border/40 transition hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap py-2 pr-3 text-[11px] text-muted-foreground">
                      {e.IndexNumber != null ? String(e.IndexNumber).padStart(2, "0") : "—"}
                    </td>
                    <td className="w-full py-2 pr-3 text-foreground">
                      {e.Name ?? "—"}
                      {partial ? (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {Math.round(pct)}%
                        </span>
                      ) : watched ? (
                        <span className="ml-2 text-[11px] text-muted-foreground">watched</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
