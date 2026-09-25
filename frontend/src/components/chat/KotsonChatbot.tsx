import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import type { ChatMessage } from "./types";
import { INITIAL_BOT_MESSAGE, trackChatCrmEvent } from "./chatEngine";
import ChatWelcomeBubble from "./ChatWelcomeBubble";
import ChatPanel from "./ChatPanel";

const STORAGE_KEY_MESSAGES = "kotson_chat_history";
const STORAGE_KEY_DISMISSED = "kotson_chat_welcome_dismissed";

export default function KotsonChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcomeBubble, setShowWelcomeBubble] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Read location to detect restricted pages (checkout, admin, crm, etc.)
  const location = useLocation();

  // Read Cart Drawer status to avoid spatial conflicts
  const { open: isCartOpen } = useCheckoutDrawer();

  // Load authoritative catalog products for in-chat discovery
  const { data: catalogProducts = [] } = useQuery<Product[]>({
    queryKey: ["catalog-products"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
    staleTime: 5 * 60 * 1000,
  });

  // Session-persisted messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse failure
    }
    return [INITIAL_BOT_MESSAGE];
  });

  // Sync messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {
      // storage quota or private browsing
    }
  }, [messages]);

  // Delayed welcome bubble on first visit in current session
  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem(STORAGE_KEY_DISMISSED);
      if (!isDismissed && !isOpen) {
        const timer = setTimeout(() => {
          setShowWelcomeBubble(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  // When cart drawer opens, hide/minimize chatbot panel so they don't fight for screen space
  useEffect(() => {
    if (isCartOpen) {
      if (isOpen) {
        setIsOpen(false);
      }
      setShowWelcomeBubble(false);
    }
  }, [isCartOpen, isOpen]);

  // Dismiss welcome bubble handler
  const handleDismissBubble = useCallback(() => {
    setShowWelcomeBubble(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    } catch {
      // ignore
    }
  }, []);

  // Open chat handler
  const handleOpenChat = useCallback(() => {
    setIsOpen(true);
    setShowWelcomeBubble(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    } catch {
      // ignore
    }
    trackChatCrmEvent("CHAT_OPENED", { path: location.pathname });
  }, [location.pathname]);

  // Close chat handler
  const handleCloseChat = useCallback(() => {
    setIsOpen(false);
    // Return focus to the launcher button
    setTimeout(() => {
      buttonRef.current?.focus();
    }, 50);
  }, []);

  // Clear chat conversation
  const handleClearChat = useCallback(() => {
    setMessages([
      {
        ...INITIAL_BOT_MESSAGE,
        id: `msg-reset-${Date.now()}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Keyboard navigation: Escape key closes the open panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleCloseChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCloseChat]);

  // Strict page visibility rules:
  // 1. DO NOT show during checkout flow (Payment / Address / OTP must be 100% unobstructed)
  // 2. DO NOT show on back-office consoles (admin, manager, crm, dealer, ops)
  // 3. DO NOT show when Cart Drawer is open
  const isRestrictedPage =
    location.pathname === "/checkout" ||
    location.pathname.startsWith("/checkout/") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/manager") ||
    location.pathname.startsWith("/crm") ||
    location.pathname.startsWith("/dealer") ||
    location.pathname.startsWith("/ops");

  if (isRestrictedPage || isCartOpen) {
    return null;
  }

  return (
    <>
      {/* ── Welcome Bubble (if active and chat is closed) ── */}
      {showWelcomeBubble && !isOpen && (
        <ChatWelcomeBubble
          onOpenChat={handleOpenChat}
          onDismiss={handleDismissBubble}
        />
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <ChatPanel
          isOpen={isOpen}
          onClose={handleCloseChat}
          messages={messages}
          setMessages={setMessages}
          catalogProducts={catalogProducts}
          onClearChat={handleClearChat}
        />
      )}

      {/* ── Floating Circular Chat Button ── */}
      {!isOpen && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpenChat}
          aria-label="Chat with Kotson"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          data-testid="kotson-floating-chat-button"
          className="fixed z-40 right-4 sm:right-6 md:right-7 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-6 md:bottom-7 w-[52px] h-[52px] sm:w-[58px] sm:h-[58px] rounded-full bg-[#1E3A2F] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(30,58,47,0.28)] hover:shadow-[0_12px_28px_rgba(30,58,47,0.36)] hover:scale-[1.05] active:scale-[0.98] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2 cursor-pointer"
        >
          <MessageSquare className="w-6 h-6 sm:w-6 sm:h-6 text-white" />

          {/* Visual online/ready indicator dot */}
          <span className="absolute top-1 right-1 w-3 h-3 bg-brand-leaf border-2 border-[#FAF8F5] rounded-full" />
        </button>
      )}
    </>
  );
}
