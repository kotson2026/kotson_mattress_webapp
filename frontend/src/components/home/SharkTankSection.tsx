import { useRef, useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON × SHARK TANK INDIA
   Unified Premium Ivory Panel:
   - Eyebrow: ────── AS SEEN ON ──────
   - Left: Final square Shark Tank artwork (1024x1024, approx 1fr width on desktop)
   - Right: Direct responsive 16:9 YouTube video embed (xF_ri6AQJMo, approx 2fr width)
   - Both media containers have exactly equal height on desktop/tablet.
   - Mobile stacks artwork 1:1 above video 16:9 with compact 12px gap.
   - Bottom caption: ────── KOTSON × SHARK TANK INDIA ──────
   ───────────────────────────────────────────────────────────────────────── */

const DEFAULT_POSTER = "/shark-tank/kotson-shark-tank-square.webp";
const LOCAL_POSTER_FALLBACK = "/shark-tank/kotson-shark-tank-square.jpg";
const DEFAULT_VIDEO_ID = "xF_ri6AQJMo";
const DEFAULT_EYEBROW = "AS SEEN ON";
const DEFAULT_CAPTION = "KOTSON × SHARK TANK INDIA";

// Kotson brand palette
const LEAF = "#7C9C59";
const CREAM = "#FAF8F5";

/**
 * Safely extracts an 11-character YouTube video ID from various URL formats
 * or raw ID strings. Defaults to xF_ri6AQJMo.
 */
export function extractYouTubeId(input: string | undefined | null): string {
  if (!input || typeof input !== "string") return DEFAULT_VIDEO_ID;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (match && match[1]) return match[1];
  return DEFAULT_VIDEO_ID;
}

export interface SharkTankConfig {
  banner_url?: string;
  poster_url?: string;
  video_url?: string;
  youtube_url?: string;
  eyebrow?: string;
  caption?: string;
  is_visible?: boolean;
}

interface SharkTankProps {
  config?: SharkTankConfig;
}

export default function SharkTankSection({ config }: SharkTankProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [entered, setEntered] = useState(false);

  // Configuration with safe fallbacks
  const posterUrl = config?.poster_url || config?.banner_url || DEFAULT_POSTER;
  const [posterSrc, setPosterSrc] = useState(posterUrl);

  useEffect(() => {
    setPosterSrc(posterUrl);
  }, [posterUrl]);

  const rawVideo = config?.youtube_url || config?.video_url;
  const videoId = extractYouTubeId(rawVideo);
  const eyebrowText = (config?.eyebrow || DEFAULT_EYEBROW).toUpperCase();
  const captionText = (config?.caption || DEFAULT_CAPTION).toUpperCase();

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Section entrance animation ───────────────────────────────────── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="shark-tank"
      aria-label="Kotson on Shark Tank India"
      className="w-full relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, #E6EBE1 0%, #DDE4D6 50%, #D3DDD1 100%)`,
        paddingTop: "24px",
        paddingBottom: "24px",
      }}
    >
      <style>{`
        .shark-tank-poster {
          width: 100%;
          height: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          object-position: center;
          display: block;
        }
      `}</style>

      {/* Subtle organic green radial accent */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background:
            `radial-gradient(ellipse 60% 45% at 50% 50%, ${LEAF}12 0%, transparent 70%),` +
            `radial-gradient(ellipse 40% 30% at 20% 20%, ${CREAM}60 0%, transparent 50%)`,
          opacity: entered ? 1 : 0,
        }}
      />

      <div className="relative w-full max-w-[1100px] mx-auto px-4 sm:px-6">
        {/* ── ONE UNIFIED PREMIUM IVORY PANEL ───────────────────────────── */}
        <div
          className="w-full rounded-2xl sm:rounded-3xl border border-[#E3DDCF]/90 bg-[#FAF7F0] p-4 sm:p-5 lg:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all duration-700"
          style={{
            opacity: entered ? 1 : 0,
            transform: entered || reduced ? "translateY(0)" : "translateY(14px)",
          }}
          data-testid="shark-tank-unified-panel"
        >
          {/* Eyebrow: ────── AS SEEN ON ────── */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3.5 sm:mb-4 select-none">
            <div className="flex-1 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] h-[1px] bg-brand-charcoal/20" />
            <span
              className="font-ui text-[9.5px] sm:text-[11px] font-bold tracking-[0.28em] text-[#467065] uppercase"
              data-testid="shark-tank-eyebrow"
            >
              {eyebrowText}
            </span>
            <div className="flex-1 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] h-[1px] bg-brand-charcoal/20" />
          </div>

          {/* Media Row: Left Artwork (approx 1fr) + Right YouTube (approx 2fr) */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 md:gap-3.5 lg:gap-4 w-full items-stretch">
            {/* ── LEFT: Shark Tank Square Artwork ──────────────────────── */}
            <div
              className="w-full aspect-square h-full rounded-xl overflow-hidden relative border border-black/[0.04] bg-[#16241C]/5 shadow-xs"
              data-testid="shark-tank-artwork-container"
            >
              {posterSrc.includes("kotson-shark-tank-square") ? (
                <picture className="w-full h-full block">
                  <source srcSet="/shark-tank/kotson-shark-tank-square.webp" type="image/webp" />
                  <img
                    src={LOCAL_POSTER_FALLBACK}
                    alt="Kotson Mattress featured on Shark Tank India Season 5"
                    loading="lazy"
                    decoding="async"
                    width={1024}
                    height={1024}
                    draggable={false}
                    className="shark-tank-poster"
                    style={{
                      width: "100%",
                      height: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      objectPosition: "center",
                      display: "block",
                    }}
                    data-testid="shark-tank-poster"
                  />
                </picture>
              ) : (
                <img
                  src={posterSrc}
                  alt="Kotson Mattress featured on Shark Tank India Season 5"
                  loading="lazy"
                  decoding="async"
                  width={1024}
                  height={1024}
                  draggable={false}
                  onError={() => {
                    if (posterSrc !== LOCAL_POSTER_FALLBACK) {
                      setPosterSrc(LOCAL_POSTER_FALLBACK);
                    }
                  }}
                  className="shark-tank-poster"
                  style={{
                    width: "100%",
                    height: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    objectPosition: "center",
                    display: "block",
                  }}
                  data-testid="shark-tank-poster"
                />
              )}
            </div>

            {/* ── RIGHT: Direct Responsive YouTube Video Embed ──────────── */}
            <div
              className="w-full aspect-video md:aspect-auto h-full rounded-xl overflow-hidden bg-[#16241C] shadow-xs relative"
              data-testid="shark-tank-player-container"
            >
              <iframe
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
                title="Kotson Mattress featured on Shark Tank India Season 5"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0 block"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  display: "block",
                }}
                data-testid="shark-tank-iframe"
              />
            </div>
          </div>

          {/* Bottom Caption: ────── KOTSON × SHARK TANK INDIA ────── */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 mt-3.5 sm:mt-4 select-none">
            <div className="flex-1 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] h-[1px] bg-brand-charcoal/20" />
            <p
              className="font-ui text-[8.5px] sm:text-[10px] font-semibold tracking-[0.24em] uppercase text-brand-charcoal/50 text-center m-0 select-none"
              data-testid="shark-tank-caption"
            >
              {captionText}
            </p>
            <div className="flex-1 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] h-[1px] bg-brand-charcoal/20" />
          </div>
        </div>
      </div>
    </section>
  );
}
