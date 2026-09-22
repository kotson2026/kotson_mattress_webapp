import { useState } from "react";

interface MattressLayersCardProps {
  progress: number; // 0 (exploded) to 1 (assembled)
  activeLayerId: "cover" | "casing" | "core" | null;
  onSelectLayer?: (id: "cover" | "casing" | "core") => void;
  activeStage: number; // 0: exploded, 1: bamboo, 2: cotton, 3: latex, 4: assembled
}

export default function MattressLayersCard({
  progress,
  activeLayerId,
  onSelectLayer,
  activeStage: _activeStage,
}: MattressLayersCardProps) {
  // Allow manual toggle between Exploded and Assembled view
  const [manualMode, setManualMode] = useState<"auto" | "exploded" | "assembled">("auto");
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  // Auto mode uses scroll progress; manual mode overrides
  const effectiveProgress =
    manualMode === "exploded"
      ? 0
      : manualMode === "assembled"
      ? 1
      : progress;

  // Calculate vertical separation offsets based on effective progress
  // At progress 0 (exploded):
  // Cover is high: translateY(-110px) on desktop, translateY(-65px) on mobile
  // Casing is middle: translateY(-40px) on desktop, translateY(-25px) on mobile
  // Core is baseline: translateY(40px) on desktop, translateY(20px) on mobile
  // At progress 1 (assembled):
  // All layers dock together into the unified finished mattress!
  
  // Clamped spring-like easing for physical descent
  const coverOffset = Math.max(0, 1 - Math.min(1, effectiveProgress / 0.85)) * -105;
  const casingOffset = Math.max(0, 1 - Math.min(1, effectiveProgress / 0.55)) * -45;
  const coreOffset = Math.max(0, 1 - Math.min(1, effectiveProgress / 0.35)) * 35;

  const isCompleted = effectiveProgress >= 0.88;

  // Selected or hovered layer
  const currentHighlight = hoveredLayer || activeLayerId;

  return (
    <div className="relative w-full h-full rounded-3xl bg-[#FAF9F5] border border-[#E8E3D8] shadow-xs overflow-hidden flex flex-col justify-between p-4 sm:p-6 select-none transition-colors duration-500">
      {/* ─── Top Header Bar inside Card: Mode Toggles & Badge ─── */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-ui font-semibold bg-white/90 text-brand-deep border border-[#E3DDCF] shadow-2xs backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-leaf animate-pulse" />
            {isCompleted ? "Assembled Construction" : "3 Natural Layers"}
          </span>
        </div>

        {/* View Toggle (Exploded vs Assembled) */}
        <div className="flex items-center bg-white/80 p-0.5 rounded-full border border-[#E3DDCF] shadow-2xs text-[11px] font-ui font-medium">
          <button
            type="button"
            onClick={() => setManualMode(manualMode === "exploded" ? "auto" : "exploded")}
            className={`px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
              manualMode === "exploded" || (manualMode === "auto" && !isCompleted)
                ? "bg-brand-deep text-white shadow-2xs font-semibold"
                : "text-brand-charcoal/70 hover:text-brand-charcoal"
            }`}
          >
            Exploded View
          </button>
          <button
            type="button"
            onClick={() => setManualMode(manualMode === "assembled" ? "auto" : "assembled")}
            className={`px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
              manualMode === "assembled" || (manualMode === "auto" && isCompleted)
                ? "bg-brand-deep text-white shadow-2xs font-semibold"
                : "text-brand-charcoal/70 hover:text-brand-charcoal"
            }`}
          >
            Assembled
          </button>
        </div>
      </div>

      {/* ─── Center Viewport: 3 Layer Mattress Stacking Scene with Connecting Badges ─── */}
      <div className="relative w-full flex-1 flex items-center justify-center my-2 min-h-[260px] sm:min-h-[340px]">
        {/* Ambient subtle light highlight on background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85%] h-[75%] rounded-full bg-radial from-white/90 via-[#FAF7EE]/50 to-transparent blur-2xl" />
        </div>

        {/* ─── The Mattress Container (Aspect-ratio matched to the isometric renders) ─── */}
        <div className="relative w-[92%] sm:w-[86%] lg:w-[82%] max-w-[560px] aspect-[1672/941] flex items-center justify-center">
          {/* Grounding Contact Shadow */}
          <div
            className="absolute -bottom-4 sm:-bottom-6 w-[88%] h-8 sm:h-12 rounded-full bg-black/15 blur-lg transition-all duration-700 pointer-events-none"
            style={{
              transform: `scale(${isCompleted ? 1 : 0.92})`,
              opacity: isCompleted ? 0.35 : 0.22,
            }}
          />

          {/* ═══ LAYER 1 (BOTTOM): GOLS-Certified 100% Organic Latex Core ═══ */}
          <div
            onClick={() => onSelectLayer?.("core")}
            onMouseEnter={() => setHoveredLayer("core")}
            onMouseLeave={() => setHoveredLayer(null)}
            className="absolute inset-0 transition-transform duration-700 ease-out cursor-pointer group"
            style={{
              transform: `translateY(${coreOffset}px) scale(${currentHighlight === "core" ? 1.025 : 1})`,
              zIndex: 10,
            }}
            title="Layer 3: GOLS-Certified 100% Organic Latex Core"
          >
            <img
              src="/mattress-layers/layer-1-core.png"
              alt="GOLS-Certified 100% Organic Latex Core"
              className={`w-full h-full object-contain filter transition-all duration-300 pointer-events-none drop-shadow-sm ${
                currentHighlight === "core"
                  ? "drop-shadow-[0_8px_20px_rgba(46,90,68,0.25)] brightness-105"
                  : ""
              }`}
              loading="eager"
            />
          </div>

          {/* Dynamic Shadow between Core and Casing */}
          {!isCompleted && (
            <div
              className="absolute w-[80%] h-6 sm:h-8 rounded-full bg-black/10 blur-md pointer-events-none transition-opacity duration-500"
              style={{
                transform: `translateY(${casingOffset + 20}px)`,
                opacity: (1 - effectiveProgress) * 0.4,
                zIndex: 15,
              }}
            />
          )}

          {/* ═══ LAYER 2 (MIDDLE): Thin Cotton Zip Cover ═══ */}
          <div
            onClick={() => onSelectLayer?.("casing")}
            onMouseEnter={() => setHoveredLayer("casing")}
            onMouseLeave={() => setHoveredLayer(null)}
            className="absolute inset-0 transition-transform duration-700 ease-out cursor-pointer group"
            style={{
              transform: `translateY(${casingOffset}px) scale(${currentHighlight === "casing" ? 1.025 : 1})`,
              zIndex: 20,
            }}
            title="Layer 2: Thin Cotton Zip Cover"
          >
            <img
              src="/mattress-layers/layer-2-casing.png"
              alt="Thin Cotton Zip Cover"
              className={`w-full h-full object-contain filter transition-all duration-300 pointer-events-none drop-shadow-sm ${
                currentHighlight === "casing"
                  ? "drop-shadow-[0_8px_20px_rgba(46,90,68,0.25)] brightness-105"
                  : ""
              }`}
              loading="eager"
            />
          </div>

          {/* Dynamic Shadow between Casing and Cover */}
          {!isCompleted && (
            <div
              className="absolute w-[80%] h-6 sm:h-8 rounded-full bg-black/12 blur-md pointer-events-none transition-opacity duration-500"
              style={{
                transform: `translateY(${coverOffset + 24}px)`,
                opacity: (1 - effectiveProgress) * 0.45,
                zIndex: 25,
              }}
            />
          )}

          {/* ═══ LAYER 3 (TOP): 100% Pure Bamboo Cover ═══ */}
          <div
            onClick={() => onSelectLayer?.("cover")}
            onMouseEnter={() => setHoveredLayer("cover")}
            onMouseLeave={() => setHoveredLayer(null)}
            className="absolute inset-0 transition-transform duration-700 ease-out cursor-pointer group"
            style={{
              transform: `translateY(${coverOffset}px) scale(${currentHighlight === "cover" ? 1.025 : 1})`,
              zIndex: 30,
            }}
            title="Layer 1: 100% Pure Bamboo Cover"
          >
            <img
              src="/mattress-layers/layer-3-cover.png"
              alt="100% Pure Bamboo Cover"
              className={`w-full h-full object-contain filter transition-all duration-300 pointer-events-none drop-shadow-md ${
                currentHighlight === "cover"
                  ? "drop-shadow-[0_12px_24px_rgba(46,90,68,0.3)] brightness-105"
                  : ""
              }`}
              loading="eager"
            />
          </div>

          {/* ─── CALLOUT BADGES WITH CONNECTING LINES (MATCHING REFERENCE IMAGE) ─── */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-40 ${
              isCompleted ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {/* SVG Connecting Lines between badges and mattress layers */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible hidden sm:block">
              {/* Line 1: Bamboo Cover */}
              <g className="transition-all duration-700 ease-out" style={{ transform: `translateY(${coverOffset * 0.9}px)` }}>
                {/* Connecting path from layer side to badge */}
                <line
                  x1="68%"
                  y1="25%"
                  x2="78%"
                  y2="25%"
                  stroke="#C5A46D"
                  strokeWidth="1.5"
                />
                {/* Anchor dot on layer */}
                <circle cx="68%" cy="25%" r="3.5" fill="#C5A46D" />
              </g>

              {/* Line 2: Cotton Zip Cover */}
              <g className="transition-all duration-700 ease-out" style={{ transform: `translateY(${casingOffset * 0.9}px)` }}>
                {/* Connecting path */}
                <line
                  x1="70%"
                  y1="51%"
                  x2="78%"
                  y2="51%"
                  stroke="#C5A46D"
                  strokeWidth="1.5"
                />
                {/* Anchor dot on layer */}
                <circle cx="70%" cy="51%" r="3.5" fill="#C5A46D" />
              </g>

              {/* Line 3: Organic Latex Core */}
              <g className="transition-all duration-700 ease-out" style={{ transform: `translateY(${coreOffset * 0.9}px)` }}>
                {/* Connecting path */}
                <line
                  x1="71%"
                  y1="78%"
                  x2="78%"
                  y2="78%"
                  stroke="#C5A46D"
                  strokeWidth="1.5"
                />
                {/* Anchor dot on layer */}
                <circle cx="71%" cy="78%" r="3.5" fill="#C5A46D" />
              </g>
            </svg>

            {/* Top Badge: 100% Pure Bamboo Cover */}
            <div
              className="absolute right-[-4px] sm:right-[-12px] lg:right-[-20px] transition-transform duration-700 ease-out pointer-events-auto"
              style={{
                top: "16%",
                transform: `translateY(${coverOffset * 0.9}px)`,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectLayer?.("cover")}
                onMouseEnter={() => setHoveredLayer("cover")}
                onMouseLeave={() => setHoveredLayer(null)}
                className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/95 backdrop-blur-md border shadow-md transition-all duration-300 cursor-pointer ${
                  currentHighlight === "cover"
                    ? "border-brand-deep ring-2 ring-brand-deep/20 scale-105 bg-white"
                    : "border-[#E8E2D5] hover:border-brand-leaf/60"
                }`}
              >
                {/* Bamboo Icon matching reference image */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#EBF3ED] flex items-center justify-center shrink-0 text-brand-deep">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v20M16 2v20M8 8c2.5 0 5-1 5-3M8 16c2.5 0 5-1 5-3M16 8c-2.5 0-5-1-5-3M16 16c-2.5 0-5-1-5-3" />
                  </svg>
                </div>
                <span className="font-ui text-[10px] sm:text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.06em] whitespace-nowrap">
                  100% Pure Bamboo Cover
                </span>
              </button>
            </div>

            {/* Middle Badge: Thin Cotton Zip Cover */}
            <div
              className="absolute right-[-4px] sm:right-[-12px] lg:right-[-20px] transition-transform duration-700 ease-out pointer-events-auto"
              style={{
                top: "44%",
                transform: `translateY(${casingOffset * 0.9}px)`,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectLayer?.("casing")}
                onMouseEnter={() => setHoveredLayer("casing")}
                onMouseLeave={() => setHoveredLayer(null)}
                className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/95 backdrop-blur-md border shadow-md transition-all duration-300 cursor-pointer ${
                  currentHighlight === "casing"
                    ? "border-brand-deep ring-2 ring-brand-deep/20 scale-105 bg-white"
                    : "border-[#E8E2D5] hover:border-brand-leaf/60"
                }`}
              >
                {/* Cotton Flower Icon matching reference image */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#EBF3ED] flex items-center justify-center shrink-0 text-brand-deep">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 6a3 3 0 0 0-3 3M12 6a3 3 0 0 1 3 3M18 12a3 3 0 0 0-3-3M18 12a3 3 0 0 1-3 3M12 18a3 3 0 0 1-3-3M12 18a3 3 0 0 0 3-3M6 12a3 3 0 0 1 3-3M6 12a3 3 0 0 0 3 3" />
                  </svg>
                </div>
                <span className="font-ui text-[10px] sm:text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.06em] whitespace-nowrap">
                  Thin Cotton Zip Cover
                </span>
              </button>
            </div>

            {/* Bottom Badge: GOLS-Certified 100% Organic Latex Core */}
            <div
              className="absolute right-[-4px] sm:right-[-12px] lg:right-[-20px] transition-transform duration-700 ease-out pointer-events-auto"
              style={{
                top: "72%",
                transform: `translateY(${coreOffset * 0.9}px)`,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectLayer?.("core")}
                onMouseEnter={() => setHoveredLayer("core")}
                onMouseLeave={() => setHoveredLayer(null)}
                className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/95 backdrop-blur-md border shadow-md transition-all duration-300 cursor-pointer ${
                  currentHighlight === "core"
                    ? "border-brand-deep ring-2 ring-brand-deep/20 scale-105 bg-white"
                    : "border-[#E8E2D5] hover:border-brand-leaf/60"
                }`}
              >
                {/* Leaf / Organic Sap Icon matching reference image */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#EBF3ED] flex items-center justify-center shrink-0 text-brand-deep">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                  </svg>
                </div>
                <span className="font-ui text-[10px] sm:text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.06em] whitespace-nowrap">
                  GOLS-Certified Organic Latex Core
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Status Bar (Matching Image 4 Placement) ─── */}
      <div className="z-20 flex items-center justify-between text-[11px] sm:text-xs font-ui font-medium text-brand-charcoal/75 bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-[#E3DDCF] shadow-2xs">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-leaf" />
          <span className="font-semibold text-brand-charcoal">
            {isCompleted
              ? "Complete Kotson Mattress"
              : currentHighlight === "cover"
              ? "100% Pure Bamboo Cover"
              : currentHighlight === "casing"
              ? "Thin Cotton Zip Cover"
              : currentHighlight === "core"
              ? "GOLS-Certified Organic Latex Core"
              : "Separated Physical Layers"}
          </span>
        </span>
        <span className="text-brand-charcoal/50 font-normal hidden sm:inline">
          {isCompleted
            ? "Fully docked into unified sleep system"
            : "Click any layer or badge to inspect details"}
        </span>
      </div>
    </div>
  );
}
