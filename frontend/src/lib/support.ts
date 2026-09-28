import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON CENTRAL AUTHORITATIVE CUSTOMER SUPPORT CONFIGURATION
   - Canonical Support Contact: 8009800936 (+91 8009800936)
   - One source of truth for:
       1. Global Chatbot / Support launcher
       2. Homepage Support CTA ("NEED HELP CHOOSING?")
       3. Product Detail Page (PDP) Assistance
       4. Customizable Products Measurement Assistance
   - wa.me standard format: https://wa.me/918009800936?text=...
   ───────────────────────────────────────────────────────────────────────── */

export interface CustomerSupportConfig {
  phone: string;
  countryCode: string;
  canonicalPhone: string;
  whatsapp: string;
  canonicalWhatsApp: string;
  cleanWhatsAppNumber: string;
  phoneEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappDefaultMessage: string;
}

export const DEFAULT_CUSTOMER_SUPPORT: CustomerSupportConfig = {
  phone: "8009800936",
  countryCode: "+91",
  canonicalPhone: "+918009800936",
  whatsapp: "8009800936",
  canonicalWhatsApp: "+918009800936",
  cleanWhatsAppNumber: "918009800936",
  phoneEnabled: true,
  whatsappEnabled: true,
  whatsappDefaultMessage: "Hi Kotson, I need help choosing the right product.",
};

/**
 * Format 10-digit Indian phone number for calm visual presentation:
 * e.g., "8009800936" -> "80098 00936"
 */
export function formatPhoneDisplay(rawPhone?: string | null): string {
  if (!rawPhone) return "80098 00936";
  const digits = rawPhone.replace(/\D/g, "");
  // If 12 digits starting with 91, extract the 10 local digits
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length === 10) {
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return rawPhone;
}

/**
 * Ensure clean tel: URI destination (e.g., "tel:+918009800936")
 */
export function getTelUrl(canonicalPhone?: string | null): string {
  const phone = canonicalPhone || DEFAULT_CUSTOMER_SUPPORT.canonicalPhone;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.length === 10) return `tel:+91${digits}`;
  return `tel:+${digits}`;
}

/**
 * Clean phone number for wa.me URL:
 * Removes '+', spaces, hyphens, brackets.
 * Returns e.g. "918009800936"
 */
export function sanitizeWhatsAppNumber(raw?: string | null): string {
  if (!raw) return DEFAULT_CUSTOMER_SUPPORT.cleanWhatsAppNumber;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Official WhatsApp click-to-chat URL format using wa.me:
 * https://wa.me/918009800936?text=<URL_ENCODED_MESSAGE>
 * 
 * Rules:
 * - DO NOT use api.whatsapp.com/send
 * - DO NOT automatically send the message
 * - Customer explicitly presses Send inside WhatsApp
 */
export function getWhatsAppUrl(
  cleanNumber: string,
  message?: string | null
): string {
  const number = sanitizeWhatsAppNumber(cleanNumber);
  const text = message?.trim() || DEFAULT_CUSTOMER_SUPPORT.whatsappDefaultMessage;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Contextual message builders:
 * Factual, safe, zero personal/financial information leaked.
 */
export function getHomepageWhatsAppMessage(): string {
  return "Hi Kotson, I need help choosing the right product.";
}

export function getPdpWhatsAppMessage(productName?: string | null): string {
  const cleanName = productName?.trim();
  if (cleanName) {
    return `Hi Kotson, I need help with ${cleanName}.`;
  }
  return "Hi Kotson, I need help choosing the right Kotson product.";
}

export function getCustomizerWhatsAppMessage(productName?: string | null): string {
  const cleanName = productName?.trim();
  if (cleanName) {
    return `Hi Kotson, I need help with measurements for ${cleanName}.`;
  }
  return "Hi Kotson, I need help with measurements for a customizable product.";
}

/**
 * Safe non-sensitive analytics tracking.
 * Does NOT create duplicate CRM leads from clicks.
 */
export function trackSupportClick(
  type: "call" | "whatsapp",
  source: "homepage" | "pdp" | "customizer" | "chatbot" | "header" | "footer",
  meta?: { productId?: string; productName?: string }
) {
  const eventName = type === "call" ? "SUPPORT_CALL_CLICKED" : "SUPPORT_WHATSAPP_CLICKED";
  try {
    // Log to console for development & audit
    console.info(`[Analytics] ${eventName}:`, {
      source,
      productId: meta?.productId,
      timestamp: new Date().toISOString(),
    });

    // Optional event dispatcher if window.dataLayer or custom event handler exists
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: eventName,
        support_source: source,
        product_id: meta?.productId,
      });
    }
  } catch {
    // Fail silently without disrupting UI
  }
}

/**
 * React hook to consume central customer support configuration.
 * Fetches from /cms/support (cached for 5 minutes) and falls back to authoritative defaults.
 */
export function useCustomerSupport(): CustomerSupportConfig {
  const { data: serverSupport } = useQuery({
    queryKey: ["cms-support"],
    queryFn: () => apiGet<Partial<CustomerSupportConfig>>("/cms/support").catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const phone = serverSupport?.phone || (serverSupport as any)?.phone || DEFAULT_CUSTOMER_SUPPORT.phone;
  const countryCode = serverSupport?.countryCode || (serverSupport as any)?.country_code || DEFAULT_CUSTOMER_SUPPORT.countryCode;
  const rawWhatsapp = serverSupport?.whatsapp || (serverSupport as any)?.whatsapp || DEFAULT_CUSTOMER_SUPPORT.whatsapp;

  const canonicalPhone = phone.startsWith("+")
    ? phone
    : `${countryCode}${phone.replace(/\D/g, "")}`;

  const cleanWhatsAppNumber = sanitizeWhatsAppNumber(rawWhatsapp);
  const canonicalWhatsApp = `+${cleanWhatsAppNumber}`;

  return {
    phone,
    countryCode,
    canonicalPhone,
    whatsapp: rawWhatsapp,
    canonicalWhatsApp,
    cleanWhatsAppNumber,
    phoneEnabled:
      serverSupport?.phoneEnabled ??
      (serverSupport as any)?.phone_enabled ??
      DEFAULT_CUSTOMER_SUPPORT.phoneEnabled,
    whatsappEnabled:
      serverSupport?.whatsappEnabled ??
      (serverSupport as any)?.whatsapp_enabled ??
      DEFAULT_CUSTOMER_SUPPORT.whatsappEnabled,
    whatsappDefaultMessage:
      serverSupport?.whatsappDefaultMessage ||
      (serverSupport as any)?.whatsapp_default_message ||
      DEFAULT_CUSTOMER_SUPPORT.whatsappDefaultMessage,
  };
}
