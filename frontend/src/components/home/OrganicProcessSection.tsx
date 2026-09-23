import { useRef, useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   HOW AN ORGANIC LATEX MATTRESS IS MADE — Section 6
   Two-column editorial: 30% intro LEFT + 70% interactive GIF viewer RIGHT.
   8-step process with clickable navigation, prev/next arrows, fade transitions.
   Lazy-loads GIFs progressively — only the active + next GIF are loaded.

   ► REPLACE PLACEHOLDER URLs in LATEX_STEPS to add the real GIFs.
   ───────────────────────────────────────────────────────────────────────── */

// ── Brand colours ────────────────────────────────────────────────────────
const LEAF     = "#7C9C59";
const DEEP     = "#467065";
const CHARCOAL = "#2D2D2D";
const CREAM    = "#FAF8F5";
const FOREST   = "#16241C";

// ── Step data — swap gif URLs when you have the 8 assets ─────────────────
const LATEX_STEPS = [
  { step: 1, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 2, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 3, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 4, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 5, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 6, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 7, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
  { step: 8, gif: "https://videotourl.com/videos/1790097325707-7755ccc5-1927-436d-a3b5-1e032dfbf3de.mp4" },
] as const;

const TOTAL = LATEX_STEPS.length; // 8

export default function OrganicProcessSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const preloadRefs = useRef<Set<string>>(new Set());

  const [entered,      setEntered]      = useState(false);
  const [activeIdx,    setActiveIdx]    = useState(0);   // 0-based
  const [visible,      setVisible]      = useState(true); // for fade transition

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Entrance observer ──────────────────────────────────────────────── */
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

  /* ── Preload next GIF ───────────────────────────────────────────────── */
  useEffect(() => {
    const preloadUrl = LATEX_STEPS[activeIdx + 1]?.gif;
    if (preloadUrl && !preloadRefs.current.has(preloadUrl)) {
      preloadRefs.current.add(preloadUrl);
      const img = new Image();
      img.src = preloadUrl;
    }
  }, [activeIdx]);

  /* ── Step change with fade ──────────────────────────────────────────── */
  const goToStep = useCallback((idx: number) => {
    if (idx === activeIdx || idx < 0 || idx >= TOTAL) return;
    if (reduced) {
      setActiveIdx(idx);
      return;
    }
    setVisible(false);
    setTimeout(() => {
      setActiveIdx(idx);
      setVisible(true);
    }, 280);
  }, [activeIdx, reduced]);

  const goPrev = useCallback(() => goToStep(activeIdx - 1), [activeIdx, goToStep]);
  const goNext = useCallback(() => goToStep(activeIdx + 1), [activeIdx, goToStep]);

  const ease = "cubic-bezier(0.22,1,0.36,1)";
  const activeStep = LATEX_STEPS[activeIdx];

  return (
    <section
      ref={sectionRef}
      id="how-its-made"
      aria-label="How an Organic Latex Mattress is Made"
      style={{
        width: "100%",
        background: CREAM,
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingTop:    "clamp(48px, 6vw, 72px)",
        paddingBottom: "clamp(48px, 6vw, 72px)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Page wrapper ─────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: "calc(100% - clamp(20px, 4vw, 80px) * 2)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}>

        <div className="op-grid">

          {/* ════ LEFT: Editorial intro ════ */}
          <div
            className="op-left"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(16px)",
              transition: reduced ? "none"
                : `opacity 700ms ${ease}, transform 700ms ${ease}`,
            }}
          >
            {/* Eyebrow */}
            <p style={{
              margin: "0 0 clamp(8px,1vw,12px)",
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "clamp(9px, 0.95vw, 11px)",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: LEAF,
              lineHeight: 1,
            }}>
              FROM TREE TO MATTRESS
            </p>

            {/* Main serif heading */}
            <h2 style={{
              margin: "0 0 clamp(14px, 2vw, 22px)",
              fontFamily: "var(--font-display,'DM Serif Display',serif)",
              fontSize: "clamp(36px, 4vw, 58px)",
              fontWeight: 400,
              lineHeight: 1.02,
              color: FOREST,
              letterSpacing: "-0.01em",
              wordBreak: "normal",
              overflowWrap: "normal",
              hyphens: "none",
            }}>
              How an Organic<br />Latex Mattress<br />is Made
            </h2>

            {/* Intro copy */}
            <p style={{
              margin: 0,
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "clamp(13px, 1.2vw, 15px)",
              fontWeight: 400,
              lineHeight: 1.62,
              color: `${CHARCOAL}99`,
              maxWidth: "340px",
              wordBreak: "normal",
              overflowWrap: "normal",
            }}>
              Every Kotson Organic Latex Mattress begins with nature — from
              sustainably harvested rubber tree sap to a breathable, supportive
              organic latex core. Follow the 8-step journey from plantation to
              the finished mattress.
            </p>
          </div>

          {/* ════ RIGHT: GIF viewer ════ */}
          <div
            className="op-right"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "clamp(10px, 1.4vw, 16px)",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(20px)",
              transition: reduced ? "none"
                : `opacity 700ms ${ease} 80ms, transform 700ms ${ease} 80ms`,
            }}
          >
            {/* ── GIF frame with prev/next arrows ── */}
            <div style={{ position: "relative", width: "100%" }}>

              {/* GIF container */}
              <div style={{
                width: "100%",
                aspectRatio: "16 / 8.5",
                borderRadius: "clamp(14px, 1.6vw, 22px)",
                overflow: "hidden",
                background: FOREST,
                position: "relative",
              }}>
                {/* Active GIF — video or img depending on file type */}
                <video
                  key={activeStep.gif}
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    opacity: visible ? 1 : 0,
                    transition: reduced ? "none" : "opacity 280ms ease",
                  }}
                >
                  <source src={activeStep.gif} type="video/mp4" />
                </video>
              </div>

              {/* ← Prev arrow */}
              {activeIdx > 0 && (
                <button
                  onClick={goPrev}
                  aria-label={`Go to step ${activeIdx}`}
                  className="op-nav-btn op-nav-prev"
                  style={{
                    position: "absolute",
                    left: "clamp(8px, 1.5vw, 16px)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "clamp(36px, 3.5vw, 46px)",
                    height: "clamp(36px, 3.5vw, 46px)",
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    background: `${CREAM}EE`,
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 2px 12px ${CHARCOAL}22`,
                    zIndex: 5,
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    outline: "none",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.transform = "translateY(-50%) scale(1.08)";
                    b.style.boxShadow = `0 4px 16px ${CHARCOAL}30`;
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.transform = "translateY(-50%) scale(1)";
                    b.style.boxShadow = `0 2px 12px ${CHARCOAL}22`;
                  }}
                  onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${LEAF}`; }}
                  onBlur={e  => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {/* → Next arrow */}
              {activeIdx < TOTAL - 1 && (
                <button
                  onClick={goNext}
                  aria-label={`Go to step ${activeIdx + 2}`}
                  className="op-nav-btn op-nav-next"
                  style={{
                    position: "absolute",
                    right: "clamp(8px, 1.5vw, 16px)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "clamp(36px, 3.5vw, 46px)",
                    height: "clamp(36px, 3.5vw, 46px)",
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    background: `${CREAM}EE`,
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 2px 12px ${CHARCOAL}22`,
                    zIndex: 5,
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    outline: "none",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.transform = "translateY(-50%) scale(1.08)";
                    b.style.boxShadow = `0 4px 16px ${CHARCOAL}30`;
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.transform = "translateY(-50%) scale(1)";
                    b.style.boxShadow = `0 2px 12px ${CHARCOAL}22`;
                  }}
                  onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${LEAF}`; }}
                  onBlur={e  => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* ── 8-step circular navigation ── */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              {/* Step dots row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  paddingBottom: "2px",
                }}
                className="op-steps-row"
              >
                {LATEX_STEPS.map((s, i) => {
                  const isActive    = i === activeIdx;
                  const isCompleted = i < activeIdx;
                  return (
                    <div
                      key={s.step}
                      style={{ display: "flex", alignItems: "center", flex: i < TOTAL - 1 ? "1 1 auto" : undefined }}
                    >
                      {/* Circle button */}
                      <button
                        onClick={() => goToStep(i)}
                        aria-label={`Step ${s.step}`}
                        aria-current={isActive ? "true" : undefined}
                        style={{
                          flexShrink: 0,
                          width: "clamp(28px, 3vw, 36px)",
                          height: "clamp(28px, 3vw, 36px)",
                          borderRadius: "50%",
                          border: isActive
                            ? "none"
                            : `1.5px solid ${isCompleted ? DEEP + "88" : DEEP + "44"}`,
                          cursor: "pointer",
                          background: isActive ? DEEP : isCompleted ? `${DEEP}18` : CREAM,
                          color: isActive ? CREAM : DEEP,
                          fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                          fontSize: "clamp(9px, 0.85vw, 11px)",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 250ms ease, border-color 250ms ease",
                          outline: "none",
                          boxShadow: isActive ? `0 2px 10px ${DEEP}44` : "none",
                        }}
                        onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${LEAF}`; }}
                        onBlur={e  => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; }}
                      >
                        {String(s.step).padStart(2, "0")}
                      </button>

                      {/* Connector line (not after last) */}
                      {i < TOTAL - 1 && (
                        <div style={{
                          flex: 1,
                          height: "1.5px",
                          background: i < activeIdx
                            ? `${DEEP}55`
                            : `${CHARCOAL}18`,
                          transition: "background 250ms ease",
                          minWidth: "8px",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom labels */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "2px",
              }}>
                <span style={{
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "clamp(8px, 0.8vw, 10px)",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: `${CHARCOAL}60`,
                }}>
                  PLANTATION
                </span>

                <span style={{
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "clamp(8px, 0.8vw, 10px)",
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: DEEP,
                }}>
                  STEP {activeIdx + 1} OF {TOTAL}
                </span>

                <span style={{
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "clamp(8px, 0.8vw, 10px)",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: `${CHARCOAL}60`,
                }}>
                  MATTRESS
                </span>
              </div>
            </div>

          </div>
          {/* end right */}

        </div>
        {/* end grid */}

      </div>

      {/* Responsive + scrollbar-hide styles */}
      <style>{`
        /* ── Mobile: stacked ── */
        .op-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(28px, 5vw, 40px);
        }
        .op-left  { order: 1; }
        .op-right { order: 2; }

        /* ── Tablet ≥ 768px ── */
        @media (min-width: 768px) {
          .op-grid {
            grid-template-columns: minmax(240px, 0.34fr) minmax(0, 0.66fr);
            gap: clamp(28px, 4vw, 44px);
            align-items: center;
          }
          .op-left  { order: 1; }
          .op-right { order: 2; }
        }

        /* ── Desktop ≥ 1024px ── */
        @media (min-width: 1024px) {
          .op-grid {
            grid-template-columns: minmax(280px, 0.30fr) minmax(0, 0.70fr);
            gap: clamp(40px, 4.5vw, 56px);
          }
        }

        /* Hide scrollbar on step dots row */
        .op-steps-row::-webkit-scrollbar { display: none; }
        .op-steps-row { -ms-overflow-style: none; scrollbar-width: none; }

        /* Nav btn touch targets on small screens */
        @media (max-width: 767px) {
          .op-nav-btn {
            width: 38px !important;
            height: 38px !important;
          }
        }
      `}</style>
    </section>
  );
}
