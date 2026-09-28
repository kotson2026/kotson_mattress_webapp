import { Phone, Whatsapp } from "@/lib/lucide-react";
import {
  useCustomerSupport,
  getTelUrl,
  getWhatsAppUrl,
  getHomepageWhatsAppMessage,
  formatPhoneDisplay,
  trackSupportClick,
} from "@/lib/support";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON HOMEPAGE CUSTOMER SUPPORT CTA ("NEED HELP CHOOSING?")
   - Editorial, minimal, compact Kotson support section
   - Position: Naturally integrated on the homepage (Section ID: #need-help)
   - Background: Clean warm cream/ivory (#F7F4EE)
   - Centered hierarchy:
       Eyebrow: ─── SUPPORT & ASSISTANCE ───
       Heading: Need Help Choosing?
       Subheading: Our team can help you find the right Kotson product for your needs.
       Actions: [ Call Us  (80098 00936) ]  [ WhatsApp Us ]
   ───────────────────────────────────────────────────────────────────────── */

interface CustomerSupportCtaProps {
  config?: {
    eyebrow?: string;
    heading?: string;
    subheading?: string;
  };
}

export default function CustomerSupportCta({ config }: CustomerSupportCtaProps) {
  const support = useCustomerSupport();

  // Support heading & copy, respecting CMS if customized
  const heading =
    config?.heading && config.heading !== "NEED HELP CHOOSING?"
      ? config.heading
      : "Need Help Choosing?";

  const subheading =
    config?.subheading ||
    "Our team can help you find the right Kotson product for your needs.";

  const telUrl = getTelUrl(support.canonicalPhone);
  const waUrl = getWhatsAppUrl(
    support.cleanWhatsAppNumber,
    getHomepageWhatsAppMessage()
  );
  const displayPhone = formatPhoneDisplay(support.phone);

  // If both call and WhatsApp are disabled by Owner Admin, safely return null
  if (!support.phoneEnabled && !support.whatsappEnabled) {
    return null;
  }

  return (
    <section
      id="need-help"
      aria-label="Support & Assistance"
      className="relative w-full bg-[#F7F4EE] border-t border-[#EAE4D9]/80 py-10 sm:py-12 md:py-14 select-none scroll-mt-20 overflow-hidden"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Centered Content Container */}
        <div className="mx-auto max-w-2xl sm:max-w-3xl flex flex-col items-center text-center">
          {/* Top Eyebrow */}
          <div
            className="flex items-center justify-center gap-3 mb-3.5 sm:mb-4"
            aria-label="Support and Assistance"
          >
            <span
              className="w-8 sm:w-12 h-px bg-[#7C9C59]/40"
              aria-hidden="true"
            />
            <span className="font-ui text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#7C9C59]">
              SUPPORT &amp; ASSISTANCE
            </span>
            <span
              className="w-8 sm:w-12 h-px bg-[#7C9C59]/40"
              aria-hidden="true"
            />
          </div>

          {/* Heading */}
          <h2 className="font-display text-2xl sm:text-3xl lg:text-[38px] font-normal text-[#163D32] tracking-tight leading-[1.18]">
            {heading}
          </h2>

          {/* Description */}
          <p className="mt-2.5 sm:mt-3 font-ui text-sm sm:text-[15px] text-[#6B716C] leading-relaxed max-w-lg sm:max-w-xl mx-auto">
            {subheading}
          </p>

          {/* Contact Action Buttons */}
          <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* CALL BUTTON */}
            {support.phoneEnabled && (
              <a
                href={telUrl}
                onClick={() => trackSupportClick("call", "homepage")}
                aria-label={`Call Us at ${support.phone}`}
                className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 min-h-[46px] sm:min-h-[48px] rounded-full bg-transparent border border-[#467065]/60 hover:border-[#467065] hover:bg-[#7C9C59]/10 text-[#163D32] font-ui text-sm tracking-normal shadow-2xs transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#467065] focus-visible:ring-offset-2 cursor-pointer"
                data-testid="homepage-support-call-btn"
              >
                <Phone className="w-4 h-4 text-[#163D32] shrink-0" aria-hidden="true" />
                <span className="font-medium sm:font-semibold text-[#163D32]">Call Us</span>
                <span className="text-[#6B716C] font-normal text-xs sm:text-sm">
                  ({displayPhone})
                </span>
              </a>
            )}

            {/* WHATSAPP BUTTON */}
            {support.whatsappEnabled && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSupportClick("whatsapp", "homepage")}
                aria-label="WhatsApp Us"
                className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-8 min-h-[46px] sm:min-h-[48px] rounded-full bg-[#163D32] hover:bg-[#112F26] motion-safe:hover:-translate-y-0.5 text-white font-ui text-sm font-semibold tracking-normal shadow-xs hover:shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163D32] focus-visible:ring-offset-2 cursor-pointer"
                data-testid="homepage-support-whatsapp-btn"
              >
                <Whatsapp className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
                <span>WhatsApp Us</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


