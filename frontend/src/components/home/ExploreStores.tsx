import { useState, useRef, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   EXPLORE OUR STORES — Section after Certifications
   Desktop: 36 / 64 two-column split
   Tablet : single column, image then cards side-by-side
   Mobile : stacked (heading → image → cards → tagline)
   ───────────────────────────────────────────────────────────────────────── */

// ── Brand tokens ──────────────────────────────────────────────────────────
const DEEP     = "#467065";
const CHARCOAL = "#2D2D2D";
const CREAM    = "#FAF8F5";
const SAND     = "#F7F5F0";
const LEAF     = "#7C9C59";

// ── Store data ─────────────────────────────────────────────────────────────
// Fill address / phone / timings / mapUrl / image once available.
interface Store {
  id: string;
  number: string;
  name: string;
  address: string;
  phone: string;
  timings: string;
  mapUrl: string;
  image: string; // URL for drawer store photo
}

const STORES: Store[] = [
  {
    id: "hyderabad",
    number: "01",
    name: "Hyderabad",
    address: "",
    phone: "",
    timings: "",
    mapUrl: "",
    image: "",
  },
  {
    id: "vijayawada",
    number: "02",
    name: "Vijayawada",
    address: "",
    phone: "",
    timings: "",
    mapUrl: "",
    image: "",
  },
];

// ── Store Detail Drawer / Bottom Sheet ─────────────────────────────────────
interface DrawerProps {
  store: Store | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function StoreDrawer({ store, triggerRef, onClose }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef  = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    if (store) {
      // next frame
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [store]);

  // ESC to close
  useEffect(() => {
    if (!store) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [store, onClose]);

  // Return focus on close
  useEffect(() => {
    if (!store && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [store, triggerRef]);

  // Auto-focus close button when drawer opens
  useEffect(() => {
    if (store && closeRef.current) {
      closeRef.current.focus();
    }
  }, [store]);

  // Trap focus inside drawer
  const trapFocus = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (store) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [store]);

  if (!store) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(45,45,45,0.50)",
          backdropFilter: "blur(3px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 350ms ease",
        }}
      />

      {/* Drawer / Bottom Sheet */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${store.name} Store Details`}
        onKeyDown={trapFocus}
        style={{
          position: "fixed",
          zIndex: 1001,
          background: CREAM,
          overflowY: "auto",
          // Desktop: right drawer
          // Mobile: bottom sheet — handled via CSS class
        }}
        className="es-drawer"
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 28px 16px",
          borderBottom: `1px solid ${DEEP}18`,
          position: "sticky",
          top: 0,
          background: CREAM,
          zIndex: 2,
        }}>
          <div>
            <p style={{
              margin: 0,
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: `${DEEP}99`,
            }}>
              KOTSON STORE
            </p>
            <p style={{
              margin: "4px 0 0",
              fontFamily: "var(--font-display,'DM Serif Display',serif)",
              fontSize: "22px",
              fontWeight: 400,
              color: CHARCOAL,
              lineHeight: 1.1,
            }}>
              {store.name}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close store details"
            style={{
              border: "none",
              background: `${DEEP}12`,
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CHARCOAL,
              flexShrink: 0,
              transition: "background 200ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${DEEP}22`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${DEEP}12`)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "24px 28px 40px" }}>

          {/* Store photo placeholder */}
          {store.image ? (
            <img
              src={store.image}
              alt={`${store.name} Kotson store`}
              style={{
                width: "100%",
                aspectRatio: "16/9",
                objectFit: "cover",
                borderRadius: "16px",
                marginBottom: "28px",
                display: "block",
              }}
            />
          ) : (
            <div style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: "16px",
              background: SAND,
              border: `1px solid ${DEEP}18`,
              marginBottom: "28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}>
              {/* Leaf icon placeholder */}
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M14 4C14 4 6 8 6 16C6 20.4183 9.58172 24 14 24C18.4183 24 22 20.4183 22 16C22 8 14 4 14 4Z"
                  fill={`${LEAF}30`} stroke={`${LEAF}60`} strokeWidth="1.4"/>
              </svg>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: `${CHARCOAL}50` }}>
                Store image coming soon
              </span>
            </div>
          )}

          {/* Address */}
          <DrawerRow label="Address" value={store.address} fallback="Details coming soon" />

          {/* Timings */}
          <DrawerRow label="Store Timings" value={store.timings} fallback="Details coming soon" />

          {/* Phone */}
          <DrawerRow label="Phone" value={store.phone} fallback="Details coming soon" isPhone />

          {/* Divider */}
          <div style={{ height: "1px", background: `${DEEP}18`, margin: "28px 0" }} />

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Get Directions */}
            {store.mapUrl ? (
              <a
                href={store.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px 20px",
                  background: DEEP,
                  color: "#fff",
                  borderRadius: "12px",
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "background 200ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#3a5e59")}
                onMouseLeave={e => (e.currentTarget.style.background = DEEP)}
              >
                Get Directions
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 12L12 2M12 2H5M12 2V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "14px 20px",
                background: `${DEEP}22`,
                color: `${CHARCOAL}50`,
                borderRadius: "12px",
                fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                fontSize: "14px",
                fontWeight: 600,
              }}>
                Get Directions ↗
              </div>
            )}

            {/* Call Store */}
            {store.phone ? (
              <a
                href={`tel:${store.phone}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px 20px",
                  background: "transparent",
                  color: DEEP,
                  border: `1.5px solid ${DEEP}40`,
                  borderRadius: "12px",
                  fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "border-color 200ms, background 200ms",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = DEEP;
                  e.currentTarget.style.background = `${DEEP}08`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = `${DEEP}40`;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 2.5C2 2.5 3.5 2 4.5 4L5.5 6C5.5 6 6 7 5 7.5C4 8 3.5 8.5 4 9.5C4.5 10.5 5.5 11.5 6.5 12C7.5 12.5 8 11.5 9 10.5C10 9.5 10.5 10 11 10.5C11.5 11 12 12 12 12L12 12.5C11 13.5 9.5 14 8 13C6.5 12 4 10 2.5 8C1 6 0.5 4 2 2.5Z"
                    fill={DEEP} opacity="0.9"/>
                </svg>
                Call Store
              </a>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "13px 20px",
                background: "transparent",
                color: `${CHARCOAL}40`,
                border: `1.5px solid ${CHARCOAL}18`,
                borderRadius: "12px",
                fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                fontSize: "14px",
                fontWeight: 600,
              }}>
                Call Store
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive drawer styles */}
      <style>{`
        .es-drawer {
          top: 0;
          right: 0;
          bottom: 0;
          width: 460px;
          max-width: 95vw;
          transform: translateX(${visible ? "0" : "100%"});
          transition: transform 400ms cubic-bezier(0.22,1,0.36,1);
          border-left: 1px solid ${DEEP}18;
          box-shadow: -12px 0 48px rgba(45,45,45,0.12);
        }
        /* Mobile: bottom sheet */
        @media (max-width: 640px) {
          .es-drawer {
            top: auto;
            right: 0;
            left: 0;
            bottom: 0;
            width: 100%;
            max-width: 100%;
            max-height: 92svh;
            border-left: none;
            border-top: 1px solid ${DEEP}18;
            border-radius: 24px 24px 0 0;
            transform: translateY(${visible ? "0" : "100%"});
            box-shadow: 0 -12px 48px rgba(45,45,45,0.14);
          }
        }
      `}</style>
    </>
  );
}

// Helper: labelled info row in drawer
function DrawerRow({
  label, value, fallback, isPhone,
}: { label: string; value: string; fallback: string; isPhone?: boolean }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <p style={{
        margin: "0 0 4px",
        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: `${DEEP}80`,
      }}>
        {label}
      </p>
      {value ? (
        isPhone ? (
          <a
            href={`tel:${value}`}
            style={{
              fontFamily: "var(--font-ui,'Manrope',sans-serif)",
              fontSize: "15px",
              color: DEEP,
              fontWeight: 500,
              textDecoration: "none",
              lineHeight: 1.5,
            }}
          >
            {value}
          </a>
        ) : (
          <p style={{
            margin: 0,
            fontFamily: "var(--font-ui,'Manrope',sans-serif)",
            fontSize: "15px",
            color: CHARCOAL,
            fontWeight: 400,
            lineHeight: 1.6,
          }}>
            {value}
          </p>
        )
      ) : (
        <p style={{
          margin: 0,
          fontFamily: "var(--font-ui,'Manrope',sans-serif)",
          fontSize: "14px",
          color: `${CHARCOAL}45`,
          fontStyle: "italic",
        }}>
          {fallback}
        </p>
      )}
    </div>
  );
}

// ── Main section ───────────────────────────────────────────────────────────
export default function ExploreStores() {
  const sectionRef  = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const triggerRefs = useRef<Map<string, React.RefObject<HTMLButtonElement | null>>>(new Map());

  // Ensure trigger refs exist for each store
  STORES.forEach(s => {
    if (!triggerRefs.current.has(s.id)) {
      triggerRefs.current.set(s.id, { current: null });
    }
  });

  // Scroll-based entry
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

  const openStore = (store: Store) => setActiveStore(store);
  const closeStore = () => setActiveStore(null);

  const activeTriggerRef: React.RefObject<HTMLButtonElement | null> = activeStore
    ? (triggerRefs.current.get(activeStore.id) ?? { current: null })
    : { current: null };

  return (
    <>
      <section
        ref={sectionRef}
        id="explore-stores"
        aria-label="Explore Our Stores"
        style={{
          width: "100%",
          background: CREAM,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          paddingTop: "80px",
          paddingBottom: "80px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Wrapper */}
        <div style={{
          position: "relative",
          width: "calc(100% - clamp(36px, 5.5vw, 80px) * 2)",
          maxWidth: "1400px",
          margin: "0 auto",
        }}>

          {/* ═══════════════════════════════════════════════
              DESKTOP: 2-column grid (36 / 64)
              TABLET / MOBILE: handled via CSS
          ═══════════════════════════════════════════════ */}
          <div className="es-grid">

            {/* ─── LEFT: Copy + Location cards ─── */}
            <div
              className="es-left"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "translateY(0)" : "translateY(16px)",
                transition: reduced ? "none"
                  : `opacity 800ms ${ease}, transform 800ms ${ease}`,
              }}
            >
              {/* Eyebrow */}
              <p aria-hidden="true" style={{
                margin: "0 0 10px",
                fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                fontSize: "clamp(9px, 0.9vw, 11px)",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: DEEP,
                lineHeight: 1,
              }}>
                EXPLORE OUR STORES
              </p>

              {/* Heading */}
              <h2 style={{
                margin: "0 0 20px",
                fontFamily: "var(--font-display,'DM Serif Display',serif)",
                fontSize: "clamp(34px, 3.6vw, 54px)",
                fontWeight: 400,
                lineHeight: 1.05,
                color: CHARCOAL,
                letterSpacing: "-0.01em",
                wordBreak: "normal",
                overflowWrap: "normal",
                hyphens: "none",
              }}>
                Experience<br />Kotson In Person
              </h2>

              {/* Short copy */}
              <p style={{
                margin: "0 0 36px",
                fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                fontSize: "clamp(13px, 1.15vw, 16px)",
                fontWeight: 400,
                lineHeight: 1.65,
                color: `${CHARCOAL}80`,
                maxWidth: "340px",
              }}>
                Experience our mattresses, pillows and natural latex products in person.
                Visit a Kotson store and find the comfort that feels right for you.
              </p>

              {/* OUR STORES label */}
              <p style={{
                margin: "0 0 12px",
                fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: `${DEEP}80`,
              }}>
                OUR STORES
              </p>

              {/* Location cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "380px" }}
                className="es-cards-col"
              >
                {STORES.map(store => {
                  const ref = triggerRefs.current.get(store.id)!;
                  return (
                    <button
                      key={store.id}
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => openStore(store)}
                      aria-label={`View ${store.name} store details`}
                      className="es-card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "100%",
                        padding: "16px 18px",
                        minHeight: "76px",
                        background: "#fff",
                        border: `1px solid ${DEEP}22`,
                        borderRadius: "15px",
                        cursor: "pointer",
                        textAlign: "left",
                        boxShadow: "0 1px 6px rgba(70,112,101,0.06)",
                        transition: "border-color 200ms, background 200ms, box-shadow 200ms",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${DEEP}55`;
                        e.currentTarget.style.background = `${LEAF}06`;
                        e.currentTarget.style.boxShadow = "0 3px 14px rgba(70,112,101,0.12)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = `${DEEP}22`;
                        e.currentTarget.style.background = "#fff";
                        e.currentTarget.style.boxShadow = "0 1px 6px rgba(70,112,101,0.06)";
                      }}
                    >
                      {/* Number */}
                      <span style={{
                        flexShrink: 0,
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: `${DEEP}70`,
                        letterSpacing: "0.06em",
                        minWidth: "22px",
                      }}>
                        {store.number}
                      </span>

                      {/* Thin rule */}
                      <div style={{
                        flexShrink: 0,
                        width: "1px",
                        height: "28px",
                        background: `${DEEP}22`,
                      }} />

                      {/* Location name */}
                      <span style={{
                        flex: 1,
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "clamp(15px, 1.4vw, 17px)",
                        fontWeight: 600,
                        color: CHARCOAL,
                        wordBreak: "normal",
                        overflowWrap: "normal",
                      }}>
                        {store.name}
                      </span>

                      {/* CTA */}
                      <span className="es-card-cta" style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: DEEP,
                        letterSpacing: "0.01em",
                        transition: "transform 200ms",
                      }}>
                        View Store
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                          <path d="M2.5 6.5H10.5M10.5 6.5L7 3M10.5 6.5L7 10"
                            stroke={DEEP} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── RIGHT: Store hero image ─── */}
            <div
              className="es-right"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "translateY(0)" : "translateY(22px)",
                transition: reduced ? "none"
                  : `opacity 850ms ${ease} 120ms, transform 850ms ${ease} 120ms`,
              }}
            >
              {/* Main image container */}
              <div style={{
                width: "100%",
                aspectRatio: "16/10",
                borderRadius: "clamp(20px, 2.2vw, 32px)",
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 16px 56px rgba(45,45,45,0.13)",
              }}>
                <img
                  src="https://cdn.phototourl.com/free/2026-09-22-5f3360d1-de72-4db6-b87b-fd03e0286836.png"
                  alt="Kotson store interior featuring natural latex mattresses, pillows and product displays"
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                    userSelect: "none",
                  }}
                />
              </div>

              {/* Tagline bar below image */}
              <div style={{
                marginTop: "20px",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px 0",
                justifyContent: "space-between",
              }}>
                {/* Primary tagline */}
                <p style={{
                  margin: 0,
                  fontFamily: "var(--font-display,'DM Serif Display',serif)",
                  fontSize: "clamp(14px, 1.3vw, 18px)",
                  fontWeight: 400,
                  color: CHARCOAL,
                  letterSpacing: "0.01em",
                  fontStyle: "italic",
                }}>
                  Feel it. Try it. Find your comfort.
                </p>

                {/* Micro benefits */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flexWrap: "wrap",
                }}>
                  {[
                    "Feel the natural comfort",
                    "Get expert guidance",
                    "Explore the complete range",
                  ].map((benefit, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {i > 0 && (
                        <span style={{
                          color: `${DEEP}50`,
                          fontSize: "10px",
                          lineHeight: 1,
                        }}>•</span>
                      )}
                      <span style={{
                        fontFamily: "var(--font-ui,'Manrope',sans-serif)",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: `${CHARCOAL}65`,
                        whiteSpace: "nowrap",
                      }}>
                        {benefit}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>{/* /es-grid */}
        </div>{/* /wrapper */}

        {/* Responsive CSS */}
        <style>{`
          /* ── Grid ── */
          .es-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 36px;
            align-items: center;
          }
          .es-left  { order: 1; }
          .es-right { order: 2; }

          /* Tablet: keep stacked but image first then cards */
          @media (max-width: 767px) {
            .es-left  { order: 2; }
            .es-right { order: 1; }

            #explore-stores {
              padding-top: 56px !important;
              padding-bottom: 56px !important;
            }
          }

          /* Tablet ≥ 768px: single column with image leading */
          @media (min-width: 768px) and (max-width: 1023px) {
            .es-grid {
              gap: 40px;
            }
            .es-left  { order: 2; }
            .es-right { order: 1; }

            /* Cards row on tablet */
            .es-cards-col {
              flex-direction: row !important;
              max-width: 100% !important;
            }
            .es-cards-col .es-card {
              flex: 1;
              max-width: none;
            }
          }

          /* Desktop ≥ 1024px: 2-column */
          @media (min-width: 1024px) {
            .es-grid {
              grid-template-columns: minmax(300px, 0.36fr) minmax(0, 0.64fr);
              gap: clamp(48px, 5.5vw, 72px);
            }
            .es-left  { order: 1; }
            .es-right { order: 2; }
          }

          /* Card hover arrow nudge */
          .es-card:hover .es-card-cta {
            transform: translateX(4px);
          }
          .es-card:focus-visible {
            outline: 2px solid ${DEEP};
            outline-offset: 2px;
          }

          /* Mobile store image: natural AR */
          @media (max-width: 480px) {
            #explore-stores .es-right > div:first-child {
              aspect-ratio: auto !important;
            }
            #explore-stores .es-right > div:first-child img {
              aspect-ratio: 4/3;
              width: 100%;
              height: auto;
            }
          }

          /* Global word-break guard */
          #explore-stores * {
            word-break:    normal !important;
            overflow-wrap: normal !important;
            hyphens:       none   !important;
          }
        `}</style>
      </section>

      {/* Drawer / Bottom Sheet */}
      <StoreDrawer
        store={activeStore}
        triggerRef={activeTriggerRef}
        onClose={closeStore}
      />
    </>
  );
}
