import React from "react";
import { X, Sparkles } from "lucide-react";

interface Props {
  onOpenChat: () => void;
  onDismiss: () => void;
}

export default function ChatWelcomeBubble({ onOpenChat, onDismiss }: Props) {
  return (
    <div
      role="region"
      aria-label="Kotson sleep assistant greeting"
      className="fixed z-40 right-4 sm:right-6 bottom-[84px] sm:bottom-[92px] w-[285px] sm:w-[315px] rounded-2xl bg-[#FAF8F5] border border-[#E5DDD0] p-3.5 sm:p-4 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-3 duration-300 select-none"
    >
      <div className="flex items-start justify-between gap-2.5">
        <button
          type="button"
          onClick={onOpenChat}
          className="flex-1 text-left flex items-start gap-2.5 group cursor-pointer focus:outline-none"
        >
          {/* Kotson Brand Mark */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-brand-deep text-white flex items-center justify-center shadow-xs">
            <span className="font-heading font-black text-xs tracking-wider">K</span>
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-brand-deep">
                Kotson Support
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-leaf" />
            </div>
            <p className="font-ui text-[13px] sm:text-[13.5px] font-medium text-brand-charcoal leading-snug group-hover:text-brand-deep transition-colors">
              Hi! Welcome to Kotson.
              <br />
              <span className="text-brand-charcoal/80 font-normal">
                How can we help you sleep better?
              </span>
            </p>
          </div>
        </button>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Close welcome message"
          className="shrink-0 p-1 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-black/[0.04] rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick click-to-chat hint bar */}
      <button
        type="button"
        onClick={onOpenChat}
        className="mt-2.5 w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg bg-black/[0.03] hover:bg-brand-deep/8 transition-colors group cursor-pointer"
      >
        <span className="text-[11.5px] font-semibold text-brand-deep">
          Ask a question or find a mattress
        </span>
        <span className="text-[12px] text-brand-deep group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </button>

      {/* Tail pointing down to floating button */}
      <div
        className="absolute -bottom-2 right-6 sm:right-7 w-4 h-4 bg-[#FAF8F5] border-b border-r border-[#E5DDD0] rotate-45 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
