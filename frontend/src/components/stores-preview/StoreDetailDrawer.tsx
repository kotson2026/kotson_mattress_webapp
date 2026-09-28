import React, { useEffect, useRef, useCallback } from "react";
import { X, MapPin, Clock, Phone, Navigation, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { KotsonStore } from "./types";

interface Props {
  store: KotsonStore | null;
  onClose: () => void;
}

export default function StoreDetailDrawer({ store, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Auto-focus close button when opened
  useEffect(() => {
    if (store && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [store]);

  // Handle ESC key to close
  useEffect(() => {
    if (!store) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, onClose]);

  // Trap focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }, []);

  if (!store) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-drawer-title"
    >
      <div
        ref={drawerRef}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-[#FAF8F5] text-[#2D2D2D] shadow-2xl flex flex-col border-l border-[#2D2D2D]/10 overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#FAF8F5]/95 backdrop-blur-md px-6 py-5 border-b border-[#2D2D2D]/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#467065] block">
              KOTSON STORE DETAILS
            </span>
            <h3 id="store-drawer-title" className="font-serif text-2xl font-bold text-[#2D2D2D] mt-0.5">
              {store.name}
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close store details"
            className="w-9 h-9 rounded-full bg-[#467065]/10 hover:bg-[#467065]/20 text-[#2D2D2D] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Showroom Visual */}
          <div className="rounded-2xl overflow-hidden aspect-video border border-[#2D2D2D]/10 shadow-sm bg-white relative">
            <img
              src={store.image}
              alt={`${store.name} interior`}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#7C9C59]" />
              <span>Official Kotson Store</span>
            </div>
          </div>

          {/* Area & Tagline */}
          <div className="bg-white p-4 rounded-xl border border-[#2D2D2D]/10">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#7C9C59]/15 text-[#467065] mb-1.5">
              {store.area}, {store.city}
            </span>
            <p className="text-xs text-[#5C6656] leading-relaxed">
              {store.tagline}. Test the full lineup of 7-zone ergonomic mattresses and certified organic latex pillows.
            </p>
          </div>

          {/* Store Info Rows */}
          <div className="space-y-4 text-xs">
            {/* Address */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#2D2D2D]/10">
              <div className="w-8 h-8 rounded-lg bg-[#467065]/10 text-[#467065] flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="font-bold text-[#2D2D2D] block">Address</span>
                <p className="text-[#5C6656] mt-0.5 leading-relaxed">{store.address}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[10px] text-[#5C6656]/70">Pincodes served:</span>
                  {store.pincodes.slice(0, 5).map((pin) => (
                    <span key={pin} className="px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[10px] font-mono text-[#467065]">
                      {pin}
                    </span>
                  ))}
                  {store.pincodes.length > 5 && (
                    <span className="text-[10px] text-[#5C6656] font-medium">+{store.pincodes.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>

            {/* Timings */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#2D2D2D]/10">
              <div className="w-8 h-8 rounded-lg bg-[#467065]/10 text-[#467065] flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="font-bold text-[#2D2D2D] block">Store Timings</span>
                <p className="text-[#5C6656] mt-0.5">{store.timings}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#467065] mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C9C59] animate-pulse" /> Open Today
                </span>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#2D2D2D]/10">
              <div className="w-8 h-8 rounded-lg bg-[#467065]/10 text-[#467065] flex items-center justify-center shrink-0 mt-0.5">
                <Phone className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="font-bold text-[#2D2D2D] block">Contact Support</span>
                <p className="text-[#5C6656] mt-0.5 font-medium">{store.phone}</p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <a
              href={store.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#467065] hover:bg-[#395c53] text-white font-ui font-semibold text-xs tracking-wide shadow-sm transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>Get Directions on Google Maps</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </a>

            <a
              href={`tel:${store.phone}`}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[#467065] text-[#467065] hover:bg-[#467065]/10 font-ui font-semibold text-xs tracking-wide transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>Call Store Directly</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
