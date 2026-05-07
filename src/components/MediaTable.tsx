import type { BaseItemDto } from "@/lib/jellyfin/types";

/**
 * Spare-mode directory table — mirrors the look of athion.me's
 * `.home-directory` table. Used wherever Hybrid would show a
 * PosterCard grid: search results, library views, home rows, etc.
 *
 * Columns: title (white) · subtitle (muted, e.g. genres) · year · runtime
 * Rows are full-width buttons; clicking calls onSelect.
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
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {items.map((item) => {
          const year = item.ProductionYear ?? null;
          const runtime = item.RunTimeTicks
            ? Math.round(item.RunTimeTicks / 600_000_000) // ticks → minutes (10M ticks/sec)
            : null;
          const subtitle = (item.Genres ?? []).slice(0, 2).join(" · ") || null;
          return (
            <tr
              key={item.Id ?? item.Name}
              className="cursor-pointer border-b border-border/40 transition hover:bg-accent/40"
              onClick={() => onSelect(item)}
            >
              <td className="whitespace-nowrap py-2 pr-4 font-medium text-foreground">
                {item.Name}
              </td>
              <td className="w-full py-2 pr-4 text-muted-foreground">
                {subtitle}
              </td>
              <td className="whitespace-nowrap py-2 pr-4 text-[11px] text-muted-foreground">
                {year ?? ""}
              </td>
              <td className="whitespace-nowrap py-2 text-[11px] text-muted-foreground">
                {runtime ? `${runtime} min` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
