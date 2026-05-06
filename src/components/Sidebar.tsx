import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Film,
  Tv,
  Radio,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  SIDEBAR_DESTINATIONS,
  viewToSidebarLeaf,
  type LibrarySubview,
  type SidebarKind,
  type View,
} from "@/types";

const ICONS: Record<SidebarKind, ComponentType<{ className?: string }>> = {
  home: Home,
  movies: Film,
  tvshows: Tv,
  livetv: Radio,
  search: Search,
  settings: SettingsIcon,
};

export function Sidebar({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  const activeLeaf = viewToSidebarLeaf(view);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    // Auto-expand whichever destination owns the current view, plus Movies by default
    movies: activeLeaf?.kind === "movies",
    tvshows: activeLeaf?.kind === "tvshows",
  }));

  // Auto-expand when navigating into a sub-tree from elsewhere
  useEffect(() => {
    if (!activeLeaf) return;
    if (activeLeaf.kind === "movies" || activeLeaf.kind === "tvshows") {
      setExpanded((e) => ({ ...e, [activeLeaf.kind]: true }));
    }
  }, [activeLeaf?.kind, activeLeaf?.subview]);

  const navigateToDestination = (kind: SidebarKind) => {
    if (kind === "movies" || kind === "tvshows") {
      setExpanded((e) => ({ ...e, [kind]: true }));
      onChange({ kind: "library", library: kind, subview: "all" });
    } else {
      onChange({ kind } as View);
    }
  };

  const navigateToSubview = (kind: "movies" | "tvshows", subview: LibrarySubview) => {
    onChange({ kind: "library", library: kind, subview });
  };

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5">
        <h1 className="text-sm font-medium tracking-wide text-foreground">Athion Prime</h1>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {SIDEBAR_DESTINATIONS.map((d) => {
          const Icon = ICONS[d.kind];
          const isActive = activeLeaf?.kind === d.kind;
          const isExpandable = !!d.subviews;
          const isExpanded = isExpandable && expanded[d.kind];
          const showActiveOnRoot = isActive && !activeLeaf?.subview;

          return (
            <div key={d.kind}>
              <div
                className={[
                  "group flex w-full items-center gap-2 rounded transition-colors",
                  showActiveOnRoot
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                ].join(" ")}
              >
                <button
                  onClick={() => navigateToDestination(d.kind)}
                  className="flex flex-1 items-center gap-3 rounded px-3 py-2 text-left text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span>{d.label}</span>
                </button>
                {isExpandable ? (
                  <button
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [d.kind]: !e[d.kind] }))
                    }
                    className="px-2 py-2 text-muted-foreground/60 hover:text-foreground"
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                ) : null}
              </div>
              {isExpandable && isExpanded ? (
                <div className="ml-7 mt-0.5 space-y-0.5">
                  {d.subviews!.map((sv) => {
                    const subActive =
                      activeLeaf?.kind === d.kind &&
                      activeLeaf.subview === sv.subview;
                    return (
                      <button
                        key={sv.subview}
                        onClick={() => navigateToSubview(d.kind as "movies" | "tvshows", sv.subview)}
                        className={[
                          "flex w-full items-center rounded px-3 py-1.5 text-left text-xs transition-colors",
                          subActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                        ].join(" ")}
                      >
                        {sv.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-border px-5 py-3">
        <a
          href="https://github.com/trevorkerney/Waverunner"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
          title="Powered by Waverunner — fork of Trevor Kerney's project"
        >
          <img
            src="/logo256.png"
            alt=""
            aria-hidden="true"
            className="h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100"
          />
          <span>Powered by Waverunner</span>
        </a>
      </div>
    </aside>
  );
}
