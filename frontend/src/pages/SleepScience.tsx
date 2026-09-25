import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SevenZonesSection from "@/components/home/SevenZonesSection";
import WhatsInside from "@/components/home/WhatsInside";
import { ShieldCheck, Wind, Activity, Feather } from "lucide-react";

export default function SleepScience() {
  return (
    <div className="min-h-svh bg-[#FAF8F5]">
      <StorefrontHeader />

      <main>
        {/* Page Hero */}
        <section className="relative mx-auto max-w-[1360px] px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-ui text-xs sm:text-[13px] font-bold uppercase tracking-[0.16em] text-brand-deep">
              SLEEP SCIENCE & ERGONOMIC DESIGN
            </p>
            <h1
              data-testid="sleep-science-title"
              className="mt-3 font-display text-[34px] sm:text-[46px] lg:text-[56px] font-normal text-brand-charcoal tracking-tight leading-[1.08]"
            >
              The Science of Ergonomic Comfort & Restorative Sleep
            </h1>
            <p className="mt-4 font-ui text-[15px] sm:text-[17px] text-brand-charcoal/75 leading-relaxed font-normal">
              Designed around human anatomy and natural materials. Discover how Kotson&apos;s 7-zone ergonomic engineering, open-cell organic latex, and breathable pincore airflow work harmoniously to promote natural spinal alignment and pressure-relieving comfort.
            </p>
          </div>

          {/* Core Science Pillars (Verified Principles - No Medical Claims) */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Activity className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Ergonomic Spinal Support
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Engineered with differentiated support zones to encourage natural spine alignment whether sleeping on your back, side, or stomach.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Feather className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Targeted Pressure Relief
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                High-elasticity Dunlop latex yields gently at broader contact zones like shoulders and hips, distributing body weight evenly.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Wind className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Breathable Pin-Core Airflow
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Interconnected micro-pores and vertical pincore channels allow body heat to dissipate naturally, avoiding heat retention.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Zero Motion Transfer
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                The dense molecular structure of natural rubber absorbs localized pressure immediately, isolating partner movements across the mattress.
              </p>
            </div>
          </div>
        </section>

        {/* 7-Zone Ergonomic Support Section (Verified Component) */}
        <SevenZonesSection />

        {/* Mattress Layer Architecture (Verified Component) */}
        <WhatsInside />

        {/* Mattress Firmness & Ergonomic Selection Guidance */}
        <section className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
          <div className="rounded-3xl border border-[#E8E3D8] bg-[#FAF9F5] p-6 sm:p-10 lg:p-14">
            <div className="max-w-2xl">
              <p className="font-ui text-xs font-bold uppercase tracking-[0.16em] text-brand-deep">
                CHOOSING YOUR COMFORT
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-normal text-brand-charcoal">
                Finding the Right Support for Your Sleeping Posture
              </h2>
              <p className="mt-3 text-sm sm:text-base text-brand-charcoal/75 leading-relaxed">
                Everyone sleeps differently. Understanding how mattress firmness and pillow contouring interact with your body helps ensure sound, comfortable rest every night.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#E8E3D8]/80 bg-white p-6">
                <span className="inline-block rounded-full bg-brand-deep/10 px-3 py-1 text-xs font-bold text-brand-deep">
                  Side Sleepers
                </span>
                <h3 className="mt-3 font-heading text-base font-bold text-brand-charcoal">
                  Medium-Soft to Medium
                </h3>
                <p className="mt-2 text-xs text-brand-charcoal/70 leading-relaxed">
                  Allows shoulders and hips to sink comfortably into the mattress, keeping the spine level horizontally without uncomfortable pressure buildup.
                </p>
              </div>

              <div className="rounded-2xl border border-[#E8E3D8]/80 bg-white p-6">
                <span className="inline-block rounded-full bg-brand-deep/10 px-3 py-1 text-xs font-bold text-brand-deep">
                  Back & Combination Sleepers
                </span>
                <h3 className="mt-3 font-heading text-base font-bold text-brand-charcoal">
                  Medium-Firm Support
                </h3>
                <p className="mt-2 text-xs text-brand-charcoal/70 leading-relaxed">
                  Provides balanced pushback beneath the lumbar curve while contouring softly to body contours, facilitating effortless turning during the night.
                </p>
              </div>

              <div className="rounded-2xl border border-[#E8E3D8]/80 bg-white p-6">
                <span className="inline-block rounded-full bg-brand-deep/10 px-3 py-1 text-xs font-bold text-brand-deep">
                  Cervical & Head Support
                </span>
                <h3 className="mt-3 font-heading text-base font-bold text-brand-charcoal">
                  Ergonomic Pillow Contouring
                </h3>
                <p className="mt-2 text-xs text-brand-charcoal/70 leading-relaxed">
                  Kotson contoured natural latex pillows maintain the cervical curve of the neck, helping bridge the gap between head and mattress surface comfortably.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
