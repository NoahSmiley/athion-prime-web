import { useEffect, useRef, useState } from "react";
import { useJellyfin } from "@/components/AuthProvider";
import { PosterCard } from "@/components/PosterCard";
import { MediaTable } from "@/components/MediaTable";
import { useTheme } from "@/lib/use-theme";
import type { BaseItemDto } from "@/lib/jellyfin/types";
import type { View } from "@/types";

const DEBOUNCE_MS = 220;

/**
 * Search view — debounced text input → flat results grid. Hits Jellyfin's
 * `getSearchHints` (mapped to BaseItemDto-shaped objects in the client).
 */
export function SearchView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const client = useJellyfin();
  const [theme] = useTheme();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BaseItemDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reqId = useRef(0);

  // Auto-focus the search box on mount so the user can just start typing.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems(null);
      setError(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      client
        .search(trimmed, { limit: 60 })
        .then((res) => {
          // Stale response — newer query has been issued; drop this one.
          if (reqId.current !== id) return;
          setItems(res);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (reqId.current !== id) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [client, query]);

  const select = (item: BaseItemDto) => {
    onNavigate(item.Type === "Series" ? { kind: "series", series: item } : { kind: "item", item });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-medium text-foreground">Search</h1>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies, shows, episodes…"
          className="mt-3 w-full max-w-xl rounded-md border border-border bg-card/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/60"
          autoComplete="off"
          spellCheck={false}
        />
      </header>
      <div className="flex-1 overflow-auto p-6" data-spare-column>
        {error ? (
          <p className="text-sm text-muted-foreground">Couldn't search: {error}</p>
        ) : !query.trim() ? (
          <p className="text-sm text-muted-foreground">
            Type to search across your Jellyfin libraries.
          </p>
        ) : loading && items === null ? (
          theme === "spare" ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-muted/50" />
              ))}
            </div>
          )
        ) : items && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing matches "{query.trim()}".
          </p>
        ) : items ? (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              {items.length} result{items.length === 1 ? "" : "s"}
              {loading ? " · refreshing…" : ""}
            </p>
            {theme === "spare" ? (
              <MediaTable items={items} onSelect={select} />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {items.map((item) => (
                  <PosterCard key={item.Id ?? item.Name} item={item} onSelect={select} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
