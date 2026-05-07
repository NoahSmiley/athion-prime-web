/**
 * Atmospheric backdrop wash for spare-mode detail pages.
 *
 * Spans the full viewport width (NOT the 700px column) so the image
 * bleeds off-edge instead of looking like a stamped rectangle. Three
 * stacked layers do the work:
 *
 *   1. The image, slightly desaturated and at moderate opacity
 *   2. A radial mask that softens the corners + fades the bottom
 *   3. A vertical gradient over the top to anchor the article body
 *
 * Sized to ~55vh tall so the article overlaps it for ~30% of its
 * height; below that, the backdrop is fully gone.
 */
/**
 * `position: fixed` so the backdrop bleeds full-viewport width,
 * escaping the 700px column wrapper its parent lives in. Pinned just
 * below the TopNav (top-[80px] = 56px nav-offset + 24px row), 60vh
 * tall, fades out radially + on the bottom.
 */
export function SpareBackdrop({ src }: { src: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[80px] h-[60vh] overflow-hidden z-0">
      {/* Image layer — full bleed, slight blur, radial mask so corners
          dissolve instead of cutting hard. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${src})`,
          opacity: 0.4,
          filter: "blur(1px) saturate(0.85)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, black 35%, transparent 80%)",
        }}
      />
      {/* Vertical wash anchoring the article body. Heavier toward the
          bottom so text never has to fight the backdrop for legibility. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/65 to-background"
      />
    </div>
  );
}
