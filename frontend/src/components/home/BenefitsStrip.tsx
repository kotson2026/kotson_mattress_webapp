import { memo } from "react";

/* ─────────────────────────────────────────────────────────────────
   KOTSON — PRODUCT BENEFITS SCROLLER RIBBON
   • Pure lightweight continuous horizontal marquee
   • Track A & Track B generated from unified KOTSON_BENEFITS array
   • Authentic original SVG assets stored in /icons/benefits/
   • Subtle hover micro-interactions (icon 1.06 scale, green text shift)
   • Responsive heights: 58px mobile, 62px tablet, 66px desktop
   • Accessible: prefers-reduced-motion & aria-hidden on Track B
───────────────────────────────────────────────────────────────── */

export interface BenefitItem {
  name: string;
  icon: string;
}

export const KOTSON_BENEFITS: BenefitItem[] = [
  {
    name: "Reverse Pressure",
    icon: "/icons/benefits/Reverse_pressure.svg",
  },
  {
    name: "Hypoallergenic",
    icon: "/icons/benefits/Hypo_Allergic_002.svg",
  },
  {
    name: "Orthopedic Support",
    icon: "/icons/benefits/Orthopedic_support.svg",
  },
  {
    name: "Temperature Balance",
    icon: "/icons/benefits/Temperature_Balance.svg",
  },
  {
    name: "Motion Isolation",
    icon: "/icons/benefits/Motion_Isolation0.svg",
  },
  {
    name: "Sustainable",
    icon: "/icons/benefits/Sustainable.svg",
  },
];

interface TrackProps {
  isDuplicate?: boolean;
}

const BenefitsTrack = memo(function BenefitsTrack({ isDuplicate = false }: TrackProps) {
  return (
    <div
      className={`benefits-track-segment flex items-center shrink-0 ${isDuplicate ? "benefits-track-duplicate" : ""}`}
      aria-hidden={isDuplicate ? "true" : undefined}
    >
      {KOTSON_BENEFITS.map((item, idx) => (
        <div key={`${item.name}-${idx}`} className="flex items-center shrink-0">
          <div className="group/item flex items-center shrink-0 cursor-default select-none px-5 sm:px-7 lg:px-9 py-2">
            {/* SVG Icon Container */}
            <div className="flex items-center justify-center shrink-0 h-6 w-6 sm:h-7 sm:w-7 lg:h-[30px] lg:w-[30px] mr-3 sm:mr-3.5">
              <img
                src={item.icon}
                alt={isDuplicate ? "" : item.name}
                aria-hidden={isDuplicate ? "true" : undefined}
                className="max-h-full max-w-full w-auto h-auto object-contain block transition-transform duration-250 ease-out group-hover/item:scale-[1.06]"
                loading="eager"
                decoding="async"
              />
            </div>

            {/* Benefit Label */}
            <span className="font-ui text-[13px] sm:text-[14px] lg:text-[15px] font-medium text-[#2D2D2D] tracking-[0.01em] whitespace-nowrap transition-colors duration-250 ease-out group-hover/item:text-[#467065]">
              {item.name}
            </span>
          </div>

          {/* Vertical Divider */}
          <div
            className="w-px h-6 sm:h-7 lg:h-8 bg-[#E5E0D5]/90 shrink-0"
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
});

export default function BenefitsStrip() {
  return (
    <section
      aria-label="Kotson Mattress Benefits"
      className="benefits-ribbon-container relative w-full overflow-hidden bg-[#FAF8F5] border-t border-b border-[#E5E0D5] h-[58px] sm:h-[62px] lg:h-[66px] flex items-center select-none"
    >
      {/* Screen Reader Summary */}
      <p className="sr-only">
        Key Kotson benefits: Reverse Pressure, Hypoallergenic, Orthopedic Support, Temperature Balance, Motion Isolation, Sustainable.
      </p>

      {/* Edge Fade Masks for visual polish */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to right, #FAF8F5 0%, transparent 6%, transparent 94%, #FAF8F5 100%)",
        }}
      />

      {/* Marquee Track Container (Track A + Track B) */}
      <div className="benefits-marquee-slider flex items-center shrink-0 w-max">
        {/* Track A (Primary semantic track) */}
        <BenefitsTrack isDuplicate={false} />

        {/* Track B (Identical visual duplicate for seamless infinite loop) */}
        <BenefitsTrack isDuplicate={true} />
      </div>

      {/* Hardware-accelerated Marquee Styles & Reduced Motion Support */}
      <style>{`
        .benefits-marquee-slider {
          animation: kotson-benefits-marquee 32s linear infinite;
          will-change: transform;
        }

        @keyframes kotson-benefits-marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }

        /* Accessible Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          .benefits-marquee-slider {
            animation: none !important;
            transform: none !important;
          }
          .benefits-ribbon-container {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .benefits-ribbon-container::-webkit-scrollbar {
            display: none;
          }
          .benefits-track-duplicate {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}
