import React, { useState, useMemo } from "react";
import { Search, MapPin, ArrowRight, Clock, Phone, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { KOTSON_STORE_DATA, type KotsonStore } from "./types";
import StoreDetailDrawer from "./StoreDetailDrawer";

export default function Option2TwoCityCards() {
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
      id="option-2-two-city-cards"
      aria-label="Option 2: Two-City Experience Cards"
      className="w-full bg-[#FAF8F5] text-[#2D2D2D] py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2D2D2D]/10 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
        {/* Compact Top Row: Heading on Left, Search on Right */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2D2D2D]/10">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#467065] block mb-2 font-ui">
              {KOTSON_STORE_DATA.eyebrow}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#2D2D2D] leading-[1.1]">
              {KOTSON_STORE_DATA.heading}
            </h2>
            <p className="font-ui text-sm sm:text-base text-[#5C6656] mt-2.5 leading-relaxed max-w-xl">
              {KOTSON_STORE_DATA.paragraph}
            </p>
          </div>

          {/* Search Box in Top Row */}
          <div className="w-full sm:w-80 shrink-0">
            <label htmlFor="search-stores-opt2" className="text-[11px] font-bold uppercase tracking-wider text-[#5C6656] block mb-1.5 font-ui">
              Find nearest store
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#5C6656] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-stores-opt2"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city or pincode..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-[#2D2D2D]/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#467065] text-[#2D2D2D] shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Benefits Indicators Strip Between Heading and City Cards */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-5 rounded-2xl bg-white border border-[#2D2D2D]/10 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#467065]">
            VISIT BENEFITS:
          </span>
          <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs text-[#5C6656] font-ui">
            {KOTSON_STORE_DATA.benefits.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7C9C59] shrink-0" />
                <span className="font-medium text-[#2D2D2D]">{b.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Master Showroom Anchor Visual (Used once, editorial framing) */}
        <div className="relative rounded-3xl overflow-hidden aspect-[21/9] sm:aspect-[24/8] border border-[#2D2D2D]/10 shadow-lg bg-[#FAF8F5]">
          <img
            src={KOTSON_STORE_DATA.showroomImage}
            alt={KOTSON_STORE_DATA.showroomImageAlt}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex items-center p-6 sm:p-10">
            <div className="text-white max-w-md space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                OFFICIAL EXPERIENCE STUDIOS
              </span>
              <h3 className="font-serif text-xl sm:text-3xl font-bold">
                Touch, feel &amp; test in person
              </h3>
              <p className="text-xs text-white/80 line-clamp-2">
                Step into our dedicated sleep spaces designed to help you discover your ideal ergonomic latex density.
              </p>
            </div>
          </div>
        </div>

        {/* Search Empty State */}
        {filteredStores.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-[#2D2D2D]/15 space-y-3">
            <MapPin className="w-8 h-8 text-[#467065] mx-auto opacity-50" />
            <p className="text-sm font-semibold text-[#2D2D2D] font-ui">
              No Kotson store found near this location.
            </p>
            <p className="text-xs text-[#5C6656] max-w-sm mx-auto">
              We currently operate flagship experience studios in Hyderabad and Vijayawada with nationwide doorstep delivery.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#467065] text-white text-xs font-semibold hover:bg-[#395c53] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>View all stores</span>
            </button>
          </div>
        ) : (
          /* Two Large Premium Experience Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className="group rounded-3xl bg-white border border-[#2D2D2D]/10 p-6 sm:p-8 shadow-md hover:shadow-xl hover:border-[#467065]/40 transition-all duration-300 flex flex-col justify-between space-y-6"
              >
                {/* Header Information */}
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-[#2D2D2D]/10">
                    <span className="font-mono text-xs font-bold text-[#467065] bg-[#467065]/10 px-3 py-1 rounded-full">
                      LOCATION {store.number}
                    </span>
                    <span className="text-xs font-semibold text-[#5C6656]">
                      {store.storeCount} Store • {store.state}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D] mt-4 group-hover:text-[#467065] transition-colors">
                    {store.city}
                  </h3>
                  <p className="text-xs text-[#467065] font-semibold mt-1">
                    {store.area} Flagship Sleep Studio
                  </p>
                  <p className="text-xs text-[#5C6656] mt-2.5 leading-relaxed">
                    {store.tagline}. Full showroom display with personalized firmness consultation and mattress pairing.
                  </p>
                </div>

                {/* Meta details */}
                <div className="space-y-2.5 text-xs text-[#5C6656] bg-[#FAF8F5] p-4 rounded-2xl border border-[#2D2D2D]/5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#467065] shrink-0 mt-0.5" />
                    <span className="truncate">{store.address}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#467065]" />
                      <span>{store.timings}</span>
                    </div>
                    <span className="font-bold text-[#467065]">Open Today</span>
                  </div>
                </div>

                {/* View Store Action Button */}
                <button
                  type="button"
                  onClick={() => setActiveDrawerStore(store)}
                  className="w-full flex items-center justify-between py-3.5 px-5 rounded-2xl bg-[#467065] hover:bg-[#395c53] text-white font-ui font-semibold text-xs tracking-wide shadow-sm transition-colors"
                  aria-label={`View ${store.city} store details`}
                >
                  <span>View Store Experience</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store Details Modal Drawer */}
      <StoreDetailDrawer
        store={activeDrawerStore}
        onClose={() => setActiveDrawerStore(null)}
      />
    </section>
  );
}
