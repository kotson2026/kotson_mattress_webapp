import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  X,
  Send,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDateTime } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { PublicTracking } from "@/lib/crmTypes";
import type { ChatMessage, ChatQuickReply } from "./types";
import {
  INITIAL_BOT_MESSAGE,
  generateBotResponse,
  trackChatCrmEvent,
} from "./chatEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  catalogProducts: Product[];
  onClearChat: () => void;
}

export default function ChatPanel({
  isOpen,
  onClose,
  messages,
  setMessages,
  catalogProducts,
  onClearChat,
}: Props) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Context-aware: find current product if on a PDP
  const currentProduct = React.useMemo(() => {
    if (location.pathname.startsWith("/products/")) {
      const slug = location.pathname.replace("/products/", "");
      return catalogProducts.find((p) => p.slug === slug);
    }
    return null;
  }, [location.pathname, catalogProducts]);

  const handleSendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");

      // Simulate a natural brief response delay (180–300ms)
      setTimeout(() => {
        const botResponse = generateBotResponse(trimmed, catalogProducts);
        setMessages((prev) => [...prev, botResponse]);
      }, 220);
    },
    [catalogProducts, setMessages]
  );

  const handleQuickReply = useCallback(
    (reply: ChatQuickReply) => {
      // 1. Navigation actions
      if (reply.action === "nav_route" && reply.payload) {
        navigate(reply.payload);
        return;
      }

      if (reply.action === "view_product" && reply.payload) {
        trackChatCrmEvent("PRODUCT_VIEWED_FROM_CHAT", { slug: reply.payload });
        navigate(`/products/${reply.payload}`);
        return;
      }

      if (reply.action === "main_menu") {
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            sender: "user",
            text: "Main Menu",
            timestamp: Date.now(),
          },
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: "How else can I help you today?",
            timestamp: Date.now() + 100,
            quickReplies: INITIAL_BOT_MESSAGE.quickReplies,
          },
        ]);
        return;
      }

      // 2. Interactive action triggers
      handleSendMessage(reply.label);
    },
    [handleSendMessage, navigate, setMessages]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kotson-chat-title"
      data-testid="kotson-chatbot-panel"
      className="fixed z-40 inset-x-0 bottom-0 top-12 sm:top-auto sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[580px] sm:max-h-[min(620px,calc(100vh-100px))] bg-[#FAF8F5] rounded-t-3xl sm:rounded-2xl border border-black/[0.08] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      {/* ── Chat Header ── */}
      <header className="px-4 py-3.5 bg-brand-deep text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/12 border border-white/20 flex items-center justify-center">
            <span className="font-heading font-black text-xs text-white tracking-wider">
              K
            </span>
          </div>
          <div>
            <h2
              id="kotson-chat-title"
              className="font-ui text-sm font-bold tracking-[0.14em] uppercase text-white leading-tight"
            >
              Kotson
            </h2>
            <p className="font-ui text-[11px] text-white/80 leading-none mt-0.5">
              Kotson Support
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClearChat}
            title="Reset conversation"
            aria-label="Reset conversation"
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Context Awareness: Viewing product banner ── */}
      {currentProduct && (
        <div className="px-3.5 py-1.5 bg-brand-sand border-b border-[#E5DDD0] flex items-center justify-between text-xs text-brand-charcoal">
          <span className="truncate pr-2">
            Viewing: <strong>{currentProduct.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleSendMessage(`Tell me about ${currentProduct.name}`)}
            className="shrink-0 text-[11px] font-semibold text-brand-deep hover:underline cursor-pointer"
          >
            Ask about this
          </button>
        </div>
      )}

      {/* ── Message Area ── */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3.5 focus:outline-none"
        tabIndex={0}
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Message Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] sm:text-[13.5px] leading-relaxed select-text ${
                msg.sender === "user"
                  ? "bg-brand-deep text-white rounded-br-xs shadow-xs"
                  : "bg-white text-brand-charcoal border border-[#E5DDD0] rounded-bl-xs shadow-xs"
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>
            </div>

            {/* In-chat Product Cards */}
            {msg.products && msg.products.length > 0 && (
              <div className="mt-2.5 w-full space-y-2">
                {msg.products.map((product) => (
                  <ChatProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => {
                      trackChatCrmEvent("PRODUCT_VIEWED_FROM_CHAT", { slug: product.slug });
                      navigate(`/products/${product.slug}`);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Custom Interactive Action Widgets */}
            {msg.customAction === "track_order" && (
              <ChatTrackOrderWidget />
            )}

            {msg.customAction === "support_form" && (
              <ChatSupportFormWidget />
            )}

            {msg.customAction === "customizable_info" && (
              <ChatCustomizableInfoWidget
                onTalkSupport={() => handleSendMessage("Talk to Support")}
                onExploreStandard={() => navigate("/collections/mattresses")}
              />
            )}

            {/* Quick Reply Chips */}
            {msg.quickReplies && msg.quickReplies.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 w-full">
                {msg.quickReplies.map((reply) => (
                  <button
                    key={reply.id}
                    type="button"
                    onClick={() => handleQuickReply(reply)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-full bg-white hover:bg-brand-deep hover:text-white border border-[#E5DDD0] text-brand-deep shadow-2xs transition-all cursor-pointer"
                  >
                    <span>{reply.label}</span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Message Composer ── */}
      <footer className="p-3 bg-white border-t border-[#E5DDD0] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            aria-label="Message to Kotson support"
            className="flex-1 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl px-3.5 py-2 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep focus:border-brand-deep transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            aria-label="Send message"
            className="shrink-0 w-9 h-9 rounded-xl bg-brand-deep disabled:bg-brand-deep/30 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-center text-brand-charcoal/40 mt-1.5">
          GOLS Organic Latex & Natural Sleep Solutions
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: In-Chat Product Card
// ─────────────────────────────────────────────────────────────
function ChatProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: () => void;
}) {
  const image = (product.images && product.images[0]) || product.primary_image || "/navbar/mattress.png";
  const salePrice = product.price_from;
  const mrp = product.mrp_from;

  return (
    <div className="w-full rounded-xl border border-[#E5DDD0] bg-white p-2.5 flex items-center gap-3 shadow-2xs hover:border-brand-deep/40 transition-colors">
      <div className="shrink-0 w-16 h-16 rounded-lg bg-brand-sand/60 p-1 flex items-center justify-center overflow-hidden">
        <img
          src={image}
          alt={product.name}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/navbar/mattress.png";
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-ui text-xs font-semibold text-brand-charcoal truncate">
          {product.name}
        </h4>
        <p className="font-ui text-[11px] text-brand-charcoal/60 truncate">
          {product.tagline || "100% Natural Latex"}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-brand-charcoal">
            {salePrice ? inr(salePrice) : "View details"}
          </span>
          {mrp && mrp > (salePrice ?? 0) && (
            <span className="text-[10px] text-brand-charcoal/50 line-through">
              {inr(mrp)}
            </span>
          )}
          <span className="text-[9px] font-bold text-brand-leaf bg-brand-leaf/10 px-1 rounded-sm">
            40% OFF
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-brand-deep text-white text-[11px] font-semibold hover:bg-brand-deep/90 transition-colors cursor-pointer"
      >
        View
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: In-Chat Order Tracking Widget
// ─────────────────────────────────────────────────────────────
function ChatTrackOrderWidget() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTracking | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !email) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<PublicTracking>(
        `/ops/track/${encodeURIComponent(orderNumber.trim().toUpperCase())}?email=${encodeURIComponent(
          email.trim()
        )}`
      );
      setResult(data);
    } catch {
      setError("No order found matching that order number and email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 w-full rounded-xl border border-[#E5DDD0] bg-white p-3 shadow-2xs">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-brand-deep">
        <Truck className="w-4 h-4" />
        <span>Look up order status</span>
      </div>

      {result ? (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center bg-brand-sand/50 p-2 rounded-lg">
            <span className="font-bold">{result.order_number}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-leaf/15 text-brand-deep font-semibold">
              {result.fulfilment_status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-brand-charcoal/70 text-[11px]">
            Placed: {fmtDateTime(result.placed_at)}
          </p>
          <div className="border-t border-[#E5DDD0] pt-2">
            <p className="font-semibold text-brand-charcoal text-[11px] mb-1">
              Items:
            </p>
            {result.items.map((item, idx) => (
              <p key={idx} className="text-brand-charcoal/70 text-[11px]">
                • {item.product_name} × {item.qty}
              </p>
            ))}
          </div>
          {result.shipments.length > 0 ? (
            <div className="border-t border-[#E5DDD0] pt-2">
              <p className="font-semibold text-brand-charcoal text-[11px] mb-1">
                Shipment Milestones:
              </p>
              {result.shipments.map((s, idx) => (
                <div key={idx} className="text-[11px] text-brand-charcoal/80">
                  <span className="font-medium">{s.carrier || "Courier"}:</span>{" "}
                  {s.status} {s.tracking_reference && `(${s.tracking_reference})`}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-brand-charcoal/60 italic">
              Order is being prepared for dispatch.
            </p>
          )}
          <Link
            to="/track-order"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-deep underline"
          >
            Open full tracking page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="Order Number (e.g. KS00001)"
              required
              className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
            />
          </div>
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email used at checkout"
              required
              className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
            />
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 rounded-lg bg-brand-deep text-white text-xs font-semibold hover:bg-brand-deep/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Checking..." : "Track My Order"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: In-Chat Support Inquiry Form Widget
// ─────────────────────────────────────────────────────────────
function ChatSupportFormWidget() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    setLoading(true);
    setError(null);
    try {
      await apiPost("/crm/inquiries", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: "Chatbot Support Request",
        message: message.trim(),
        issue_type: "general",
      });
      setSubmitted(true);
    } catch {
      setError("Unable to send inquiry. Please try again or visit our Contact page.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-2 w-full rounded-xl border border-brand-leaf/30 bg-brand-leaf/10 p-3 text-xs text-brand-charcoal">
        <div className="flex items-center gap-1.5 font-bold text-brand-deep mb-1">
          <CheckCircle2 className="w-4 h-4 text-brand-leaf" />
          <span>Inquiry Received</span>
        </div>
        <p className="text-[11.5px] leading-relaxed">
          Thank you, {name}! Your message has been sent to our customer care team. We will respond to <strong>{email}</strong> shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl border border-[#E5DDD0] bg-white p-3 shadow-2xs">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-brand-deep">
        <HelpCircle className="w-4 h-4" />
        <span>Leave a message for Kotson Support</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name *"
          required
          className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your Email *"
          required
          className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number (optional)"
          className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we assist you? *"
          required
          rows={2}
          className="w-full bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg px-2.5 py-1.5 text-xs text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus:ring-1 focus:ring-brand-deep"
        />
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-1.5 rounded-lg bg-brand-deep text-white text-xs font-semibold hover:bg-brand-deep/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Sending..." : "Submit Inquiry"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: In-Chat Customizable Products Guidance Widget
// ─────────────────────────────────────────────────────────────
function ChatCustomizableInfoWidget({
  onTalkSupport,
  onExploreStandard,
}: {
  onTalkSupport: () => void;
  onExploreStandard: () => void;
}) {
  return (
    <div className="mt-2 w-full rounded-xl border border-[#E5DDD0] bg-white p-3 text-xs shadow-2xs">
      <div className="flex items-center gap-1.5 font-bold text-brand-deep mb-1.5">
        <Sparkles className="w-4 h-4 text-brand-leaf" />
        <span>Bespoke Mattress Tailoring</span>
      </div>
      <p className="text-brand-charcoal/80 text-[11.5px] leading-relaxed mb-2.5">
        We accommodate special length, width, and dual-zone firmness requirements. Connect directly with our concierge team to configure your custom mattress:
      </p>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onTalkSupport}
          className="w-full py-1.5 rounded-lg bg-brand-deep text-white text-xs font-semibold hover:bg-brand-deep/90 transition-colors text-center cursor-pointer"
        >
          Talk to Support for Custom Sizes
        </button>
        <button
          type="button"
          onClick={onExploreStandard}
          className="w-full py-1.5 rounded-lg bg-brand-sand hover:bg-brand-sand/80 text-brand-charcoal text-xs font-medium border border-[#E5DDD0] transition-colors text-center cursor-pointer"
        >
          Explore Standard Mattresses
        </button>
      </div>
    </div>
  );
}
