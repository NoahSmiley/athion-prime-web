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
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-border transition duration-200 group-hover:ring-2 group-hover:ring-foreground/60 group-hover:shadow-lg group-hover:shadow-black/40">
        {src ? (
          <img
            src={src}
            alt={item.Name ?? ""}
            loading="lazy"
            className="h-full w-full scale-100 object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
            {item.Name?.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="px-0.5">
        <div className="line-clamp-1 text-sm font-medium text-foreground transition group-hover:underline group-hover:underline-offset-2">
          {item.Name}
        </div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </div>
    </button>
  );
}
