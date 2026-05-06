/**
 * App-level types. Domain types (BaseItemDto, BaseItemKind, etc.) live in
 * @/lib/jellyfin/types and are imported directly by components that need them.
 */
import type { BaseItemDto } from "@/lib/jellyfin/types";

/**
 * The active view in the main pane. Sidebar destinations correspond to the
 * top-level kinds; drill-downs into specific items (movie/series detail)
 * become `kind: "item"`.
 */
export type View =
  | { kind: "home" }
  | { kind: "movies" }
  | { kind: "tvshows" }
  | { kind: "livetv" }
  | { kind: "search" }
  | { kind: "settings" }
  | { kind: "item"; item: BaseItemDto };

export type SidebarKind = Exclude<View["kind"], "item">;

export interface SidebarDestination {
  kind: SidebarKind;
  label: string;
}

export const SIDEBAR_DESTINATIONS: readonly SidebarDestination[] = [
  { kind: "home", label: "Home" },
  { kind: "movies", label: "Movies" },
  { kind: "tvshows", label: "TV Shows" },
  { kind: "livetv", label: "Live TV" },
  { kind: "search", label: "Search" },
  { kind: "settings", label: "Settings" },
] as const;
