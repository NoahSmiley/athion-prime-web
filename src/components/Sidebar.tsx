import type { ComponentType } from "react";
import { Home, Film, Tv, Radio, Search, Settings as SettingsIcon } from "lucide-react";
import { SIDEBAR_DESTINATIONS, type SidebarKind, type View } from "@/types";

const ICONS: Record<SidebarKind, ComponentType<{ className?: string }>> = {
  home: Home,
  movies: Film,
  tvshows: Tv,
  livetv: Radio,
  search: Search,
  settings: SettingsIcon,
};

export function Sidebar({
  activeKind,
  onChange,
}: {
  activeKind: View["kind"];
  onChange: (view: View) => void;
}) {
  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5">
        <h1 className="text-sm font-medium tracking-wide text-foreground">Athion Prime</h1>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {SIDEBAR_DESTINATIONS.map((d) => {
          const Icon = ICONS[d.kind];
          const active = activeKind === d.kind;
          return (
            <button
              key={d.kind}
              onClick={() => onChange({ kind: d.kind } as View)}
              className={[
                "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{d.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
