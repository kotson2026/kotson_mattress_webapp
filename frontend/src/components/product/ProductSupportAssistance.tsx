import { Phone, Whatsapp } from "@/lib/lucide-react";
import {
  useCustomerSupport,
  getTelUrl,
  getWhatsAppUrl,
  getPdpWhatsAppMessage,
  getCustomizerWhatsAppMessage,
  trackSupportClick,
} from "@/lib/support";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON COMPACT PRODUCT & CUSTOMIZER ASSISTANCE BLOCK
   - Mode 'pdp': "Need help choosing the right size?"
   - Mode 'customizer': "Not sure about the measurements? Our team can help you get it right."
   - Compact, non-intrusive, preserves customer input state
   - External links use target="_blank" rel="noopener noreferrer"
   ───────────────────────────────────────────────────────────────────────── */

interface ProductSupportAssistanceProps {
  mode?: "pdp" | "customizer";
  productName?: string;
  productId?: string;
  className?: string;
}

export default function ProductSupportAssistance({
  mode = "pdp",
  productName,
  productId,
  className = "",
}: ProductSupportAssistanceProps) {
  const support = useCustomerSupport();

  if (!support.phoneEnabled && !support.whatsappEnabled) {
    return null;
  }

  const isCustomizer = mode === "customizer";
  const title = isCustomizer
    ? "Not sure about the measurements?"
    : "Need help choosing the right size?";
  const subtitle = isCustomizer
    ? "Our team can help you get it right."
    : "Our sleep team can guide your selection.";

  const telUrl = getTelUrl(support.canonicalPhone);
  const waMessage = isCustomizer
    ? getCustomizerWhatsAppMessage(productName)
    : getPdpWhatsAppMessage(productName);
  const waUrl = getWhatsAppUrl(support.cleanWhatsAppNumber, waMessage);

  return (
    <div
      className={`rounded-xl border border-[#E8E2D5] bg-[#FAF8F5]/80 p-3 sm:p-3.5 transition-colors ${className}`}
      data-testid={`support-assistance-${mode}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Helper copy */}
        <div className="min-w-0 flex-1">
          <p className="font-ui text-xs font-semibold text-[#1B382B]">
            {title}
          </p>
          <p className="font-ui text-[11px] text-[#5C6656] mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        </div>

        {/* Compact action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1. Call Us */}
          {support.phoneEnabled && (
            <a
              href={telUrl}
              onClick={() =>
                trackSupportClick("call", mode, { productId, productName })
              }
              aria-label={`Call Kotson customer support at ${support.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-white border border-[#D5CEBF] text-[#1B382B] font-ui text-xs font-medium hover:bg-[#F2F6ED] hover:border-[#7C9C59] hover:-translate-y-0.5 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#557B42] motion-reduce:transform-none cursor-pointer"
              data-testid={`support-call-${mode}`}
            >
              <Phone className="w-3.5 h-3.5 text-[#557B42]" />
              <span>Call us</span>
            </a>
          )}

          {/* Separator if both enabled */}
          {support.phoneEnabled && support.whatsappEnabled && (
            <span className="text-[#D5CEBF] select-none text-xs" aria-hidden="true">
              |
            </span>
          )}

          {/* 2. WhatsApp Us */}
          {support.whatsappEnabled && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackSupportClick("whatsapp", mode, { productId, productName })
              }
              aria-label="Chat with Kotson customer support on WhatsApp"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#1B382B] text-white font-ui text-xs font-medium hover:bg-[#142C21] hover:-translate-y-0.5 shadow-2xs hover:shadow-xs transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1B382B] motion-reduce:transform-none cursor-pointer"
              data-testid={`support-whatsapp-${mode}`}
            >
              <Whatsapp className="w-3.5 h-3.5 text-white/95" />
              <span>WhatsApp us</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
