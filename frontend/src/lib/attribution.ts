import { supabase } from "./supabaseClient";

export interface StoredAttribution {
  kt_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  timestamp: string;
}

const VISITOR_ID_KEY = "kt_visitor_id";
const FIRST_TOUCH_KEY = "kt_attribution_first";
const LAST_TOUCH_KEY = "kt_attribution_last";

/**
 * Retrieves existing anonymous visitor ID or generates a new robust UUID-based visitor ID.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId || visitorId.trim() === "") {
    visitorId = "vst_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

/**
 * Returns stored attribution touchpoints from browser storage.
 */
export function getStoredAttribution(): { firstTouch: StoredAttribution | null; lastTouch: StoredAttribution | null } {
  if (typeof window === "undefined") return { firstTouch: null, lastTouch: null };
  try {
    const firstStr = localStorage.getItem(FIRST_TOUCH_KEY);
    const lastStr = localStorage.getItem(LAST_TOUCH_KEY);
    return {
      firstTouch: firstStr ? JSON.parse(firstStr) : null,
      lastTouch: lastStr ? JSON.parse(lastStr) : null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

/**
 * Initializes first-party click tracking when a user visits any page with UTM or kt_campaign link.
 */
export async function trackPageAttribution(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const params = new URLSearchParams(window.location.search);
    const kt_campaign = params.get("kt_campaign");
    const utm_source = params.get("utm_source");
    const utm_medium = params.get("utm_medium");
    const utm_campaign = params.get("utm_campaign");
    const utm_content = params.get("utm_content");
    const utm_term = params.get("utm_term");

    // Only trigger server-side click tracking if a campaign parameter or UTM is present
    if (!kt_campaign && !utm_source && !utm_campaign) {
      return;
    }

    const visitorId = getOrCreateVisitorId();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceCategory = isMobile ? "mobile" : "desktop";

    const touchpoint: StoredAttribution = {
      kt_campaign: kt_campaign || undefined,
      utm_source: utm_source || undefined,
      utm_medium: utm_medium || undefined,
      utm_campaign: utm_campaign || undefined,
      utm_content: utm_content || undefined,
      utm_term: utm_term || undefined,
      timestamp: new Date().toISOString(),
    };

    // Store in LocalStorage for client-side persistence across navigation
    localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(touchpoint));
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touchpoint));
    }

    // Call server-side first-party click recording RPC
    const { data, error } = await supabase.rpc("kotson_record_marketing_click", {
      p_visitor_id: visitorId,
      p_kt_campaign: kt_campaign || null,
      p_utm_source: utm_source || null,
      p_utm_medium: utm_medium || null,
      p_utm_campaign: utm_campaign || null,
      p_utm_content: utm_content || null,
      p_utm_term: utm_term || null,
      p_landing_page: window.location.href,
      p_referrer: document.referrer || null,
      p_device_category: deviceCategory,
      p_user_agent: navigator.userAgent,
    });

    if (error) {
      console.warn("[Attribution] Click record failed:", error.message);
    } else if (data?.recorded) {
      console.log("[Attribution] First-party click recorded:", data);
    }
  } catch (err) {
    console.error("[Attribution] Error in trackPageAttribution:", err);
  }
}

/**
 * Connects authenticated customer account with their visitor ID and attribution lineage.
 */
export async function syncCustomerAttribution(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const visitorId = getOrCreateVisitorId();
    const { lastTouch } = getStoredAttribution();

    await supabase.rpc("kotson_sync_customer_attribution", {
      p_user_id: userId,
      p_visitor_id: visitorId,
      p_utm_source: lastTouch?.utm_source || null,
      p_utm_medium: lastTouch?.utm_medium || null,
      p_utm_campaign: lastTouch?.utm_campaign || null,
      p_utm_content: lastTouch?.utm_content || null,
    });
  } catch (err) {
    console.error("[Attribution] Error syncing customer attribution:", err);
  }
}
