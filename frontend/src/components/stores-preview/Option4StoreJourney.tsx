import React, { useState, useMemo } from "react";
import { Search, MapPin, ArrowRight, CheckCircle2, RotateCcw, Clock, Phone, Sparkles } from "lucide-react";
import { KOTSON_STORE_DATA, type KotsonStore } from "./types";
import StoreDetailDrawer from "./StoreDetailDrawer";

export default function Option4StoreJourney() {
  const [selectedCityId, setSelectedCityId] = useState<string>("hyderabad");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
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

  // Keep selected store valid
  const currentStore = useMemo(() => {
    if (filteredStores.length > 0) {
      const found = filteredStores.find((s) => s.id === selectedCityId);
      return found || filteredStores[0];
    }
    return null;
  }, [filteredStores, selectedCityId]);

  return (
    <section
      id="option-4-store-journey"
      aria-label="Option 4: Store Journey Layout"
      className="w-full bg-[#FAF8F5] text-[#2D2D2D] py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2D2D2D]/10 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-10 sm:space-y-12">
        {/* Top 2-Column Split: Journey Steps on Left, Showroom Image on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading + 3 Visit Steps + Supporting Statements */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#467065] block mb-2 font-ui">
                {KOTSON_STORE_DATA.eyebrow}
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#2D2D2D] leading-[1.1]">
                {KOTSON_STORE_DATA.heading}
              </h2>
              <p className="font-ui text-sm sm:text-base text-[#5C6656] mt-3 leading-relaxed max-w-lg">
                {KOTSON_STORE_DATA.paragraph}
              </p>
            </div>

            {/* 3 Small Minimal Visit Steps */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#467065] text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  1
                </span>
                <div>
                  <h4 className="font-ui text-sm font-bold text-[#2D2D2D]">Choose your city</h4>
                  <p className="text-xs text-[#5C6656]">Find our flagship experience centre in Hyderabad or Vijayawada.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#467065] text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  2
                </span>
                <div>
                  <h4 className="font-ui text-sm font-bold text-[#2D2D2D]">Visit the store</h4>
                  <p className="text-xs text-[#5C6656]">Walk in 7 days a week for peaceful, zero-pressure testing.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-[#467065] text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  3
                </span>
                <div>
                  <h4 className="font-ui text-sm font-bold text-[#2D2D2D]">Find your comfort</h4>
                  <p className="text-xs text-[#5C6656]">Experience natural botanical latex densities suited to your spine.</p>
                </div>
              </div>
            </div>

            {/* Benefits as small supporting statements beneath steps */}
            <div className="pt-4 border-t border-[#2D2D2D]/10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5C6656]">
              {KOTSON_STORE_DATA.benefits.map((b, i) => (
                <span key={b.id} className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#7C9C59]" />
                  <span>{b.title}</span>
                  {i < KOTSON_STORE_DATA.benefits.length - 1 && (
                    <span className="text-[#2D2D2D]/20 ml-2.5">•</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column: Large Framed Showroom Visual */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl overflow-hidden aspect-[16/11] border border-[#2D2D2D]/10 shadow-xl bg-white relative group">
              <img
                src={KOTSON_STORE_DATA.showroomImage}
                alt={KOTSON_STORE_DATA.showroomImageAlt}
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-103"
                loading="lazy"
              />
              <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#2D2D2D] shadow-sm border border-[#2D2D2D]/10 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#467065]" />
                <span>Kotson Sleep Studio</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Horizontal City Selector & Expandable Search */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2D2D2D]/10 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#467065] block">
                STEP 1 OF YOUR VISIT
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2D2D2D]">
                Select your preferred city
              </h3>
            </div>

            {/* Toggle Search Action */}
            <div>
              {!isSearchExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#467065] hover:text-[#395c53] p-2 rounded-xl hover:bg-[#FAF8F5] transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search another location</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-[#5C6656] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="search-stores-opt4"
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search city or pincode..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#2D2D2D]/20 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#467065] text-[#2D2D2D]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchExpanded(false);
                      setSearchQuery("");
                    }}
                    className="text-xs text-[#5C6656] hover:text-[#2D2D2D] px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search Empty State */}
          {filteredStores.length === 0 ? (
            <div className="text-center py-6 px-4 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#2D2D2D]/15 space-y-2">
              <p className="text-xs text-[#5C6656]">No Kotson store found near this location.</p>
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
            <>
              {/* Horizontal Tabs for Cities */}
              <div className="flex flex-wrap gap-3" role="tablist" aria-label="City Selector">
                {filteredStores.map((store) => {
                  const isSelected = currentStore?.id === store.id;
                  return (
                    <button
                      key={store.id}
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedCityId(store.id)}
                      className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-ui font-semibold transition-all duration-200 border flex items-center gap-2.5 ${
                        isSelected
                          ? "bg-[#467065] text-white border-[#467065] shadow-sm"
                          : "bg-[#FAF8F5] text-[#2D2D2D] border-[#2D2D2D]/10 hover:border-[#467065]/40"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-[#7C9C59]" : "bg-[#5C6656]/40"}`} />
                      <span>{store.city}</span>
                      <span className={`text-[11px] ${isSelected ? "text-white/80" : "text-[#5C6656]"}`}>
                        (1 Store)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Revealed Store Summary Card */}
              {currentStore && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF8F5] border border-[#2D2D2D]/10 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#467065] bg-white px-2 py-0.5 rounded border border-[#2D2D2D]/10">
                        {currentStore.number}
                      </span>
                      <h4 className="font-ui text-base sm:text-lg font-bold text-[#2D2D2D]">
                        {currentStore.name}
                      </h4>
                      <span className="text-[10px] font-bold text-[#467065] bg-[#7C9C59]/15 px-2 py-0.5 rounded-full">
                        Open Today
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#5C6656]">
                      <MapPin className="w-3.5 h-3.5 text-[#467065] shrink-0" />
                      <span>{currentStore.address}</span>
                    </div>

                    <p className="text-[11px] text-[#5C6656]">
                      Timings: {currentStore.timings} • Contact: {currentStore.phone}
                    </p>
                  </div>

                  {/* Primary View Store Action */}
                  <button
                    type="button"
                    onClick={() => setActiveDrawerStore(currentStore)}
                    className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#467065] hover:bg-[#395c53] text-white font-ui font-semibold text-xs tracking-wide shadow-sm transition-colors shrink-0"
                    aria-label={`View ${currentStore.city} store details`}
                  >
                    <span>View Store Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
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
