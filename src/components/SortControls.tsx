import { useEffect, useState } from "react";
import { ArrowUpDown, Save, Star } from "lucide-react";
import type { ItemSortBy, SortOrder } from "@/lib/jellyfin/types";
import {
  loadScopeState,
  newPresetId,
  saveScopeState,
  SORT_BY_OPTIONS,
  type ScopeState,
  type SortPreset,
} from "@/lib/sort-presets";

export interface SortControlsProps {
  scopeKey: string;
  onChange: (sort: { sortBy: ItemSortBy; sortOrder: SortOrder }) => void;
}

/**
 * Compact sort dropdown + saveable presets for a single grid view.
 * Persists per-scope to localStorage.
 */
export function SortControls({ scopeKey, onChange }: SortControlsProps) {
  const [state, setState] = useState<ScopeState>(() => loadScopeState(scopeKey));
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");

  // Reload state on scope change.
  useEffect(() => {
    const next = loadScopeState(scopeKey);
    setState(next);
    onChange(next.current);
  }, [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: ScopeState) => {
    setState(next);
    saveScopeState(scopeKey, next);
    onChange(next.current);
  };

  const updateCurrent = (patch: Partial<ScopeState["current"]>) => {
    persist({
      ...state,
      current: { ...state.current, ...patch },
      // Mutating the live sort detaches us from any selected preset
      selectedId: null,
    });
  };

  const selectPreset = (id: string | null) => {
    if (id === null) {
      persist({ ...state, selectedId: null });
      return;
    }
    const p = state.presets.find((x) => x.id === id);
    if (!p) return;
    persist({
      ...state,
      selectedId: id,
      current: { sortBy: p.sortBy, sortOrder: p.sortOrder },
    });
  };

  const savePreset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset: SortPreset = {
      id: newPresetId(),
      name: trimmed,
      sortBy: state.current.sortBy,
      sortOrder: state.current.sortOrder,
    };
    persist({
      ...state,
      presets: [...state.presets, preset],
      selectedId: preset.id,
    });
    setSavePromptOpen(false);
    setSavePromptName("");
  };

  const deletePreset = (id: string) => {
    persist({
      ...state,
      presets: state.presets.filter((p) => p.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    });
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={state.current.sortBy}
        onChange={(e) => updateCurrent({ sortBy: e.target.value as ItemSortBy })}
        className="rounded border-0 bg-transparent text-xs text-foreground focus:outline-none"
      >
        {SORT_BY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          updateCurrent({
            sortOrder: (state.current.sortOrder === "Ascending" ? "Descending" : "Ascending") as SortOrder,
          })
        }
        title={state.current.sortOrder === "Ascending" ? "Ascending" : "Descending"}
        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {state.current.sortOrder === "Ascending" ? "↑" : "↓"}
      </button>

      <span className="mx-2 h-4 w-px bg-border" />

      {state.presets.length > 0 ? (
        <select
          value={state.selectedId ?? ""}
          onChange={(e) => selectPreset(e.target.value || null)}
          className="rounded border-0 bg-transparent text-xs text-muted-foreground focus:outline-none"
        >
          <option value="">— preset —</option>
          {state.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}

      {state.selectedId ? (
        <button
          type="button"
          onClick={() => deletePreset(state.selectedId!)}
          title="Delete preset"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      ) : null}

      {savePromptOpen ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={savePromptName}
            onChange={(e) => setSavePromptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") savePreset(savePromptName);
              if (e.key === "Escape") {
                setSavePromptOpen(false);
                setSavePromptName("");
              }
            }}
            placeholder="Preset name"
            className="h-6 w-32 rounded border border-border bg-background px-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => savePreset(savePromptName)}
            className="rounded px-2 py-0.5 text-xs text-foreground hover:bg-accent"
          >
            Save
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setSavePromptOpen(true)}
          title="Save current sort as preset"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {state.selectedId ? <Star className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          <span className="hidden sm:inline">Save preset</span>
        </button>
      )}
    </div>
  );
}
