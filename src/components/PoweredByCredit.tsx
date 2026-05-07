/**
 * Tiny "powered by Waverunner" badge fixed to the bottom-right corner
 * of the viewport. Vercel-style: visible for credit but never in the
 * way of content. 9px text + a 12px W-wave logo, both rendered very
 * muted (#555, 0.55 opacity) and brightening on hover.
 */
export function PoweredByCredit() {
  return (
    <a
      href="https://github.com/trevorkerney/Waverunner"
      target="_blank"
      rel="noreferrer"
      title="Powered by Waverunner — fork of Trevor Kerney's project"
      style={{
        position: "fixed",
        right: 16,
        bottom: 12,
        zIndex: 30,
        color: "#555",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 9,
        lineHeight: 1,
        letterSpacing: 0.2,
        transition: "color 0.15s, opacity 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#aaa";
        const img = e.currentTarget.querySelector("img");
        if (img) img.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#555";
        const img = e.currentTarget.querySelector("img");
        if (img) img.style.opacity = "0.55";
      }}
    >
      <span>powered by Waverunner</span>
      <img
        src="/logo256.png"
        alt=""
        aria-hidden="true"
        style={{
          height: 12,
          width: 12,
          opacity: 0.55,
          filter: "grayscale(1)",
          transition: "opacity 0.15s",
        }}
      />
    </a>
  );
}
