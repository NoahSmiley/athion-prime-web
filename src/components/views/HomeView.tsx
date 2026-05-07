import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useJellyfin } from "@/components/AuthProvider";
import { PosterCard } from "@/components/PosterCard";
import { MediaTable } from "@/components/MediaTable";
import { useTheme } from "@/lib/use-theme";
import type { BaseItemDto, BaseItemKind } from "@/lib/jellyfin/types";
import type { View } from "@/types";

type RowFetcher = () => Promise<BaseItemDto[]>;

/**
 * Home view — horizontally-scrolling rows mirroring the tvOS Prime layout.
 * Each row loads independently; failures are isolated to that row.
 */
export function HomeView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const client = useJellyfin();

  const select = (item: BaseItemDto) => {
    onNavigate(item.Type === "Series" ? { kind: "series", series: item } : { kind: "item", item });
  };

  return (
    <div className="flex h-full flex-col" data-spare-column>
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-medium text-foreground">Home</h1>
      </header>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col gap-8 px-8 py-6">
          <HomeRow
            title="Continue Watching"
            fetcher={() => client.getResumeItems({ limit: 20 })}
            onSelect={select}
            seeAll={null}
          />
          <HomeRow
            title="Latest Movies"
            fetcher={() => client.getLatestItems({ includeItemTypes: ["Movie" as BaseItemKind], limit: 20 })}
            onSelect={select}
            seeAll={() => onNavigate({ kind: "library", library: "movies", subview: "all" })}
          />
          <HomeRow
            title="Latest Shows"
            fetcher={() => client.getLatestItems({ includeItemTypes: ["Series" as BaseItemKind], limit: 20 })}
            onSelect={select}
            seeAll={() => onNavigate({ kind: "library", library: "tvshows", subview: "all" })}
          />
          <HomeRow
            title="Collections"
            fetcher={async () => {
              const r = await client.getItems({
                includeItemTypes: ["BoxSet" as BaseItemKind],
                limit: 20,
                recursive: true,
              });
              return r.items;
            }}
            onSelect={select}
            seeAll={() => onNavigate({ kind: "library", library: "movies", subview: "collections" })}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One horizontally-scrolling row. Loads its own data, shows a skeleton while
 * loading, hides itself on empty so the home view stays terse.
 */
function HomeRow({
  title,
  fetcher,
  onSelect,
  seeAll,
}: {
  title: string;
  fetcher: RowFetcher;
  onSelect: (item: BaseItemDto) => void;
  seeAll: (() => void) | null;
}) {
  const [theme] = useTheme();
  const [items, setItems] = useState<BaseItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely on empty result so home doesn't show empty rows.
  if (items !== null && items.length === 0 && !error) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {seeAll && items && items.length > 0 ? (
          <button
            type="button"
            onClick={seeAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            See all →
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-muted-foreground">Couldn't load: {error}</p>
      ) : items === null ? (
        theme === "spare" ? <p className="text-xs text-muted-foreground">Loading…</p> : <RowSkeleton />
      ) : theme === "spare" ? (
        // Spare: directory table, no posters. Caps to 8 rows so the home
        // page stays terse — the See-all link drills into the full list.
        <MediaTable items={items.slice(0, 8)} onSelect={onSelect} />
      ) : (
        <div className="relative">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex gap-4">
              {items.map((item) => (
                <div key={item.Id ?? item.Name} className="min-w-0 shrink-0 basis-[140px] sm:basis-[160px] md:basis-[180px]">
                  <PosterCard item={item} onSelect={onSelect} />
                </div>
              ))}
            </div>
          </div>
          {embla ? <RowControls embla={embla} /> : null}
        </div>
      )}
    </section>
  );
}

function RowControls({ embla }: { embla: ReturnType<typeof useEmblaCarousel>[1] }) {
  if (!embla) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => embla.scrollPrev()}
        className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-background"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => embla.scrollNext()}
        className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-background"
      >
        ›
      </button>
    </>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] min-w-0 shrink-0 basis-[140px] animate-pulse rounded-md bg-muted/50 sm:basis-[160px] md:basis-[180px]"
        />
      ))}
    </div>
  );
}

