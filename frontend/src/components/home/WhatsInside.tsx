import { useState, useRef, useEffect, useCallback } from "react";
import MattressLayersCard from "@/components/home/MattressLayersCard";

interface LayerStory {
  id: "cover" | "casing" | "core";
  step: string;
  name: string;
  headline: string;
  description: string;
  detail: string;
  tag: string;
}

const LAYERS_STORY: LayerStory[] = [
  {
    id: "cover",
    step: "01",
    name: "100% PURE BAMBOO COVER",
    headline: "Soft, breathable and naturally comfortable.",
    description: "Harvested from organic bamboo stalks and knitted into a silky, temperature-regulating surface.",
    detail: "Naturally hypoallergenic and antimicrobial, creating a cool microclimate for uninterrupted sleep.",
    tag: "Breathable Surface",
  },
  {
    id: "casing",
    step: "02",
    name: "THIN COTTON ZIP COVER",
    headline: "A breathable protective layer designed for everyday comfort.",
    description: "Unbleached GOTS-certified organic cotton casing tailored to shield the organic core.",
    detail: "Allows unrestricted air circulation between the comfort cover and the latex core while easing zip removal.",
    tag: "Protective Shield",
  },
  {
    id: "core",
    step: "03",
    name: "GOLS-CERTIFIED 100% ORGANIC LATEX CORE",
    headline: "Naturally responsive support at the heart of the mattress.",
    description: "Zero synthetic blends, petrochemical foams, or chemical fire retardants.",
    detail: "Sustainably tapped Dunlop latex offering 7 ergonomic support zones for natural spinal alignment.",
    tag: "Anatomical Core",
  },
];

export default function WhatsInside() {
  const containerRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeStage, setActiveStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // WebGL feature detection
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebglSupported(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      setWebglSupported(false);
    }
  }, []);

  // Native scroll progress calculation via requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (!containerRef.current || prefersReduced) return;

    const rect = containerRef.current.getBoundingClientRect();
    const totalScrollable = rect.height - window.innerHeight;

    if (totalScrollable <= 0) return;

    // Progress from 0 (section top hits viewport top) to 1 (section bottom hits viewport bottom)
    const currentScroll = -rect.top;
    const rawProgress = Math.min(1, Math.max(0, currentScroll / totalScrollable));
    setProgress(rawProgress);

    // Active stage segmentation
    if (rawProgress < 0.18) {
      setActiveStage(0); // Intro / Exploded state
    } else if (rawProgress < 0.42) {
      setActiveStage(1); // Layer 1: Bamboo Cover
    } else if (rawProgress < 0.68) {
      setActiveStage(2); // Layer 2: Cotton Zip Cover
    } else if (rawProgress < 0.86) {
      setActiveStage(3); // Layer 3: Organic Latex Core
    } else {
      setActiveStage(4); // Finished Assembled Mattress
    }
  }, [prefersReduced]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  // Active layer mapping
  const currentLayer =
    activeStage === 1
      ? LAYERS_STORY[0]
      : activeStage === 2
      ? LAYERS_STORY[1]
      : activeStage === 3
      ? LAYERS_STORY[2]
      : null;

  return (
    <section
      ref={containerRef}
      id="whats-inside"
      aria-label="What's Inside Kotson: Nature, Layer by Layer"
      className="relative w-full bg-[#FAF8F5] border-t border-border/50 select-none min-h-[100vh] lg:min-h-[290vh]"
    >
      {/* Accessible semantic content for screen readers */}
      <div className="sr-only">
        <h2>What's Inside Kotson: Nature, Layer by Layer</h2>
        <p>Discover the natural materials thoughtfully layered inside every Kotson mattress.</p>
        <ol>
          {LAYERS_STORY.map((layer) => (
            <li key={layer.id}>
              <h3>{layer.name}</h3>
              <p>{layer.headline}</p>
              <p>{layer.description}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Sticky 100vh interactive viewport container */}
      <div className="lg:sticky lg:top-0 lg:h-screen w-full flex items-center overflow-hidden py-12 lg:py-0">
        {/* Subtle ambient botanical gradient edges */}
        <div
          className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-[1360px] w-full px-4 sm:px-6 lg:px-10 h-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          {/* ─── LEFT COLUMN: Storytelling & Dynamic Material Narrative (38%–42%) ─── */}
          <div className="w-full lg:w-[40%] flex flex-col justify-center z-10 pt-4 lg:pt-0">
            {/* Section Eyebrow (Manrope uppercase 13–15px, letter-spacing 0.14em, Kotson green) */}
            <p className="font-ui text-xs sm:text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.14em] text-brand-deep">
              WHAT'S INSIDE THE MATTRESS?
            </p>

            {/* Main Storytelling Heading (DM Serif Display 52–68px desktop) */}
            <h2 className="mt-2 font-display text-[40px] sm:text-[52px] lg:text-[62px] font-normal text-brand-charcoal tracking-tight leading-[1.04]">
              Nature, <br className="hidden sm:inline" />
              Layer by Layer.
            </h2>

            {/* Supporting Copy (from reference image) */}
            <p className="mt-3 font-ui text-[14px] sm:text-[15px] lg:text-[16px] text-brand-charcoal/75 leading-relaxed max-w-lg font-normal">
              Crafted from nature's finest materials, the mattress combines an ultra-soft organic bamboo cover, a premium cotton inner casing, and a <strong className="font-semibold text-brand-charcoal">100% Organic Latex core</strong>. The result is a sleep surface that is breathable, supportive, resilient, and built to last for years.
            </p>

            {/* Subtle Progress Indicator (01 — 03) */}
            <div className="mt-6 sm:mt-8 flex items-center gap-3">
              <span className="font-ui text-xs font-semibold uppercase tracking-widest text-brand-charcoal/50">
                Layer Stage
              </span>
              <div className="flex items-center gap-1.5 font-ui text-xs font-bold">
                {[1, 2, 3].map((stepNum) => {
                  const isActive = activeStage === stepNum;
                  const isPassed = activeStage > stepNum;
                  return (
                    <div key={stepNum} className="flex items-center gap-1.5">
                      <span
                        className={`transition-colors duration-300 ${
                          isActive
                            ? "text-brand-deep font-bold"
                            : isPassed
                            ? "text-brand-leaf/80"
                            : "text-brand-charcoal/30"
                        }`}
                      >
                        0{stepNum}
                      </span>
                      {stepNum < 3 && <span className="text-brand-charcoal/20 select-none">—</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── DYNAMIC MATERIAL STORY (ONE ACTIVE CARD AT A TIME) ─── */}
            <div className="mt-5 min-h-[170px] sm:min-h-[185px] relative">
              {/* STAGE 0: Initial Exploded State Guidance */}
              {activeStage === 0 && (
                <div className="rounded-2xl border border-border/80 bg-white/70 backdrop-blur p-5 sm:p-6 shadow-xs animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <span className="font-ui text-[11px] font-bold uppercase tracking-wider text-brand-deep bg-brand-deep/8 px-2.5 py-0.5 rounded-full">
                      Physical Architecture
                    </span>
                    <span className="font-ui text-[11px] text-muted-foreground">3 Genuine Layers</span>
                  </div>
                  <h3 className="mt-3 font-ui text-base font-bold text-brand-charcoal">
                    Tapped from nature, structured for sleep.
                  </h3>
                  <p className="mt-1.5 font-ui text-sm text-brand-charcoal/70 leading-relaxed font-normal">
                    Scroll downward to experience how each natural component descends and physically aligns into place.
                  </p>
                </div>
              )}

              {/* STAGES 1 to 3: Active Material Story with Subtle Visual Connector Indicator */}
              {currentLayer && (
                <div
                  key={currentLayer.id}
                  className="rounded-2xl border border-brand-deep/25 bg-white p-5 sm:p-6 shadow-xs ring-1 ring-brand-deep/10 animate-in fade-in slide-in-from-bottom-2 duration-300 relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-xs font-bold text-brand-deep">
                        {currentLayer.step} / 03
                      </span>
                      <span className="h-1 w-1 rounded-full bg-brand-leaf" />
                      <span className="font-ui text-[11px] font-semibold text-brand-charcoal/60 uppercase tracking-wider">
                        {currentLayer.tag}
                      </span>
                    </div>
                  </div>

                  {/* Material Name in Manrope Bold/SemiBold */}
                  <h3 className="mt-2.5 font-ui text-[13px] sm:text-sm font-bold uppercase tracking-[0.05em] text-brand-charcoal">
                    {currentLayer.name}
                  </h3>

                  {/* Supporting Copy in Manrope Regular */}
                  <p className="mt-1.5 font-ui text-sm sm:text-[15px] font-medium text-brand-deep leading-snug">
                    {currentLayer.headline}
                  </p>

                  <p className="mt-2 font-ui text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed font-normal">
                    {currentLayer.description}
                  </p>

                  {/* Subtle directional connector cue */}
                  <div className="hidden lg:flex items-center gap-1 mt-3 pt-3 border-t border-border/50 text-[11px] font-ui font-medium text-brand-charcoal/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-leaf animate-pulse" />
                    <span>Highlighted in 3D construction scene</span>
                  </div>
                </div>
              )}

              {/* STAGE 4: Final Assembled Mattress State */}
              {activeStage === 4 && (
                <div className="rounded-2xl border border-brand-deep/30 bg-white p-5 sm:p-6 shadow-sm ring-1 ring-brand-deep/15 animate-in fade-in zoom-in-95 duration-400">
                  <span className="font-ui text-[11px] font-bold uppercase tracking-wider text-brand-leaf bg-brand-leaf/10 px-2.5 py-0.5 rounded-full">
                    Completed Assembly
                  </span>
                  {/* Story Statement in Serif */}
                  <h3 className="mt-3 font-display text-xl sm:text-2xl text-brand-charcoal font-normal">
                    Naturally Made. <br />
                    Thoughtfully Layered.
                  </h3>
                  {/* Supporting Copy in Manrope */}
                  <p className="mt-2 font-ui text-sm text-brand-charcoal/75 leading-relaxed font-normal">
                    Everything you need for better sleep. Nothing you don't.
                  </p>
                  <p className="mt-3 font-ui text-xs text-brand-deep font-medium">
                    ✦ Drag on desktop to inspect finished craftsmanship
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Photorealistic Mattress Construction Scene (Image 4 Placement) ─── */}
          <div className="w-full lg:w-[58%] h-[420px] sm:h-[480px] lg:h-[560px] flex items-center justify-center relative">
            <MattressLayersCard
              progress={prefersReduced ? 0 : progress}
              activeLayerId={currentLayer?.id ?? null}
              activeStage={activeStage}
              onSelectLayer={(id) => {
                if (id === "cover") setActiveStage(1);
                else if (id === "casing") setActiveStage(2);
                else if (id === "core") setActiveStage(3);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
