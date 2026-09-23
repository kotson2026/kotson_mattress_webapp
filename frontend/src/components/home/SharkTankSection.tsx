import { useRef, useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON × SHARK TANK INDIA
   Two-column: smaller banner LEFT + YouTube video RIGHT.
   Video uses a direct <iframe> injected on Play — most reliable approach.
   ───────────────────────────────────────────────────────────────────────── */

const BANNER_URL =
  "https://cdn.phototourl.com/free/2026-09-22-71b40d3f-ad65-4569-9d86-378e72497548.png";
const YT_VIDEO_ID = "xF_ri6AQJMo";
// Direct embed URL — autoplay fires the moment iframe mounts
const YT_EMBED = `https://www.youtube.com/embed/${YT_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

// Kotson brand tokens (mirrors :root in index.css)
const LEAF     = "#7C9C59";
const DEEP     = "#467065";
const CHARCOAL = "#2D2D2D";
const CREAM    = "#FAF8F5";
const SAND     = "#F7F5F0";
const FOREST   = "#16241C";

export default function SharkTankSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [entered,    setEntered]    = useState(false);
  const [showVideo,  setShowVideo]  = useState(false);
  const [imgLoaded,  setImgLoaded]  = useState(false);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Section entrance ─────────────────────────────────────────────── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setEntered(true); io.disconnect(); } },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ── Scroll-aware pause via postMessage ───────────────────────────── */
  useEffect(() => {
    if (!showVideo) return;
    const el = sectionRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([e]) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        if (e.intersectionRatio < 0.20) {
          // Pause via YouTube JS API postMessage
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*"
          );
        }
        // No auto-resume — visitor must manually resume
      },
      { threshold: [0, 0.20, 0.5, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showVideo]);

  /* ── Play ─────────────────────────────────────────────────────────── */
  const handlePlay = useCallback(() => setShowVideo(true), []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePlay(); }
  }, [handlePlay]);

  const ease = "cubic-bezier(0.22,1,0.36,1)";

  return (
    <section
      ref={sectionRef}
      id="shark-tank"
      aria-label="Kotson on Shark Tank India Season 5"
      style={{
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(170deg, ${SAND} 0%, #E8E4D6 25%, #D4DDCA 55%, #C0CFBA 80%, ${DEEP}44 100%)`,
        paddingTop:    "28px",
        paddingBottom: "28px",
      }}
    >
      {/* Subtle leaf-green radial accent */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background:
          `radial-gradient(ellipse 55% 40% at 70% 55%, ${LEAF}15 0%, transparent 65%),` +
          `radial-gradient(ellipse 35% 25% at 22% 18%, ${CREAM}55 0%, transparent 50%)`,
        opacity: entered ? 1 : 0,
        transition: reduced ? "none" : "opacity 900ms ease",
      }} />

      <div style={{
        position: "relative",
        width: "calc(100% - clamp(20px, 3.5vw, 56px) * 2)",
        maxWidth: "1100px",
        margin: "0 auto",
      }}>

        {/* ── "AS SEEN ON" eyebrow ──────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "clamp(8px,1.2vw,16px)",
          marginBottom: "10px",
          opacity: entered ? 1 : 0,
          transition: reduced ? "none" : "opacity 600ms ease",
        }}>
          <div style={{ flex: 1, height: "1px", background: `${CHARCOAL}1E`, maxWidth: "100px" }} />
          <p style={{
            margin: 0,
            fontFamily: "var(--font-ui,'Manrope',sans-serif)",
            fontSize: "clamp(8px,1vw,10px)",
            fontWeight: 700,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: `${CHARCOAL}70`,
            whiteSpace: "nowrap",
          }}>
            AS SEEN ON
          </p>
          <div style={{ flex: 1, height: "1px", background: `${CHARCOAL}1E`, maxWidth: "100px" }} />
        </div>

        {/* ── Two-column flex ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px,1.5vw,20px)", flexWrap: "wrap" }}>

          {/* ════ LEFT: Banner ════ */}
          <div
            className="st-col-left"
            style={{
              flex: "1 1 46%",
              minWidth: "min(100%, 280px)",
              maxWidth: "520px",
              borderRadius: "clamp(12px, 1.4vw, 18px)",
              overflow: "hidden",
              boxShadow: `0 10px 36px ${CHARCOAL}20, 0 2px 8px ${CHARCOAL}10`,
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(20px)",
              transition: reduced ? "none" : `opacity 800ms ${ease}, transform 800ms ${ease}`,
            }}
          >
            {!imgLoaded && (
              <div style={{
                width: "100%", paddingBottom: "70%",
                background: `${CHARCOAL}0A`,
                borderRadius: "inherit",
              }} />
            )}
            <img
              src={BANNER_URL}
              alt="Nature's Best, On India's Biggest Stage — Kotson on Shark Tank India Season 5"
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              style={{
                display: imgLoaded ? "block" : "none",
                width: "100%",
                maxHeight: "320px",
                objectFit: "contain",
                objectPosition: "center",
                verticalAlign: "bottom",
              }}
            />
          </div>

          {/* ════ RIGHT: Video panel ════ */}
          <div
            className="st-col-right"
            style={{
              flex: "1 1 44%",
              minWidth: "min(100%, 260px)",
              maxWidth: "460px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              borderRadius: "clamp(12px, 1.4vw, 18px)",
              background: "rgba(255,255,255,0.65)",
              border: `1px solid ${LEAF}28`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              padding: "14px",
              boxShadow: `0 8px 28px ${CHARCOAL}12`,
              alignSelf: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(28px)",
              transition: reduced ? "none"
                : `opacity 800ms ${ease} 120ms, transform 800ms ${ease} 120ms`,
            }}
          >
            {/* Label */}
            <p style={{
              margin: 0,
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "clamp(8px, 0.9vw, 10px)",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: DEEP,
              lineHeight: 1.65,
            }}>
              WATCH THE KOTSON<br />SHARK TANK JOURNEY
            </p>

            {/* Video viewport */}
            <div style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "clamp(10px, 1.2vw, 14px)",
              overflow: "hidden",
              background: FOREST,
              flex: "0 0 auto",
            }}>

              {/* Idle state: dark poster + custom play button */}
              {!showVideo && (
                <>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(135deg, ${FOREST} 0%, ${DEEP} 100%)`,
                  }} />

                  {/* Subtle KOTSON watermark */}
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0.07,
                    fontFamily: "var(--font-display,'DM Serif Display',serif)",
                    fontSize: "clamp(14px, 2.5vw, 24px)",
                    color: CREAM,
                    letterSpacing: "0.12em",
                    userSelect: "none",
                  }}>
                    KOTSON
                  </div>

                  {/* Play button */}
                  <button
                    onClick={handlePlay}
                    onKeyDown={handleKeyDown}
                    aria-label="Play Kotson Shark Tank India video"
                    style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "clamp(46px, 6vw, 66px)",
                      height: "clamp(46px, 6vw, 66px)",
                      borderRadius: "50%",
                      border: "none",
                      cursor: "pointer",
                      background: `${CREAM}F2`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 4px 20px ${CHARCOAL}44, 0 0 0 1px ${LEAF}44`,
                      zIndex: 5,
                      transition: "transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease",
                      outline: "none",
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.transform = "translate(-50%, -50%) scale(1.09)";
                      b.style.boxShadow = `0 6px 28px ${CHARCOAL}55, 0 0 0 2px ${LEAF}70`;
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.transform = "translate(-50%, -50%) scale(1)";
                      b.style.boxShadow = `0 4px 20px ${CHARCOAL}44, 0 0 0 1px ${LEAF}44`;
                    }}
                    onFocus={e => {
                      (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${LEAF}`;
                      (e.currentTarget as HTMLButtonElement).style.outlineOffset = "3px";
                    }}
                    onBlur={e => {
                      (e.currentTarget as HTMLButtonElement).style.outline = "none";
                    }}
                  >
                    <svg
                      width="36%" height="36%"
                      viewBox="0 0 24 24" fill="none"
                      style={{ marginLeft: "10%", display: "block" }}
                    >
                      <path d="M5 3L19 12L5 21V3Z" fill={FOREST} />
                    </svg>
                  </button>
                </>
              )}

              {/* YouTube iframe — only mounted after Play click */}
              {showVideo && (
                <iframe
                  ref={iframeRef}
                  src={YT_EMBED}
                  title="Kotson on Shark Tank India Season 5"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                  }}
                />
              )}
            </div>

            {/* Attribution */}
            <p style={{
              margin: "auto 0 0",
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "clamp(7px, 0.8vw, 9px)",
              fontWeight: 600,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: `${CHARCOAL}3C`,
              textAlign: "center",
            }}>
              KOTSON&nbsp;&nbsp;×&nbsp;&nbsp;SHARK TANK INDIA
            </p>
          </div>

        </div>
      </div>

      {/* Responsive column rules */}
      <style>{`
        @media (min-width: 820px) and (max-width: 1080px) {
          .st-col-left  { flex-basis: 54% !important; }
          .st-col-right { flex-basis: 36% !important; }
        }
        @media (max-width: 819px) {
          .st-col-left,
          .st-col-right {
            flex-basis: 100% !important;
            min-width: 100% !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </section>
  );
}
