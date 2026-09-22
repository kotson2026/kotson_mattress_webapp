interface Props {
  activeLayerId: string | null;
  onSelectLayer?: (id: string) => void;
  isCompleted?: boolean;
}

export default function MattressLayersFallback({
  activeLayerId,
  onSelectLayer,
  isCompleted = false,
}: Props) {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center p-6 select-none bg-[#FAF8F5]"
      aria-label="Kotson mattress physical layer construction overview"
    >
      <div className="relative w-full max-w-[420px] aspect-[4/3] flex flex-col items-center justify-center">
        {/* Layer 1: 100% Pure Bamboo Cover */}
        <div
          onClick={() => onSelectLayer?.("cover")}
          className={`w-[88%] h-[32px] rounded-xl border transition-all duration-500 cursor-pointer flex items-center justify-between px-4 shadow-sm ${
            isCompleted ? "translate-y-[22px]" : "translate-y-[-24px]"
          } ${
            activeLayerId === "cover"
              ? "border-brand-leaf bg-[#FAF8F2] ring-2 ring-brand-leaf/40 scale-[1.02]"
              : "border-black/10 bg-[#FAF8F2] hover:border-brand-leaf/40"
          }`}
        >
          <span className="font-ui text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.05em]">
            1. Pure Bamboo Cover
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-brand-leaf/80" />
        </div>

        {/* Dynamic Shadow between Bamboo and Cotton */}
        <div
          className={`w-[84%] h-[6px] rounded-full bg-black/15 blur-[3px] transition-all duration-500 ${
            isCompleted ? "opacity-40 scale-x-95" : "opacity-15 scale-x-105 my-1"
          }`}
        />

        {/* Layer 2: Thin Cotton Zip Cover */}
        <div
          onClick={() => onSelectLayer?.("casing")}
          className={`w-[86%] h-[24px] rounded-lg border transition-all duration-500 cursor-pointer flex items-center justify-between px-4 shadow-xs ${
            isCompleted ? "translate-y-[12px]" : "translate-y-0"
          } ${
            activeLayerId === "casing"
              ? "border-brand-leaf bg-[#F5EFE4] ring-2 ring-brand-leaf/40 scale-[1.02]"
              : "border-black/10 bg-[#F5EFE4] hover:border-brand-leaf/40"
          }`}
        >
          <span className="font-ui text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.05em]">
            2. Cotton Zip Cover
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#DACFB5]" />
        </div>

        {/* Dynamic Shadow between Cotton and Core */}
        <div
          className={`w-[82%] h-[6px] rounded-full bg-black/20 blur-[3px] transition-all duration-500 ${
            isCompleted ? "opacity-50 scale-x-95" : "opacity-20 scale-x-105 my-1"
          }`}
        />

        {/* Layer 3: GOLS-Certified 100% Organic Latex Core */}
        <div
          onClick={() => onSelectLayer?.("core")}
          className={`w-[84%] h-[72px] rounded-2xl border transition-all duration-500 cursor-pointer flex flex-col justify-between p-4 shadow-sm ${
            isCompleted ? "translate-y-0" : "translate-y-[24px]"
          } ${
            activeLayerId === "core"
              ? "border-brand-leaf bg-[#E8DFC8] ring-2 ring-brand-leaf/40 scale-[1.02]"
              : "border-black/10 bg-[#E8DFC8] hover:border-brand-leaf/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-ui text-[11px] font-bold text-brand-charcoal uppercase tracking-[0.05em]">
              3. Organic Latex Core
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-brand-deep" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-ui text-brand-charcoal/65">
            <span>7 Anatomical Zones</span>
            <span>100% Tree Sap</span>
          </div>
        </div>

        {/* Bottom Grounding Shadow */}
        <div className="w-[80%] h-[14px] rounded-full bg-black/25 blur-[6px] translate-y-[32px]" />
      </div>
    </div>
  );
}
