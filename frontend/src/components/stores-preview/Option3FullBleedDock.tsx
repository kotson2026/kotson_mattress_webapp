import React, { useState, useMemo } from "react";
import { Search, MapPin, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { KOTSON_STORE_DATA, type KotsonStore } from "./types";
import StoreDetailDrawer from "./StoreDetailDrawer";

export default function Option3FullBleedDock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDrawerStore, setActiveDrawerStore] = useState<KotsonStore | null>(null);

  const stores = KOTSON_STORE_DATA.stores;

  // Filter stores
  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) => {
      const matchCity = s.city.toLowerCase().includes(q);
      const matchArea = s.area.toLowerCase().includes(q);
      const matchPin = s.pincodes.some((pin) => pin.includes(q));
      return matchCity || matchArea || matchPin;
    });
  }, [stores, searchQuery]);

  return (
    <section
      id="option-3-full-bleed-dock"
      aria-label="Option 3: Full-Bleed Showroom With Locator Dock"
      className="w-full bg-[#FAF8F5] text-[#2D2D2D] py-8 sm:py-12 border-t border-[#2D2D2D]/10 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Immersive Visual Frame with Attached Solid Cream Dock */}
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-[#2D2D2D]/10 bg-[#FAF8F5] flex flex-col">
          {/* Top Full-Bleed Showroom Hero Visual */}
          <div className="relative min-h-[380px] sm:min-h-[460px] lg:min-h-[500px] flex flex-col justify-between p-6 sm:p-10 lg:p-12">
            {/* Background Image with Readability Gradient */}
            <img
              src={KOTSON_STORE_DATA.showroomImage}
              alt={KOTSON_STORE_DATA.showroomImageAlt}
              className="absolute inset-0 w-full h-full object-cover object-center z-0"
              loading="lazy"
            />
            {/* Controlled dark readability overlay that protects text without covering store signage */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30 z-1" />

            {/* Top Bar: Eyebrow + Side Panel Benefits */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[#A3C280] text-[11px] font-bold uppercase tracking-[0.22em] border border-white/20">
                  {KOTSON_STORE_DATA.eyebrow}
                </span>
              </div>

              {/* Compact Benefits Side Panel in Upper Right */}
              <div className="hidden sm:flex flex-col gap-2 p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 text-white text-xs max-w-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3C280]">
                  IN-STORE EXPERIENCE
                </span>
                {KOTSON_STORE_DATA.benefits.map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7C9C59] shrink-0" />
                    <span className="text-white/90 text-[11px]">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Hero Copy Placed Over Safe Negative Space */}
            <div className="relative z-10 max-w-2xl text-white space-y-3 pt-12">
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight leading-[1.1]">
                {KOTSON_STORE_DATA.heading}
              </h2>
              <p className="font-ui text-xs sm:text-sm sm:text-base text-white/85 leading-relaxed max-w-lg">
                {KOTSON_STORE_DATA.paragraph}
              </p>
            </div>
          </div>

          {/* Solid Cream Locator Dock Attached to Base */}
          <div className="bg-[#FAF8F5] border-t border-[#467065]/20 p-6 sm:p-8 lg:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065] block">
                  LOCATOR DOCK
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2D2D2D] mt-0.5">
                  Select a Kotson Experience Centre
                </h3>
              </div>

              {/* Search Field in Dock */}
              <div className="w-full sm:w-80">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#5C6656] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="search-stores-opt3"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search city or pincode..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-[#2D2D2D]/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#467065] text-[#2D2D2D] shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Empty Search Result Feedback */}
            {filteredStores.length === 0 ? (
              <div className="text-center py-8 px-4 bg-white rounded-2xl border border-dashed border-[#2D2D2D]/15 space-y-2">
                <p className="text-xs text-[#5C6656] font-ui">
                  No Kotson store found near this location.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#467065] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>View all stores</span>
                </button>
              </div>
            ) : (
              /* Two Horizontal Location Rows inside Dock */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {filteredStores.map((store) => (
                  <div
                    key={store.id}
                    className="bg-white rounded-2xl p-5 border border-[#2D2D2D]/10 hover:border-[#467065]/40 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-[#467065] bg-[#467065]/10 px-2 py-0.5 rounded-md">
                            {store.number}
                          </span>
                          <h4 className="font-ui text-base font-bold text-[#2D2D2D]">
                            {store.city} Store
                          </h4>
                        </div>
                        <p className="text-xs text-[#467065] font-semibold mt-1">
                          {store.area} Experience Studio
                        </p>
                        <p className="text-xs text-[#5C6656] mt-1.5 line-clamp-1">
                          {store.address}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold text-[#467065] bg-[#7C9C59]/15 px-2.5 py-1 rounded-full shrink-0">
                        Open Today
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#2D2D2D]/5 flex items-center justify-between">
                      <span className="text-[11px] text-[#5C6656]">
                        {store.timings.split("(")[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveDrawerStore(store)}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#467065] hover:bg-[#395c53] text-white text-xs font-semibold shadow-xs transition-colors"
                        aria-label={`View ${store.city} store details`}
                      >
                        <span>View Store</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Store Details Modal Drawer */}
      <StoreDetailDrawer
        store={activeDrawerStore}
        onClose={() => setActiveDrawerStore(null)}
      />
    </section>
  );
}
