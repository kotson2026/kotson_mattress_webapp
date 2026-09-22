import { memo } from "react";

// Kotson Section 2 — Scrolling Announcement Ribbon ("Sleep Ribbon")
// Specifications:
// - Height: Desktop 68px (64–72px), Tablet 60px (58–64px), Mobile 54px (50–56px).
// - Font Size: Desktop 22px (20–24px), Tablet 19px (18–20px), Mobile 16px (15–17px).
// - Letter Spacing: 0.05em (0.04em–0.07em).
// - Separator ✦: Desktop 11px (10–12px), Mobile 9px (8–10px), opacity 0.75.
// - Spacing: ~32px between text and separator (desktop mx-8), ~24px mobile (mx-6).
// - Marquee Speed: 40s linear infinite (calm editorial movement).
// - Normal document-flow section immediately after hero ends; zero gap, zero overlap.

const MESSAGES = ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"] as const;

function RibbonTrackContent() {
  return (
    <div className="flex shrink-0 items-center">
      {/* Repeat the 3 items 2 times per half for seamless coverage across any screen resolution */}
      {[0, 1].map((setIdx) => (
        <div key={setIdx} className="flex shrink-0 items-center">
          {MESSAGES.map((msg) => (
            <span key={msg} className="inline-flex items-center">
              <span className="font-ui font-semibold uppercase tracking-[0.07em] text-[13px] sm:text-[14px] lg:text-[15px] text-brand-cream">
                {msg}
              </span>
              <span
                className="mx-5 sm:mx-6 lg:mx-7 text-[8px] sm:text-[8px] lg:text-[9px] text-brand-sand/75 opacity-75 select-none leading-none"
                aria-hidden="true"
              >
                ✦
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SleepRibbon() {
  return (
    <section
      aria-label="Kotson Promises"
      data-testid="sleep-ribbon"
      className="group relative w-full block m-0 p-0 overflow-hidden bg-brand-deep h-[38px] sm:h-[42px] lg:h-[46px] flex items-center select-none"
    >
      {/* Accessible text representation for screen readers (read once) */}
      <p className="sr-only">100% Organic. Free Shipping. Chemical Free.</p>

      {/* Embedded CSS for hardware-accelerated continuous translate3d marquee */}
      <style>{`
        @keyframes kotson-ribbon-slide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-kotson-ribbon {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: kotson-ribbon-slide 40s linear infinite;
        }
        @media (hover: hover) {
          .group:hover .animate-kotson-ribbon {
            animation-duration: 55s;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-kotson-ribbon {
            animation: none !important;
            width: 100% !important;
            justify-content: space-around !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Visual continuous marquee track (hidden from assistive technology) */}
      <div
        className="animate-kotson-ribbon items-center pointer-events-none"
        aria-hidden="true"
      >
        {/* Track A */}
        <RibbonTrackContent />
        {/* Track B (identical duplicate for seamless 0% -> -50% loop) */}
        <RibbonTrackContent />
      </div>
    </section>
  );
}

export default memo(SleepRibbon);
