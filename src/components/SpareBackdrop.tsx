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
 * Inline hero image for spare-mode detail pages. Renders as an actual
 * <img>-shaped band at the top of the article — not a fixed background
 * watermark. The article text sits *below* it on the normal page bg,
 * not over it. A short bottom gradient softens the seam between the
 * image and the body, but the article never has to fight the image
 * for legibility.
 */
export function SpareBackdrop({ src }: { src: string }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "21 / 9" }}>
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
      />
      {/* Bottom-only fade so the image meets the page bg cleanly without
          a hard horizontal line. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background"
      />
    </div>
  );
}
