import BenefitsStrip from "./BenefitsStrip";

/* ─── Kotson design tokens ───────────────────────────────────────
   brand-leaf    #7C9C59
   brand-deep    #467065
   brand-charcoal #2D2D2D
   brand-cream   #FAF8F5
   border        #E5E0D5
───────────────────────────────────────────────────────────────── */

export default function SevenZonesSection() {
  return (
    <section
      id="zones"
      aria-label="What Makes Us Different? 7-Zone Organic Mattress Support"
      className="relative w-full bg-[#FAF8F5] border-t border-border/50 select-none scroll-mt-20"
      style={{ paddingTop: "48px" }}
    >
      {/* Anchor */}
      <span id="why-kotson" className="absolute -top-24 pointer-events-none" aria-hidden="true" />

      {/* Ambient blurs */}
      <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl" aria-hidden="true" />

      {/* ── Header + image ─────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1360px] w-full px-4 sm:px-6 lg:px-10 pb-12 sm:pb-16 lg:pb-20">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <p className="font-ui text-xs sm:text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.14em] text-brand-deep">
            WHAT MAKES US DIFFERENT?
          </p>
          <h2 className="mt-2 font-display text-[32px] sm:text-[44px] lg:text-[54px] font-normal text-brand-charcoal tracking-tight leading-[1.08]">
            Support,{" "}
            <br className="hidden sm:inline" />
            Where Your Body Needs It.
          </h2>
          <p className="mt-3 font-ui text-[14px] sm:text-[15px] lg:text-[16px] text-brand-charcoal/75 leading-relaxed font-normal">
            Seven thoughtfully designed comfort zones work across the mattress to support different areas of your body.
          </p>
        </div>

        {/* 7-Zone image */}
        <div className="w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E3D8]/80 shadow-xs bg-[#FAF9F5]">
          <img
            src="https://cdn.phototourl.com/member/2026-09-22-feb051a4-db5e-4b7e-95ff-81f431f54595.png"
            alt="7-Zone Organic Mattress Body Support: Head & Neck, Back & Shoulders, Lower Back, Hips & Thighs, Knees, Lower Legs, Feet"
            width={2006}
            height={784}
            className="w-full h-auto block object-contain select-none"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* ── Benefits infinite scroll strip (Centralized Component) ─────────────────────────── */}
      <BenefitsStrip />
    </section>
  );
}
