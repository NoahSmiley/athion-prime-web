import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SIDEBAR_DESTINATIONS,
  viewToSidebarLeaf,
  type SidebarKind,
  type View,
} from "@/types";

/**
 * Spare-mode top nav — engineered to match the live athion.me chrome.
 *
 * Layout: wordmark on the left, destinations on the right, gap 18px,
 * font-size 13px, line-height 1, height 24px, padding 0 24px.
 *
 * Active treatment: a single 1px white underline absolutely positioned
 * just below the row, animating left/width between hovered destinations
 * the same way athion.me does. The element only mounts once we have a
 * resolved position so the first appearance fades in instead of sliding
 * from {0,0}.
 *
 * Inactive labels use the muted athion grey (#828282 via .nav-link in
 * App.css); active is pure white via .nav-link-active.
 */
const TOP_OFFSET = 56;

export function TopNav({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<SidebarKind, HTMLButtonElement>>(new Map());
  const [hoverKey, setHoverKey] = useState<SidebarKind | null>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const [underlineVisible, setUnderlineVisible] = useState(false);

  const activeKey = viewToSidebarLeaf(view)?.kind ?? null;
  const trackKey = hoverKey ?? activeKey;

  useLayoutEffect(() => {
    if (!trackKey) {
      setUnderlineVisible(false);
      return;
    }
    const el = itemRefs.current.get(trackKey);
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const a = el.getBoundingClientRect();
    const b = wrap.getBoundingClientRect();
    setUnderline({ left: a.left - b.left, width: a.width });
    // Defer the opacity flip to the next frame so the bar paints at its
    // target position invisibly first, then fades in. Without this, both
    // updates batch and there's no fade — the bar pops.
    const raf = requestAnimationFrame(() => setUnderlineVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [trackKey]);

  // Reset when view changes; activeKey will recompute on its own.
  useEffect(() => {
    setHoverKey(null);
  }, [view]);

  const go = (kind: SidebarKind) => {
    if (kind === "movies" || kind === "tvshows") {
      onChange({ kind: "library", library: kind, subview: "all" });
    } else {
      onChange({ kind } as View);
    }
  };

  return (
    // The 56px top offset matches athion.me's `.main-sidebar { top: 56px }`,
    // giving the nav air above it instead of sitting flush at the top.
    <div className="shrink-0" style={{ paddingTop: TOP_OFFSET }}>
      <div
        ref={wrapRef}
        className="relative mx-auto box-border w-full"
        style={{ maxWidth: 700, position: "relative" }}
      >
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            lineHeight: 1,
            padding: "0 24px",
            height: 24,
          }}
        >
          <button
            type="button"
            onClick={() => onChange({ kind: "home" })}
            onMouseEnter={() => setHoverKey(null)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "#fff",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              lineHeight: 1,
            }}
          >
            <span>Athion</span>
            {/* Cyan pill matching athion.me's blog-pill treatment for
                "Press" but tinted to mark Prime distinctly. The pill
                inherits the wordmark's visual weight without competing
                with the rest of the nav. */}
            <span
              style={{
                background: "#22d3ee",
                color: "#fff",
                padding: "2px 6px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                borderRadius: 2,
                display: "inline-block",
              }}
            >
              Prime
            </span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {SIDEBAR_DESTINATIONS.filter((d) => d.kind !== "home").map((d) => {
              const isTracked = trackKey === d.kind;
              return (
                <button
                  key={d.kind}
                  type="button"
                  ref={(el: HTMLButtonElement | null) => {
                    if (el) itemRefs.current.set(d.kind, el);
                    else itemRefs.current.delete(d.kind);
                  }}
                  onClick={() => go(d.kind)}
                  onMouseEnter={() => setHoverKey(d.kind)}
                  onFocus={() => setHoverKey(d.kind)}
                  className={`nav-link${isTracked ? " nav-link-active" : ""}`}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                  aria-current={activeKey === d.kind ? "page" : undefined}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sliding underline that tracks the hovered/active destination. */}
        {underline ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 24,
              left: underline.left,
              width: underline.width,
              height: 1,
              background: "#fff",
              opacity: underlineVisible ? 1 : 0,
              transition: "left 0.18s ease, width 0.18s ease, opacity 0.18s ease",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
