import { ChevronLeft, ChevronRight, ChevronRight as ChevronSep } from "lucide-react";
import type { Navigation } from "@/lib/nav";
import { viewLabel } from "@/types";

export function BreadcrumbHeader({ nav }: { nav: Navigation }) {
  const { crumbs, canBack, canForward, back, forward, jumpTo } = nav;

  return (
    <div className="flex h-11 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
      <button
        type="button"
        onClick={back}
        disabled={!canBack}
        title="Back"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={forward}
        disabled={!canForward}
        title="Forward"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="ml-1 flex min-w-0 flex-1 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1 truncate">
              {i > 0 ? (
                <ChevronSep className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />
              ) : null}
              {isLast ? (
                <span className="truncate font-medium text-foreground">{viewLabel(c)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {viewLabel(c)}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
