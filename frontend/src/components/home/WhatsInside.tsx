import { useRef, useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   WHAT'S INSIDE THE MATTRESS? — Section 4
   2-column grid: 36% left (heading + layers) / 64% right (image).
   Both columns stretch to the same height. Left content distributes
   vertically with justify-content: space-between so it visually matches
   the image height.
   ───────────────────────────────────────────────────────────────────────── */

const DEEP     = "#467065";
const CHARCOAL = "#2D2D2D";
const SAND     = "#F7F5F0";

const LAYERS = [
  {
    id: "cover",
    step: "01",
    title: ["100% PURE", "BAMBOO COVER"],
    desc: "Soft, breathable and naturally comfortable.",
  },
  {
    id: "casing",
    step: "02",
    title: ["THIN COTTON", "ZIP COVER"],
    desc: "A breathable protective layer designed for everyday comfort.",
  },
  {
    id: "core",
    step: "03",
    title: ["GOLS-CERTIFIED 100%", "ORGANIC LATEX CORE"],
    desc: "Naturally responsive support at the heart of the mattress.",
  },
] as const;

export default function WhatsInside() {
  const sectionRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setEntered(true); io.disconnect(); } },
      { threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ease = "cubic-bezier(0.22,1,0.36,1)";

  return (
    <section
      ref={sectionRef}
      id="whats-inside"
      aria-label="What's Inside The Mattress?"
      style={{
        width: "100%",
        background: "#FAF8F5",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingTop:    "40px",
        paddingBottom: "40px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* SR-only semantic content */}
      <div className="sr-only">
        <h2>What's Inside The Mattress?</h2>
        <ol>
          {LAYERS.map(l => (
            <li key={l.id}><h3>{l.title.join(" ")}</h3><p>{l.desc}</p></li>
          ))}
        </ol>
      </div>

      {/* ── Page wrapper ─────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: "calc(100% - clamp(20px, 4vw, 80px) * 2)",
        maxWidth: "1440px",
        margin: "0 auto",
      }}>

        {/* ════════════════════════════════════════
            MOBILE: heading then image then layers
            DESKTOP: 2-column grid (wi-grid)
        ════════════════════════════════════════ */}
        <div className="wi-grid">

          {/* ── LEFT: Heading + Layer content ── */}
          <div
            className="wi-left"
            style={{
              display: "flex",
              flexDirection: "column",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(18px)",
              transition: reduced ? "none"
                : `opacity 800ms ${ease}, transform 800ms ${ease}`,
            }}
          >
            {/* ── Heading block ── */}
            <div style={{ flexShrink: 0, marginBottom: "24px" }}>
              {/* Eyebrow */}
              <p
                aria-hidden="true"
                style={{
                  margin: "0 0 clamp(6px, 0.8vw, 10px)",
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "clamp(9px, 0.95vw, 11px)",
                  fontWeight: 700,
                  letterSpacing: "0.20em",
                  textTransform: "uppercase",
                  color: DEEP,
                  lineHeight: 1,
                }}
              >
                WHAT'S INSIDE
              </p>

              {/* Main serif heading */}
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display,'DM Serif Display',serif)",
                  fontSize: "clamp(36px, 4vw, 60px)",
                  fontWeight: 400,
                  lineHeight: 1.0,
                  color: CHARCOAL,
                  letterSpacing: "-0.01em",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  hyphens: "none",
                }}
              >
                The Mattress?
              </h2>
            </div>

            {/* ── Three layers ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                gap: "0px",
              }}
            >
              {LAYERS.map((layer, idx) => (
                <div key={layer.id}>
                  {/* Layer row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "clamp(10px, 1.2vw, 16px)",
                      paddingTop:    idx === 0 ? 0 : "16px",
                      paddingBottom: idx < LAYERS.length - 1 ? "16px" : 0,
                    }}
                  >
                    {/* Step number */}
                    <span style={{
                      flexShrink: 0,
                      fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                      fontSize: "clamp(9px, 0.9vw, 11px)",
                      fontWeight: 700,
                      color: `${DEEP}88`,
                      letterSpacing: "0.06em",
                      lineHeight: 1.4,
                      paddingTop: "2px",
                      minWidth: "clamp(22px, 2vw, 28px)",
                    }}>
                      {layer.step}
                    </span>

                    {/* Thin vertical rule */}
                    <div style={{
                      flexShrink: 0,
                      width: "1px",
                      alignSelf: "stretch",
                      background: `${DEEP}28`,
                      marginTop: "2px",
                    }} />

                    {/* Title + description */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      wordBreak: "normal",
                      overflowWrap: "normal",
                      hyphens: "none",
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "clamp(15px, 1.5vw, 19px)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        lineHeight: 1.2,
                        color: CHARCOAL,
                        whiteSpace: "pre-line",
                        wordBreak: "normal",
                        overflowWrap: "normal",
                        hyphens: "none",
                      }}>
                        {layer.title[0]}{"\n"}{layer.title[1]}
                      </h3>
                      <p style={{
                        margin: "5px 0 0",
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "clamp(12px, 1.1vw, 15px)",
                        fontWeight: 400,
                        lineHeight: 1.58,
                        color: `${CHARCOAL}90`,
                        wordBreak: "normal",
                        overflowWrap: "normal",
                        hyphens: "none",
                      }}>
                        {layer.desc}
                      </p>
                    </div>
                  </div>

                  {/* Horizontal divider between layers */}
                  {idx < LAYERS.length - 1 && (
                    <div style={{
                      height: "1px",
                      background: `${DEEP}22`,
                      margin: 0,
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Image ── */}
          <div
            className="wi-right"
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(22px)",
              transition: reduced ? "none"
                : `opacity 800ms ${ease} 100ms, transform 800ms ${ease} 100ms`,
            }}
          >
            <div style={{
              width: "100%",
              maxWidth: "680px",
              marginLeft: "auto",
              borderRadius: "clamp(16px, 1.8vw, 26px)",
              overflow: "hidden",
              border: `1px solid ${CHARCOAL}0D`,
              boxShadow: `0 10px 40px ${CHARCOAL}0E`,
              background: SAND,
            }}>
              <img
                src="https://cdn.phototourl.com/free/2026-09-22-8f77abc6-0f41-42df-8b46-df110ccc137c.png"
                alt="Kotson 3-Layer Mattress Construction: 100% Pure Bamboo Cover, Thin Cotton Zip Cover, and GOLS-Certified 100% Organic Latex Core"
                draggable={false}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  objectPosition: "center",
                  userSelect: "none",
                  verticalAlign: "bottom",
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Responsive grid rules */}
      <style>{`
        /* ── Mobile: single column, image above layers ── */
        .wi-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .wi-left  { order: 2; }
        .wi-right { order: 1; }

        /* ── Tablet ≥ 768px: 2-column ── */
        @media (min-width: 768px) {
          .wi-grid {
            grid-template-columns: minmax(300px, 0.42fr) minmax(0, 0.58fr);
            gap: clamp(28px, 3.5vw, 40px);
            align-items: center;
          }
          .wi-left  { order: 1; }
          .wi-right { order: 2; }
        }

        /* ── Desktop ≥ 1024px: full 42/58 ── */
        @media (min-width: 1024px) {
          .wi-grid {
            grid-template-columns: minmax(360px, 0.42fr) minmax(0, 0.58fr);
            gap: clamp(36px, 4vw, 48px);
          }
        }

        /* ── Global word-break guard for this section ── */
        #whats-inside * {
          word-break:    normal !important;
          overflow-wrap: normal !important;
          hyphens:       none   !important;
        }
      `}</style>
    </section>
  );
}
