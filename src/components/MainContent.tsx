import { lazy, Suspense, useEffect, useState } from "react";
import { useJellyfin } from "@/components/AuthProvider";
import { PosterCard } from "@/components/PosterCard";
import { MediaTable } from "@/components/MediaTable";
import { SortControls } from "@/components/SortControls";
import { loadScopeState } from "@/lib/sort-presets";
import { useTheme } from "@/lib/use-theme";
import type {
  BaseItemDto,
  BaseItemKind,
  ItemSortBy,
  SortOrder,
} from "@/lib/jellyfin/types";
import type { LibraryKind, View } from "@/types";

// Lazy: every leaf view splits into its own chunk so the initial bundle
// only carries the App shell + the active view. Switching views downloads
// the next chunk (cached after first visit).
const ItemDetail = lazy(() =>
  import("@/components/views/ItemDetail").then((m) => ({ default: m.ItemDetail })),
);
const SeriesDetail = lazy(() =>
  import("@/components/views/SeriesDetail").then((m) => ({ default: m.SeriesDetail })),
);
const HomeView = lazy(() =>
  import("@/components/views/HomeView").then((m) => ({ default: m.HomeView })),
);
const SearchView = lazy(() =>
  import("@/components/views/SearchView").then((m) => ({ default: m.SearchView })),
);
const LiveTvView = lazy(() =>
  import("@/components/views/LiveTvView").then((m) => ({ default: m.LiveTvView })),
);
const SettingsView = lazy(() =>
  import("@/components/views/SettingsView").then((m) => ({ default: m.SettingsView })),
);

const KIND_TO_INCLUDE: Record<LibraryKind, BaseItemKind> = {
  movies: "Movie" as BaseItemKind,
  tvshows: "Series" as BaseItemKind,
};

export function MainContent({
  view,
  onNavigate,
  onPlay,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onPlay: (item: BaseItemDto) => void;
}) {
  return (
    <Suspense fallback={<ChunkFallback />}>
      {renderView(view, onNavigate, onPlay)}
    </Suspense>
  );
}

function renderView(
  view: View,
  onNavigate: (view: View) => void,
  onPlay: (item: BaseItemDto) => void,
) {
  switch (view.kind) {
    case "home":
      return <HomeView onNavigate={onNavigate} />;
    case "livetv":
      return <LiveTvView />;
    case "search":
      return <SearchView onNavigate={onNavigate} />;
    case "settings":
      return <SettingsView />;
    case "item":
      return <ItemDetail item={view.item} onPlay={onPlay} />;
    case "series":
      return <SeriesDetail series={view.series} onPlay={onPlay} />;
    case "library":
      return <LibraryView view={view} onNavigate={onNavigate} />;
    case "genre":
      return <GenreView view={view} onNavigate={onNavigate} />;
  }
}

function ChunkFallback() {
  // Bare div with the bg color so the chunk transition doesn't flash white;
  // chunks are tiny (~10-30 KB) so a real spinner would feel laggier.
  return <div className="h-full w-full bg-background" />;
}

// ---------------------------------------------------------------------------
// Library view (movies/tvshows × all/genres/collections)
// ---------------------------------------------------------------------------

function LibraryView({
  view,
  onNavigate,
}: {
  view: Extract<View, { kind: "library" }>;
  onNavigate: (view: View) => void;
}) {
  if (view.subview === "genres") {
    return <GenresList library={view.library} onNavigate={onNavigate} />;
  }
  if (view.subview === "collections") {
    return (
      <ItemGrid
        title="Collections"
        scopeKey={`${view.library}-collections`}
        includeItemTypes={["BoxSet" as BaseItemKind]}
        onSelect={(item) => onNavigate({ kind: "item", item })}
      />
    );
  }
  return (
    <ItemGrid
      title={view.library === "movies" ? "Movies" : "TV Shows"}
      scopeKey={`${view.library}-all`}
      includeItemTypes={[KIND_TO_INCLUDE[view.library]]}
      onSelect={(item) =>
        onNavigate(
          item.Type === "Series" ? { kind: "series", series: item } : { kind: "item", item }
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Genre views
// ---------------------------------------------------------------------------

function GenresList({
  library,
  onNavigate,
}: {
  library: LibraryKind;
  onNavigate: (view: View) => void;
}) {
  const client = useJellyfin();
  const [genres, setGenres] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGenres(null);
    setError(null);
    client
      .getItems({
        includeItemTypes: [KIND_TO_INCLUDE[library]],
        recursive: true,
        limit: 5000,
      })
      .then((res) => {
        if (cancelled) return;
        const counts = new Map<string, number>();
        for (const item of res.items) {
          for (const g of item.Genres ?? []) {
            counts.set(g, (counts.get(g) ?? 0) + 1);
          }
        }
        const sorted = [...counts.entries()].sort((a, b) =>
          a[0].localeCompare(b[0])
        );
        setGenres(sorted.map(([name]) => name));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [client, library]);

  if (error) {
    return <Placeholder title="Couldn't load genres" body={error} />;
  }
  if (genres === null) {
    return <Placeholder title="Loading genres…" />;
  }
  if (genres.length === 0) {
    return <Placeholder title="No genres" body="Items in this library aren't tagged with genres." />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-medium text-foreground">
          {library === "movies" ? "Movies" : "TV Shows"} · By Genre
        </h1>
        <p className="text-xs text-muted-foreground">{genres.length} genre{genres.length === 1 ? "" : "s"}</p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onNavigate({ kind: "genre", library, genreName: g })}
              className="rounded-md border border-border bg-card/50 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-accent"
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenreView({
  view,
  onNavigate,
}: {
  view: Extract<View, { kind: "genre" }>;
  onNavigate: (view: View) => void;
}) {
  return (
    <ItemGrid
      title={`${view.library === "movies" ? "Movies" : "TV Shows"} · ${view.genreName}`}
      scopeKey={`${view.library}-genre-${view.genreName}`}
      includeItemTypes={[KIND_TO_INCLUDE[view.library]]}
      genres={[view.genreName]}
      onSelect={(item) =>
        onNavigate(
          item.Type === "Series" ? { kind: "series", series: item } : { kind: "item", item }
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Reusable item grid with sort controls
// ---------------------------------------------------------------------------

function ItemGrid({
  title,
  scopeKey,
  includeItemTypes,
  genres,
  onSelect,
}: {
  title: string;
  scopeKey: string;
  includeItemTypes: BaseItemKind[];
  genres?: string[];
  onSelect: (item: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const [theme] = useTheme();
  const [items, setItems] = useState<BaseItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ sortBy: ItemSortBy; sortOrder: SortOrder }>(() => {
    return loadScopeState(scopeKey).current;
  });

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    client
      .getItems({
        includeItemTypes,
        sortBy: [sort.sortBy],
        sortOrder: sort.sortOrder,
        limit: 500,
        recursive: true,
        genres,
      })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [client, includeItemTypes, sort, scopeKey, genres?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <Placeholder title={`Couldn't load ${title.toLowerCase()}`} body={error} />;
  }
  return (
    <div className="flex h-full flex-col" data-spare-column>
      <header className="flex items-end justify-between gap-4 border-b border-border px-8 py-5">
        <div>
          <h1 className="text-xl font-medium text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">
            {items === null ? "Loading…" : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <SortControls scopeKey={scopeKey} onChange={setSort} />
      </header>
      <div className="flex-1 overflow-auto p-6">
        {items === null ? (
          theme === "spare" ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-muted/50" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <Placeholder title={`Nothing here`} body="Add some content to your Jellyfin library." />
        ) : theme === "spare" ? (
          <MediaTable items={items} onSelect={onSelect} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {items.map((item) => (
              <PosterCard key={item.Id ?? item.Name} item={item} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

function Placeholder({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10 text-center">
      <div className="max-w-md">
        <h2 className="mb-2 text-base font-medium text-foreground">{title}</h2>
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      </div>
    </div>
  );
}
