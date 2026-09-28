import { useState, useRef, useEffect } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON CUSTOMER TESTIMONIALS SECTION
   - Position: Directly after "Explore Our Store" on the homepage.
   - Background: Exact approved Kotson botanical mattress image.
   - Headline: "Customer Testimonials" with "REAL STORIES" eyebrow.
   - Content: Factual, authentic YouTube video testimonials (no fabricated data).
   - Layout:
       • Desktop (>=1024px): 3 equal-width 16:9 cards in 1 horizontal row.
       • Tablet & Mobile (<1024px): Responsive carousel with swipe & indicators.
   - Performance: Lightweight thumbnail facade with inline on-demand playback.
   - Playback: Single-active video rule (stops overlapping audio).
   ───────────────────────────────────────────────────────────────────────── */

export interface TestimonialItem {
  id: string;
  type: "youtube";
  videoId: string;
  embedUrl: string;
  enabled: boolean;
  sortOrder: number;
  title?: string;
  thumbnailUrl?: string;
}

export const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "testimonial-1",
    type: "youtube",
    videoId: "joOvNmYvnF4",
    embedUrl: "https://www.youtube.com/embed/joOvNmYvnF4",
    enabled: true,
    sortOrder: 1,
    title: "Sheetal review on kotsonmattress",
  },
  {
    id: "testimonial-2",
    type: "youtube",
    videoId: "jc6twmIkXl4",
    embedUrl: "https://www.youtube.com/embed/jc6twmIkXl4?si=URGVS-uATgytLol6",
    enabled: true,
    sortOrder: 2,
    title: "Saritha physiotherapist review on kotsonmattress",
  },
  {
    id: "testimonial-3",
    type: "youtube",
    videoId: "ohottknzBWA",
    embedUrl: "https://www.youtube.com/embed/ohottknzBWA?si=DnRScqcur8bZ8Tc8",
    enabled: true,
    sortOrder: 3,
    title: "Mrs Ekta review on kotsonmattress",
  },
];

export function extractYouTubeId(urlOrId?: string | null): string {
  if (!urlOrId || typeof urlOrId !== "string") return "";
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : "";
}

interface CustomerTestimonialsProps {
  config?: {
    eyebrow?: string;
    heading?: string;
    subheading?: string;
    testimonials?: TestimonialItem[];
    background_url?: string;
  };
}

export default function CustomerTestimonials({ config }: CustomerTestimonialsProps) {
  const eyebrow = config?.eyebrow || "REAL STORIES";
  const heading = config?.heading || "Customer Testimonials";
  const subheading =
    config?.subheading ||
    "Hear what our customers have to say about their Kotson sleep experience.";

  const rawTestimonials = config?.testimonials && config.testimonials.length > 0
    ? config.testimonials
    : DEFAULT_TESTIMONIALS;

  const activeTestimonials = rawTestimonials
    .filter((t) => t.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  
  // Mobile index: 0 .. n-1 (1 card per view)
  const [mobileIndex, setMobileIndex] = useState(0);
  // Tablet index: 0 .. n-2 (2 cards per view)
  const [tabletIndex, setTabletIndex] = useState(0);

  // Touch handling for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped left -> next
        setMobileIndex((prev) => Math.min(prev + 1, activeTestimonials.length - 1));
      } else {
        // Swiped right -> prev
        setMobileIndex((prev) => Math.max(prev - 1, 0));
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Mobile navigation
  const handleMobilePrev = () => {
    setMobileIndex((prev) => Math.max(prev - 1, 0));
  };
  const handleMobileNext = () => {
    setMobileIndex((prev) => Math.min(prev + 1, activeTestimonials.length - 1));
  };

  // Tablet navigation (2 cards visible at a time)
  const maxTabletIndex = Math.max(0, activeTestimonials.length - 2);
  const handleTabletPrev = () => {
    setTabletIndex((prev) => Math.max(prev - 1, 0));
  };
  const handleTabletNext = () => {
    setTabletIndex((prev) => Math.min(prev + 1, maxTabletIndex));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      handleMobilePrev();
      handleTabletPrev();
    }
    if (e.key === "ArrowRight") {
      handleMobileNext();
      handleTabletNext();
    }
  };

  // Reset indices if testimonials change
  useEffect(() => {
    if (mobileIndex >= activeTestimonials.length) {
      setMobileIndex(Math.max(0, activeTestimonials.length - 1));
    }
    if (tabletIndex > maxTabletIndex) {
      setTabletIndex(maxTabletIndex);
    }
  }, [activeTestimonials.length, mobileIndex, tabletIndex, maxTabletIndex]);

  // Video card renderer with lazy thumbnail facade & on-demand inline player
  const renderVideoCard = (item: TestimonialItem, index: number) => {
    const videoId = extractYouTubeId(item.videoId || item.embedUrl);
    const isPlaying = activeVideoId === videoId;

    return (
      <div
        key={item.id || index}
        className="group relative w-full aspect-video rounded-2xl overflow-hidden bg-black/10 border border-[#D5CEBF]/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_32px_rgba(27,56,43,0.12)] hover:border-[#7C9C59]/80 hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none"
        data-testid={`testimonial-card-${index}`}
      >
        {isPlaying ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={item.title || `Kotson customer testimonial ${index + 1}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            {/* YouTube HQ Thumbnail */}
            <img
              src={item.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt={item.title || `Kotson Customer Testimonial ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none"
              loading="lazy"
            />

            {/* Subtle contrast gradient for play button clarity */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent transition-opacity group-hover:opacity-90"
              aria-hidden="true"
            />

            {/* Minimalist Centered Play Button */}
            <button
              type="button"
              onClick={() => setActiveVideoId(videoId)}
              aria-label={`Play testimonial ${index + 1}`}
              className="absolute inset-0 m-auto w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white/95 text-[#1B382B] shadow-md flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:text-[#557B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557B42] focus-visible:ring-offset-2 motion-reduce:transform-none"
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      id="testimonials"
      className="testimonials-section relative w-full overflow-hidden bg-[#FAF7F0] bg-cover bg-no-repeat transition-colors select-none flex flex-col justify-center"
      style={{
        backgroundImage: `url('${config?.background_url || "https://cdn.phototourl.com/member/2026-09-26-af7dc6e9-091c-496e-ad79-c5638c2915e1.png"}')`,
        backgroundPosition: "center center",
      }}
      aria-label="Customer Testimonials"
      onKeyDown={handleKeyDown}
    >
      {/* ── Exact Spec Styles: Desktop ~540px, Tablet ~500px, Mobile auto ── */}
      <style>{`
        .testimonials-section {
          min-height: unset !important;
          height: auto !important;
          padding: 64px 24px 56px;
        }

        .testimonials-heading {
          margin-bottom: 12px;
        }

        .testimonials-description {
          margin-bottom: 38px;
        }

        .testimonials-grid {
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .testimonials-section {
            padding: 52px 20px 48px;
          }
        }

        @media (max-width: 768px) {
          .testimonials-section {
            padding: 44px 16px 40px;
          }

          .testimonials-description {
            margin-bottom: 28px;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl w-full">
        {/* ── UPPER HEADING BLOCK ── */}
        <div className="text-center max-w-2xl mx-auto px-2">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3 mb-2.5">
            <span className="h-px w-6 sm:w-14 bg-[#7C9C59]/40 flex-none" aria-hidden="true" />
            <span className="font-ui text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#557B42]">
              {eyebrow}
            </span>
            <span className="h-px w-6 sm:w-14 bg-[#7C9C59]/40 flex-none" aria-hidden="true" />
          </div>

          {/* Main Storytelling Heading */}
          <h2 className="testimonials-heading font-serif text-2xl sm:text-3xl lg:text-[40px] font-normal text-[#1B382B] tracking-tight leading-tight">
            {heading}
          </h2>

          {/* Factual Supporting Copy */}
          <p className="testimonials-description font-ui text-xs sm:text-sm lg:text-base text-[#4A5568] leading-relaxed max-w-lg mx-auto">
            {subheading}
          </p>
        </div>

        {/* ── 1. DESKTOP VIDEO ROW (>= 1024px) ── */}
        <div
          className="testimonials-grid hidden lg:grid lg:grid-cols-3 max-w-5xl mx-auto items-center"
          data-testid="desktop-testimonials-row"
        >
          {activeTestimonials.map((item, index) => renderVideoCard(item, index))}
        </div>

        {/* ── 2. TABLET VIDEO CAROUSEL (640px - 1023px) ── */}
        {/* Shows 2 testimonial cards at a time with smooth navigation */}
        <div
          className="hidden sm:block lg:hidden relative max-w-3xl mx-auto px-2"
          data-testid="tablet-testimonials-carousel"
        >
          <div className="grid grid-cols-2 gap-5 items-center">
            {activeTestimonials
              .slice(tabletIndex, tabletIndex + 2)
              .map((item, relIdx) => renderVideoCard(item, tabletIndex + relIdx))}
          </div>

          {/* Tablet Controls & Indicators if more than 2 items */}
          {activeTestimonials.length > 2 && (
            <div className="mt-6 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={handleTabletPrev}
                disabled={tabletIndex === 0}
                aria-label="Previous testimonials"
                className="w-10 h-10 rounded-full bg-white/95 border border-[#E5E0D8] shadow-sm text-[#1B382B] hover:text-[#557B42] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557B42]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2" role="tablist" aria-label="Tablet testimonial slides">
                {Array.from({ length: maxTabletIndex + 1 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={tabletIndex === idx}
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => setTabletIndex(idx)}
                    className="h-6 flex items-center justify-center p-1 focus-visible:outline-none"
                  >
                    <span
                      className={`block h-1.5 transition-all duration-300 rounded-full ${
                        tabletIndex === idx
                          ? "w-8 bg-[#1B382B]"
                          : "w-3.5 bg-[#D2CBBF] hover:bg-[#B5ADA0]"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleTabletNext}
                disabled={tabletIndex >= maxTabletIndex}
                aria-label="Next testimonials"
                className="w-10 h-10 rounded-full bg-white/95 border border-[#E5E0D8] shadow-sm text-[#1B382B] hover:text-[#557B42] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557B42]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* ── 3. MOBILE VIDEO CAROUSEL (< 640px) ── */}
        {/* Shows 1 testimonial card per viewport with horizontal swipe */}
        <div
          className="sm:hidden relative w-full max-w-[320px] mx-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          data-testid="mobile-testimonials-carousel"
        >
          {activeTestimonials.length > 0 && (
            <div className="relative w-full">
              {renderVideoCard(
                activeTestimonials[mobileIndex] || activeTestimonials[0],
                mobileIndex
              )}
            </div>
          )}

          {/* Mobile Controls & Indicators */}
          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleMobilePrev}
              disabled={mobileIndex === 0}
              aria-label="Previous testimonial"
              className="w-9 h-9 rounded-full bg-white/95 border border-[#E5E0D8] shadow-sm text-[#1B382B] hover:text-[#557B42] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557B42]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5" role="tablist" aria-label="Mobile testimonial slides">
              {activeTestimonials.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={mobileIndex === idx}
                  aria-label={`Go to testimonial ${idx + 1}`}
                  onClick={() => setMobileIndex(idx)}
                  className="h-6 flex items-center justify-center px-0.5 focus-visible:outline-none"
                >
                  <span
                    className={`block h-1.5 transition-all duration-300 rounded-full ${
                      mobileIndex === idx
                        ? "w-7 bg-[#1B382B]"
                        : "w-3 bg-[#D2CBBF] hover:bg-[#B5ADA0]"
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleMobileNext}
              disabled={mobileIndex === activeTestimonials.length - 1}
              aria-label="Next testimonial"
              className="w-9 h-9 rounded-full bg-white/95 border border-[#E5E0D8] shadow-sm text-[#1B382B] hover:text-[#557B42] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557B42]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
