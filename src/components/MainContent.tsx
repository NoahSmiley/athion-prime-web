import { useEffect, useState } from "react";
import { useJellyfin } from "@/components/AuthProvider";
import { PosterCard } from "@/components/PosterCard";
import { SortControls } from "@/components/SortControls";
import { ItemDetail } from "@/components/views/ItemDetail";
import { SeriesDetail } from "@/components/views/SeriesDetail";
import { loadScopeState } from "@/lib/sort-presets";
import type {
  BaseItemDto,
  BaseItemKind,
  ItemSortBy,
  SortOrder,
} from "@/lib/jellyfin/types";
import type { LibraryKind, View } from "@/types";

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
  switch (view.kind) {
    case "home":
      return <Placeholder title="Home" body="Continue Watching, Latest Movies, Latest Shows. (Phase 5.)" />;
    case "livetv":
      return <Placeholder title="Live TV" body="Xtream-backed channel browser + EPG. (Phase 6.)" />;
    case "search":
      return <Placeholder title="Search" body="Live search across libraries. (Phase 5.)" />;
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
    <div className="flex h-full flex-col">
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Placeholder title={`Nothing here`} body="Add some content to your Jellyfin library." />
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
// Settings stub + Placeholder
// ---------------------------------------------------------------------------

function SettingsView() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-md text-center">
        <h2 className="mb-2 text-base font-medium text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Account info, playback quality, logout. Coming soon.
        </p>
        <p className="mt-6 text-[11px] text-muted-foreground/70">
          Athion Prime is built on Trevor Kerney's{" "}
          <a
            className="underline hover:text-foreground"
            href="https://github.com/trevorkerney/Waverunner"
            target="_blank"
            rel="noreferrer"
          >
            Waverunner
          </a>
          .
        </p>
      </div>
    </div>
  );
}

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
