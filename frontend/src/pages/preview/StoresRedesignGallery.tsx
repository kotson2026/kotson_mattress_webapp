import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Monitor, Tablet, Smartphone, Eye, CheckCircle2, ChevronRight, Layers, ShieldCheck, ArrowLeft } from "lucide-react";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import Option1Spotlight from "@/components/stores-preview/Option1Spotlight";
import Option2TwoCityCards from "@/components/stores-preview/Option2TwoCityCards";
import Option3FullBleedDock from "@/components/stores-preview/Option3FullBleedDock";
import Option4StoreJourney from "@/components/stores-preview/Option4StoreJourney";

type ViewportMode = "fluid" | "desktop" | "tablet" | "mobile";
type ActiveTab = "all" | "option1" | "option2" | "option3" | "option4";

export default function StoresRedesignGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const optParam = searchParams.get("opt");
  const isClean = searchParams.get("clean") === "true";

  const getInitialTab = (): ActiveTab => {
    if (optParam === "1") return "option1";
    if (optParam === "2") return "option2";
    if (optParam === "3") return "option3";
    if (optParam === "4") return "option4";
    return "all";
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("fluid");

  useEffect(() => {
    if (optParam === "1") setActiveTab("option1");
    else if (optParam === "2") setActiveTab("option2");
    else if (optParam === "3") setActiveTab("option3");
    else if (optParam === "4") setActiveTab("option4");
  }, [optParam]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const num = tab === "option1" ? "1" : tab === "option2" ? "2" : tab === "option3" ? "3" : tab === "option4" ? "4" : "";
    if (num) {
      searchParams.set("opt", num);
    } else {
      searchParams.delete("opt");
    }
    setSearchParams(searchParams);
  };

  const getContainerWidth = () => {
    switch (viewportMode) {
      case "desktop":
        return "max-w-[1440px]";
      case "tablet":
        return "max-w-[768px]";
      case "mobile":
        return "max-w-[390px]";
      default:
        return "w-full";
    }
  };

  if (isClean) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D] font-ui flex flex-col">
        <StorefrontHeader />
        <main className="flex-1">
          {activeTab === "option1" && <Option1Spotlight />}
          {activeTab === "option2" && <Option2TwoCityCards />}
          {activeTab === "option3" && <Option3FullBleedDock />}
          {activeTab === "option4" && <Option4StoreJourney />}
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#2D2D2D] font-ui flex flex-col">
      {/* Internal Preview Admin Banner */}
      <header className="sticky top-0 z-40 bg-[#2D2D2D] text-white py-3 px-4 sm:px-6 shadow-md border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#FAF8F5]/80 hover:text-white px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Homepage
            </Link>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7C9C59] animate-pulse" />
              <h1 className="text-xs sm:text-sm font-bold tracking-wide">
                Kotson Store Section Redesign — 4 Design Options Gallery
              </h1>
            </div>
          </div>

          {/* Viewport Width Controls */}
          <div className="flex items-center gap-1.5 self-start md:self-auto bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setViewportMode("fluid")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                viewportMode === "fluid" ? "bg-[#467065] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              Fluid Width
            </button>
            <button
              onClick={() => setViewportMode("desktop")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                viewportMode === "desktop" ? "bg-[#467065] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              <Monitor className="w-3 h-3" /> 1440px
            </button>
            <button
              onClick={() => setViewportMode("tablet")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                viewportMode === "tablet" ? "bg-[#467065] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              <Tablet className="w-3 h-3" /> 768px
            </button>
            <button
              onClick={() => setViewportMode("mobile")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                viewportMode === "mobile" ? "bg-[#467065] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              <Smartphone className="w-3 h-3" /> 390px
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Sub-bar for Selecting Specific Options */}
      <div className="bg-white border-b border-[#2D2D2D]/10 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "all" ? "bg-[#467065] text-white" : "bg-[#FAF8F5] text-[#5C6656] hover:text-[#2D2D2D]"
              }`}
            >
              All 4 Options (Comparative View)
            </button>
            <button
              onClick={() => setActiveTab("option1")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "option1" ? "bg-[#467065] text-white" : "bg-[#FAF8F5] text-[#5C6656] hover:text-[#2D2D2D]"
              }`}
            >
              Option 1 — Editorial Spotlight
            </button>
            <button
              onClick={() => setActiveTab("option2")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "option2" ? "bg-[#467065] text-white" : "bg-[#FAF8F5] text-[#5C6656] hover:text-[#2D2D2D]"
              }`}
            >
              Option 2 — Two-City Cards
            </button>
            <button
              onClick={() => setActiveTab("option3")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "option3" ? "bg-[#467065] text-white" : "bg-[#FAF8F5] text-[#5C6656] hover:text-[#2D2D2D]"
              }`}
            >
              Option 3 — Full-Bleed Dock
            </button>
            <button
              onClick={() => setActiveTab("option4")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "option4" ? "bg-[#467065] text-white" : "bg-[#FAF8F5] text-[#5C6656] hover:text-[#2D2D2D]"
              }`}
            >
              Option 4 — Store Journey
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[#5C6656]">
            <ShieldCheck className="w-4 h-4 text-[#7C9C59]" />
            <span>Live production homepage remains 100% untouched</span>
          </div>
        </div>
      </div>

      {/* Main Preview Container */}
      <main className="flex-1 py-8 px-2 sm:px-4 flex flex-col items-center">
        <div className={`transition-all duration-300 w-full ${getContainerWidth()} mx-auto space-y-16`}>
          {/* OPTION 1 */}
          {(activeTab === "all" || activeTab === "option1") && (
            <div id="preview-option-1" className="bg-white rounded-3xl border border-[#2D2D2D]/15 overflow-hidden shadow-lg">
              <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#2D2D2D]/10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#467065] bg-[#467065]/10 px-2 py-0.5 rounded">
                    OPTION 1
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#2D2D2D] mt-1">
                    Editorial Store Spotlight
                  </h3>
                  <p className="text-xs text-[#5C6656]">
                    Asymmetric layout with dominant showroom frame and overlapping location selector.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#467065] bg-white px-3 py-1 rounded-full border border-[#2D2D2D]/10">
                  Numbered City Rows • Integrated Search • Bottom Benefits Bar
                </div>
              </div>

              <Option1Spotlight />
            </div>
          )}

          {/* OPTION 2 */}
          {(activeTab === "all" || activeTab === "option2") && (
            <div id="preview-option-2" className="bg-white rounded-3xl border border-[#2D2D2D]/15 overflow-hidden shadow-lg">
              <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#2D2D2D]/10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#467065] bg-[#467065]/10 px-2 py-0.5 rounded">
                    OPTION 2
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#2D2D2D] mt-1">
                    Two-City Experience Cards
                  </h3>
                  <p className="text-xs text-[#5C6656]">
                    Two balanced, typography-led editorial cards supported by an architectural showroom visual.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#467065] bg-white px-3 py-1 rounded-full border border-[#2D2D2D]/10">
                  Equal Two-Card Balance • Top Search Row • Middle Benefits Strip
                </div>
              </div>

              <Option2TwoCityCards />
            </div>
          )}

          {/* OPTION 3 */}
          {(activeTab === "all" || activeTab === "option3") && (
            <div id="preview-option-3" className="bg-white rounded-3xl border border-[#2D2D2D]/15 overflow-hidden shadow-lg">
              <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#2D2D2D]/10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#467065] bg-[#467065]/10 px-2 py-0.5 rounded">
                    OPTION 3
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#2D2D2D] mt-1">
                    Full-Bleed Showroom With Locator Dock
                  </h3>
                  <p className="text-xs text-[#5C6656]">
                    Immersive visual depth with controlled readability overlay and grounded cream locator dock.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#467065] bg-white px-3 py-1 rounded-full border border-[#2D2D2D]/10">
                  Immersive Full-Bleed • Inset Benefits Badge • Base Locator Dock
                </div>
              </div>

              <Option3FullBleedDock />
            </div>
          )}

          {/* OPTION 4 */}
          {(activeTab === "all" || activeTab === "option4") && (
            <div id="preview-option-4" className="bg-white rounded-3xl border border-[#2D2D2D]/15 overflow-hidden shadow-lg">
              <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#2D2D2D]/10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#467065] bg-[#467065]/10 px-2 py-0.5 rounded">
                    OPTION 4
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#2D2D2D] mt-1">
                    Store Journey Layout
                  </h3>
                  <p className="text-xs text-[#5C6656]">
                    Structured 3-step visit sequence with clean horizontal selector and expandable search.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#467065] bg-white px-3 py-1 rounded-full border border-[#2D2D2D]/10">
                  3 Visit Steps • Horizontal Tabs • Expandable Location Search
                </div>
              </div>

              <Option4StoreJourney />
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
