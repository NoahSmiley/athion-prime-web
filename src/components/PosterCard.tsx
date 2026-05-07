import { useJellyfin } from "@/components/AuthProvider";
import type { BaseItemDto } from "@/lib/jellyfin/types";

/**
 * Poster card used in every grid view. Hover treatment matches Waverunner's
 * affordance: a subtle scale + brighter ring, with the title underline tracking.
 */
export function PosterCard({
  item,
  onSelect,
  subtitle,
}: {
  item: BaseItemDto;
  onSelect: (item: BaseItemDto) => void;
  subtitle?: string | null;
}) {
  const client = useJellyfin();
  const tag = item.ImageTags?.Primary;
  const src = item.Id
    ? client.imageUrl(item.Id, { type: "Primary", maxWidth: 400, tag })
    : null;
  const sub = subtitle ?? (item.ProductionYear ? String(item.ProductionYear) : null);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col gap-2 text-left focus:outline-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden border border-border bg-muted transition duration-150 group-hover:border-foreground/60">
        {src ? (
          <img
            src={src}
            alt={item.Name ?? ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
            {item.Name?.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="px-0.5">
        <div className="line-clamp-1 text-[13px] font-medium text-foreground transition group-hover:underline group-hover:underline-offset-2">
          {item.Name}
        </div>
        {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
      </div>
    </button>
  );
}
