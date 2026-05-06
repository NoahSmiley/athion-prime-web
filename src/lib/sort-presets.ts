/**
 * Saveable sort presets — Waverunner's signature ergonomic. Each grid view
 * has a "scope key" (e.g. "movies-all", "tvshows-genre-Action"), and presets
 * are a named (sortBy, sortOrder) pair scoped to that key. Persisted in
 * localStorage so they survive reloads.
 */
import type { ItemSortBy, SortOrder } from "@/lib/jellyfin/types";

export interface SortPreset {
  id: string; // stable id (uuid-like)
  name: string;
  sortBy: ItemSortBy;
  sortOrder: SortOrder;
}

export interface ScopeState {
  presets: SortPreset[];
  selectedId: string | null;
  // Last-used sort, even if not saved as a preset
  current: { sortBy: ItemSortBy; sortOrder: SortOrder };
}

const STORAGE_PREFIX = "athion-prime:sort:";

export const DEFAULT_SORT: ScopeState["current"] = {
  sortBy: "SortName" as ItemSortBy,
  sortOrder: "Ascending" as SortOrder,
};

export const SORT_BY_OPTIONS: { value: ItemSortBy; label: string }[] = [
  { value: "SortName" as ItemSortBy, label: "Name" },
  { value: "DateCreated" as ItemSortBy, label: "Date added" },
  { value: "ProductionYear" as ItemSortBy, label: "Year" },
  { value: "DatePlayed" as ItemSortBy, label: "Last played" },
  { value: "CommunityRating" as ItemSortBy, label: "Rating" },
  { value: "Random" as ItemSortBy, label: "Random" },
];

export function loadScopeState(scopeKey: string): ScopeState {
  if (typeof localStorage === "undefined") {
    return { presets: [], selectedId: null, current: { ...DEFAULT_SORT } };
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scopeKey);
    if (!raw) return { presets: [], selectedId: null, current: { ...DEFAULT_SORT } };
    const parsed = JSON.parse(raw) as Partial<ScopeState>;
    return {
      presets: parsed.presets ?? [],
      selectedId: parsed.selectedId ?? null,
      current: parsed.current ?? { ...DEFAULT_SORT },
    };
  } catch {
    return { presets: [], selectedId: null, current: { ...DEFAULT_SORT } };
  }
}

export function saveScopeState(scopeKey: string, state: ScopeState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + scopeKey, JSON.stringify(state));
  } catch {
    // localStorage quota or unavailable — silently ignore; the user just
    // loses preset persistence for this session.
  }
}

export function newPresetId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
