import { useJellyfin } from "@/components/AuthProvider";
import type { BaseItemDto } from "@/lib/jellyfin/types";

/**
 * Spare-mode directory table — mirrors the look of athion.me's
 * `.home-directory` table, but each row leads with a small (28x42)
 * poster thumb so titles are still visually recognizable. The thumb
 * is a 1px border, no shadow, native-resolution by way of maxWidth.
 *
 * Columns: thumb · title · subtitle (genres, muted) · year · runtime
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
    <table className="w-full text-[13px]">
      <tbody>
        {items.map((item) => {
          const year = item.ProductionYear ?? null;
          const runtime = item.RunTimeTicks
            ? Math.round(item.RunTimeTicks / 600_000_000) // ticks → minutes (10M ticks/sec)
            : null;
          const subtitle = (item.Genres ?? []).slice(0, 2).join(" · ") || null;
          const tag = item.ImageTags?.Primary;
          const thumb = item.Id && tag
            ? client.imageUrl(item.Id, { type: "Primary", maxWidth: 96, tag })
            : null;
          return (
            <tr
              key={item.Id ?? item.Name}
              className="group cursor-pointer border-b border-border/40 transition hover:bg-accent/40"
              onClick={() => onSelect(item)}
            >
              <td className="w-[40px] py-1.5 pr-3">
                <div className="aspect-[2/3] w-7 overflow-hidden border border-border/60 bg-muted">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </td>
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
