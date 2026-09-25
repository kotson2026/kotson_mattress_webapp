import type { Product } from "@/lib/types";
import type { ChatMessage, ChatQuickReply, ChatCrmEvent } from "./types";

export const INITIAL_QUICK_REPLIES: ChatQuickReply[] = [
  { id: "mattress", label: "Find the Right Mattress", action: "find_mattress" },
  { id: "pillows", label: "Explore Pillows", action: "explore_pillows" },
  { id: "toppers", label: "Explore Toppers", action: "explore_toppers" },
  { id: "baby_kids", label: "Baby + Kids", action: "explore_baby_kids" },
  { id: "customize", label: "Customize a Product", action: "customize_product" },
  { id: "track_order", label: "Track My Order", action: "track_order" },
  { id: "delivery", label: "Delivery & Shipping", action: "delivery_shipping" },
  { id: "support", label: "Talk to Support", action: "talk_support" },
];

export const INITIAL_BOT_MESSAGE: ChatMessage = {
  id: "msg-init",
  sender: "bot",
  text: "Hi! Welcome to Kotson.\nHow can I help you today?",
  timestamp: Date.now(),
  quickReplies: INITIAL_QUICK_REPLIES,
};

export function trackChatCrmEvent(event: ChatCrmEvent, payload?: Record<string, unknown>) {
  try {
    if (typeof process !== "undefined" ? process.env?.NODE_ENV !== "production" : Boolean(import.meta?.env?.DEV)) {
      // In dev, log structured CRM chat events
      console.debug(`[Kotson CRM Chat Event] ${event}`, payload);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kotson:crm_chat_event", {
          detail: { event, payload, timestamp: new Date().toISOString() },
        })
      );
    }
  } catch {
    // ignore
  }
}

export function generateBotResponse(
  input: string,
  catalogProducts: Product[] = []
): ChatMessage {
  const query = input.trim().toLowerCase();
  const id = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = Date.now();

  // 1. Mattresses
  if (
    query.includes("mattress") ||
    query.includes("ortho") ||
    query.includes("spine") ||
    query.includes("bed") ||
    query.includes("sleep")
  ) {
    trackChatCrmEvent("PRODUCT_HELP_SELECTED", { category: "mattresses" });
    const mattresses = catalogProducts.filter(
      (p) => p.category_slug === "mattresses" && p.is_active
    );

    return {
      id,
      sender: "bot",
      text: "Kotson crafts GOLS-certified organic latex mattresses with 7-zone anatomical support. Each provides tailored pressure relief without synthetic foams or chemical off-gassing.\n\nHere are our three core models:",
      timestamp,
      products: mattresses.slice(0, 3),
      quickReplies: [
        { id: "ortho", label: "Ortho Therapy", action: "view_product", payload: "ortho-therapy" },
        { id: "spine", label: "Spine Balance", action: "view_product", payload: "spine-balance" },
        { id: "core_max", label: "Ortho Core Max", action: "view_product", payload: "ortho-core-max" },
        { id: "all_mattresses", label: "View All Mattresses", action: "nav_route", payload: "/collections/mattresses" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 2. Pillows
  if (query.includes("pillow") || query.includes("neck") || query.includes("cervical")) {
    trackChatCrmEvent("PRODUCT_HELP_SELECTED", { category: "pillows" });
    const pillows = catalogProducts.filter(
      (p) => p.category_slug === "pillows" && p.is_active
    );

    return {
      id,
      sender: "bot",
      text: "Our 100% natural pin-core latex pillows deliver ergonomic cervical alignment and buoyant support that never sags or overheats.",
      timestamp,
      products: pillows.slice(0, 2),
      quickReplies: [
        { id: "view_pillows", label: "Explore All Pillows", action: "nav_route", payload: "/collections/pillows" },
        { id: "talk_support", label: "Talk to Support", action: "talk_support" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 3. Toppers
  if (query.includes("topper") || query.includes("firm mattress") || query.includes("soften")) {
    trackChatCrmEvent("PRODUCT_HELP_SELECTED", { category: "toppers" });
    const toppers = catalogProducts.filter(
      (p) => p.category_slug === "toppers" && p.is_active
    );

    return {
      id,
      sender: "bot",
      text: "Our Organic Latex Mattress Topper instantly upgrades any mattress with 2 inches of buoyant, pressure-relieving natural latex.",
      timestamp,
      products: toppers.slice(0, 1),
      quickReplies: [
        { id: "view_toppers", label: "Explore Topper Collection", action: "nav_route", payload: "/collections/toppers" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 4. Baby & Kids
  if (query.includes("baby") || query.includes("kid") || query.includes("child") || query.includes("junior")) {
    trackChatCrmEvent("PRODUCT_HELP_SELECTED", { category: "baby-kids" });
    const babyKids = catalogProducts.filter(
      (p) => p.category_slug === "baby-kids" && p.is_active
    );

    return {
      id,
      sender: "bot",
      text: "Our Baby & Kids collection is crafted from pure organic latex and certified organic cotton—free from VOCs, toxic glues, and chemical fire retardants.",
      timestamp,
      products: babyKids.slice(0, 2),
      quickReplies: [
        { id: "view_kids", label: "Explore Baby + Kids", action: "nav_route", payload: "/collections/baby-kids" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 5. Customizable Products
  if (
    query.includes("custom") ||
    query.includes("customizable") ||
    query.includes("dimension") ||
    query.includes("special size") ||
    query.includes("odd size") ||
    query.includes("bespoke") ||
    query.includes("tailor")
  ) {
    trackChatCrmEvent("CUSTOMIZATION_SELECTED");
    return {
      id,
      sender: "bot",
      text: "Kotson can craft bespoke mattresses tailored to custom dimensions, dual-firmness splits, or specialized bed frames.\n\nOur automated custom builder is currently in preparation. In the meantime, our sleep specialists can assist you directly with custom requirements.",
      timestamp,
      customAction: "customizable_info",
      quickReplies: [
        { id: "talk_support", label: "Talk to Support for Custom Sizes", action: "talk_support" },
        { id: "explore_mattresses", label: "Explore Standard Sizes", action: "nav_route", payload: "/collections/mattresses" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 6. Track Order
  if (
    query.includes("track") ||
    query.includes("order") ||
    query.includes("where is my") ||
    query.includes("status") ||
    query.includes("shipment") ||
    query.includes("dispatch")
  ) {
    trackChatCrmEvent("ORDER_TRACKING_SELECTED");
    return {
      id,
      sender: "bot",
      text: "You can track your order status and courier dispatch milestones here:",
      timestamp,
      customAction: "track_order",
      quickReplies: [
        { id: "view_track_page", label: "Open Tracking Page", action: "nav_route", payload: "/track-order" },
        { id: "talk_support", label: "Need Help? Contact Support", action: "talk_support" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 7. Delivery & Shipping
  if (
    query.includes("deliver") ||
    query.includes("shipping") ||
    query.includes("pincode") ||
    query.includes("charges") ||
    query.includes("free delivery") ||
    query.includes("how long")
  ) {
    return {
      id,
      sender: "bot",
      text: "Kotson Delivery & Shipping Highlights:\n\n• Free shipping across India on all mattresses & bedding.\n• Orders are dispatched within 2–3 business days.\n• Delivered in high-strength, protective roll-pack packaging.\n• Courier tracking updates are sent via SMS and email.",
      timestamp,
      quickReplies: [
        { id: "shipping_policy", label: "Shipping Policy", action: "nav_route", payload: "/policies/shipping" },
        { id: "track_order", label: "Track Existing Order", action: "track_order" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 8. 100-Night Trial / Warranty
  if (
    query.includes("trial") ||
    query.includes("warranty") ||
    query.includes("guarantee") ||
    query.includes("return") ||
    query.includes("refund")
  ) {
    return {
      id,
      sender: "bot",
      text: "Our Customer Assurance Policies:\n\n• 100-Night Risk-Free Trial: Sleep on your mattress in your home for 100 nights. If it's not the right fit, we coordinate doorstep return pickup.\n• 10-Year Warranty: Covers structural core integrity and natural latex durability.\n• GOLS & OEKO-TEX Certified natural materials.",
      timestamp,
      quickReplies: [
        { id: "warranty_policy", label: "View Warranty Policy", action: "nav_route", payload: "/policies/warranty" },
        { id: "returns_policy", label: "Returns & Refund Policy", action: "nav_route", payload: "/policies/refund" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 9. Talk to Support / Contact / Agent
  if (
    query.includes("support") ||
    query.includes("contact") ||
    query.includes("agent") ||
    query.includes("human") ||
    query.includes("help") ||
    query.includes("speak") ||
    query.includes("call")
  ) {
    trackChatCrmEvent("SUPPORT_REQUESTED");
    return {
      id,
      sender: "bot",
      text: "Our customer support team is happy to assist you with mattress recommendations, dimensions, or order queries. You can submit an inquiry below or visit our contact page.",
      timestamp,
      customAction: "support_form",
      quickReplies: [
        { id: "contact_page", label: "Go to Contact Page", action: "nav_route", payload: "/contact" },
        { id: "main_menu", label: "Main Menu", action: "main_menu" },
      ],
    };
  }

  // 10. Default fallback
  return {
    id,
    sender: "bot",
    text: "I can help you discover the right natural latex mattress or pillow, check shipping policies, track an order, or connect you with our support team. What would you like to explore?",
    timestamp,
    quickReplies: INITIAL_QUICK_REPLIES,
  };
}
