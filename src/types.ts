/**
 * App-level types. Domain types (BaseItemDto, BaseItemKind, etc.) live in
 * @/lib/jellyfin/types and are imported directly by components that need them.
 *
 * The View union mirrors Waverunner's navigation model — a navigable tree of
 * states that can be pushed onto a history stack and breadcrumbed back through.
 */
import type { BaseItemDto } from "@/lib/jellyfin/types";

export type LibraryKind = "movies" | "tvshows";
export type LibrarySubview = "all" | "genres" | "collections";

export type View =
  | { kind: "home" }
  | { kind: "library"; library: LibraryKind; subview: LibrarySubview }
  | { kind: "genre"; library: LibraryKind; genreName: string }
  | { kind: "item"; item: BaseItemDto }
  | { kind: "series"; series: BaseItemDto }
  | { kind: "livetv" }
  | { kind: "search" }
  | { kind: "settings" };

export type SidebarKind =
  | "home"
  | "movies"
  | "tvshows"
  | "livetv"
  | "search"
  | "settings";

export interface SidebarDestination {
  kind: SidebarKind;
  label: string;
  // Only present for movies / tvshows — the sub-tree the destination expands.
  subviews?: { subview: LibrarySubview; label: string }[];
}

export const SIDEBAR_DESTINATIONS: readonly SidebarDestination[] = [
  { kind: "home", label: "Home" },
  {
    kind: "movies",
    label: "Movies",
    subviews: [
      { subview: "all", label: "All" },
      { subview: "genres", label: "By Genre" },
      { subview: "collections", label: "Collections" },
    ],
  },
  {
    kind: "tvshows",
    label: "TV Shows",
    subviews: [
      { subview: "all", label: "All" },
      { subview: "genres", label: "By Genre" },
    ],
  },
  { kind: "livetv", label: "Live TV" },
  { kind: "search", label: "Search" },
  { kind: "settings", label: "Settings" },
] as const;

/**
 * Returns the SidebarKind that "owns" a given view, for active-state styling.
 * Drill-downs (genre/item/series) inherit from their underlying library.
 */
export function viewToSidebarKind(view: View): SidebarKind | null {
  switch (view.kind) {
    case "home":
    case "livetv":
    case "search":
    case "settings":
      return view.kind;
    case "library":
    case "genre":
      return view.library === "movies" ? "movies" : "tvshows";
    case "item":
    case "series": {
      const t = view.kind === "series" ? view.series.Type : view.item.Type;
      if (t === "Movie") return "movies";
      if (t === "Series" || t === "Season" || t === "Episode") return "tvshows";
      return null;
    }
  }
}

/**
 * The (sidebar, sub-view) tuple a view belongs to, when applicable. Drives
 * which sidebar leaf is highlighted as active (e.g. "Movies → By Genre").
 */
export function viewToSidebarLeaf(
  view: View
): { kind: SidebarKind; subview?: LibrarySubview } | null {
  const root = viewToSidebarKind(view);
  if (!root) return null;
  if (view.kind === "library") return { kind: root, subview: view.subview };
  if (view.kind === "genre") return { kind: root, subview: "genres" };
  return { kind: root };
}

/**
 * Short, human-readable label for a view — used in the breadcrumb trail.
 */
export function viewLabel(view: View): string {
  switch (view.kind) {
    case "home":
      return "Home";
    case "livetv":
      return "Live TV";
    case "search":
      return "Search";
    case "settings":
      return "Settings";
    case "library": {
      const root = view.library === "movies" ? "Movies" : "TV Shows";
      if (view.subview === "all") return root;
      if (view.subview === "genres") return `${root} · Genres`;
      return `${root} · Collections`;
    }
    case "genre":
      return view.genreName;
    case "item":
      return view.item.Name ?? "Item";
    case "series":
      return view.series.Name ?? "Series";
  }
}
