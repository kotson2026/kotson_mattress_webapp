import React, { useState, useMemo } from "react";
import { Search, MapPin, ArrowRight, CheckCircle2, RotateCcw, Sparkles, Navigation } from "lucide-react";
import { KOTSON_STORE_DATA, type KotsonStore } from "./types";
import StoreDetailDrawer from "./StoreDetailDrawer";

export default function Option1Spotlight() {
  const [selectedCityId, setSelectedCityId] = useState<string>("hyderabad");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDrawerStore, setActiveDrawerStore] = useState<KotsonStore | null>(null);

  const stores = KOTSON_STORE_DATA.stores;

  // Filter stores based on search query (city, area, or pincode)
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

  // Keep selected store valid even after search filter
  const currentStore = useMemo(() => {
    if (filteredStores.length > 0) {
      const found = filteredStores.find((s) => s.id === selectedCityId);
      return found || filteredStores[0];
    }
    return null;
  }, [filteredStores, selectedCityId]);

  return (
    <section
      id="option-1-spotlight"
      aria-label="Option 1: Editorial Store Spotlight"
      className="w-full bg-[#FAF8F5] text-[#2D2D2D] py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2D2D2D]/10 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Upper Left Header Section */}
        <div className="max-w-2xl mb-8 sm:mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#467065] mb-2 font-ui">
            {KOTSON_STORE_DATA.eyebrow}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#2D2D2D] leading-[1.1]">
            {KOTSON_STORE_DATA.heading}
          </h2>
          <p className="font-ui text-sm sm:text-base text-[#5C6656] mt-3 sm:mt-4 leading-relaxed max-w-xl">
            {KOTSON_STORE_DATA.paragraph}
          </p>
        </div>

        {/* Asymmetric Composition: Large Showroom Stage with Overlapping Location Selector */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Large Kotson Showroom Frame (8 cols on desktop) */}
          <div className="lg:col-span-8 relative rounded-3xl overflow-hidden shadow-xl border border-[#2D2D2D]/10 bg-white aspect-[16/10] sm:aspect-[16/9]">
            <img
              src={KOTSON_STORE_DATA.showroomImage}
              alt={KOTSON_STORE_DATA.showroomImageAlt}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
            {/* Subtle Gradient Readability Scrim at Bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

            {/* Inset Badge on Image */}
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 text-white z-10 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#7C9C59] animate-pulse" />
              <span className="font-ui font-medium">Walk-ins welcome • 7 days a week</span>
            </div>
          </div>

          {/* Overlapping Vertical Location Selector & Search (4 cols on desktop) */}
          <div className="lg:col-span-4 w-full bg-white rounded-3xl p-5 sm:p-6 shadow-xl border border-[#2D2D2D]/10 lg:-ml-8 lg:mt-6 z-20 space-y-5">
            {/* Search Input */}
            <div>
              <label htmlFor="search-stores-opt1" className="text-[11px] font-bold uppercase tracking-wider text-[#5C6656] block mb-1.5 font-ui">
                Find Your Nearest Store
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#5C6656] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="search-stores-opt1"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter city or pincode..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-[#2D2D2D]/15 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#467065] focus:bg-white text-[#2D2D2D] transition-colors"
                />
              </div>
            </div>

            {/* Location Selector Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#5C6656]">
                <span className="font-semibold uppercase text-[10px] tracking-wider">AVAILABLE LOCATIONS</span>
                <span>{filteredStores.length} found</span>
              </div>

              {filteredStores.length === 0 ? (
                <div className="text-center py-6 px-3 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#2D2D2D]/15 space-y-2">
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
                <div className="space-y-2.5" role="radiogroup" aria-label="Store locations">
                  {filteredStores.map((store) => {
                    const isSelected = currentStore?.id === store.id;
                    return (
                      <div
                        key={store.id}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => setSelectedCityId(store.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedCityId(store.id);
                          }
                        }}
                        className={`group cursor-pointer rounded-2xl p-4 border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#467065] ${
                          isSelected
                            ? "bg-[#467065]/5 border-[#467065] shadow-sm ring-1 ring-[#467065]/20"
                            : "bg-[#FAF8F5] border-[#2D2D2D]/10 hover:border-[#467065]/40 hover:bg-[#FAF8F5]/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-[#467065] bg-white w-7 h-7 rounded-lg flex items-center justify-center border border-[#2D2D2D]/10">
                              {store.number}
                            </span>
                            <div>
                              <h4 className="font-ui text-sm font-bold text-[#2D2D2D]">
                                {store.city}
                              </h4>
                              <p className="text-[11px] text-[#5C6656]">{store.area}, 1 Store</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDrawerStore(store);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#467065] hover:text-[#395c53] p-1.5 rounded-lg hover:bg-white transition-colors"
                            aria-label={`View ${store.city} store details`}
                          >
                            <span>View Store</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Active Expanded State Information */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-[#467065]/15 text-[11px] text-[#5C6656] space-y-1.5 animate-in fade-in duration-200">
                            <div className="flex items-center gap-1.5 text-[#2D2D2D]">
                              <MapPin className="w-3.5 h-3.5 text-[#467065] shrink-0" />
                              <span className="truncate">{store.address}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#5C6656] pt-1">
                              <span>Timings: {store.timings.split("(")[0]}</span>
                              <span className="font-semibold text-[#467065]">Open Today</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visit Benefits Strip Below Image */}
        <div className="mt-8 pt-8 border-t border-[#2D2D2D]/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {KOTSON_STORE_DATA.benefits.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#2D2D2D]/10 shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-[#467065]/10 text-[#467065] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#7C9C59]" />
                </div>
                <div>
                  <h5 className="font-ui text-xs sm:text-sm font-bold text-[#2D2D2D]">
                    {b.title}
                  </h5>
                  <p className="text-[11px] text-[#5C6656] mt-0.5 leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
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
