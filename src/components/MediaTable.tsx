import { useJellyfin } from "@/components/AuthProvider";
import type { BaseItemDto } from "@/lib/jellyfin/types";

/**
 * Spare-mode directory list — vertically-stacked rows with a small
 * poster on the left and two lines of text on the right (title + meta).
 *
 * Why two lines instead of a wide table: the row height is owned by
 * the poster (~52px), so we use that vertical space deliberately
 * instead of letting it dwarf a single 13px line of text. This is the
 * Letterboxd compact-list / Spotify track-row pattern — dense but
 * scannable, every row visually anchored by its image.
 */
export function MediaTable({
  items,
  onSelect,
  emptyMessage = "Nothing here.",
}: {
  items: BaseItemDto[];
  onSelect: (item: BaseItemDto) => void;
  emptyMessage?: string;
}) {
  const client = useJellyfin();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const tag = item.ImageTags?.Primary;
        const thumb = item.Id && tag
          ? client.imageUrl(item.Id, { type: "Primary", maxWidth: 240, tag })
          : null;
        const year = item.ProductionYear ?? null;
        const runtime = item.RunTimeTicks
          ? Math.round(item.RunTimeTicks / 600_000_000) // ticks → minutes
          : null;
        // Meta line: Genres · Year · Runtime · Rating, joined with · only
        // for entries that exist so we don't get '· · 2002 · ·'.
        const metaParts: string[] = [];
        if (item.Genres && item.Genres.length > 0) metaParts.push(item.Genres.slice(0, 2).join(" · "));
        if (year) metaParts.push(String(year));
        if (runtime) metaParts.push(`${runtime} min`);
        if (item.OfficialRating) metaParts.push(item.OfficialRating);
        return (
          <li key={item.Id ?? item.Name}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="group flex w-full items-center gap-5 border-b border-border/40 py-3 text-left transition hover:bg-accent/40"
            >
              <div className="aspect-[2/3] h-[120px] shrink-0 overflow-hidden border border-border/60 bg-muted">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="truncate text-[14px] font-medium text-foreground transition group-hover:underline group-hover:underline-offset-2">
                  {item.Name}
                </div>
                {metaParts.length > 0 ? (
                  <div className="truncate text-[12px] text-muted-foreground">
                    {metaParts.join(" · ")}
                  </div>
                ) : null}
                {item.Overview ? (
                  <div className="line-clamp-2 text-[12px] text-foreground/70">
                    {item.Overview}
                  </div>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
