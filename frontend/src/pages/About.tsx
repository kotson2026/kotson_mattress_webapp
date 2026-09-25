import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import OrganicProcessSection from "@/components/home/OrganicProcessSection";
import CertificationExperience from "@/components/home/CertificationExperience";
import { ShieldCheck, Sparkles, Sprout, Award } from "lucide-react";

export default function About() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "about"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=about"),
  });

  return (
    <div className="min-h-svh bg-[#FAF8F5]">
      <StorefrontHeader />

      <main>
        {/* Editorial Brand Intro Hero */}
        <section className="relative mx-auto max-w-[1360px] px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-ui text-xs sm:text-[13px] font-bold uppercase tracking-[0.16em] text-brand-deep">
              WHY KOTSON
            </p>
            <h1
              data-testid="about-title"
              className="mt-3 font-display text-[34px] sm:text-[46px] lg:text-[56px] font-normal text-brand-charcoal tracking-tight leading-[1.08]"
            >
              {blocks?.about_title ?? "Born from Nature. Built for Restorative Sleep."}
            </h1>
            <p
              data-testid="about-body"
              className="mt-4 font-ui text-[15px] sm:text-[17px] text-brand-charcoal/75 leading-relaxed font-normal"
            >
              {blocks?.about_body ??
                "Founded on a firm belief that modern sleep should not come at the expense of human health or our planet, Kotson pioneers 100% GOLS-certified organic Dunlop latex mattresses directly harvested from Kerala's rubber tree groves. Every layer is crafted with pure, sustainable natural ingredients, zero synthetic fillers, and uncompromising quality."}
            </p>
          </div>

          {/* Differentiating Pillars */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Sprout className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                100% Natural Dunlop Latex
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Tapped sustainably from Hevea Brasiliensis rubber trees in Kerala. Pure botanical latex without polyurethane or synthetic petrochemical foams.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Zero Chemical Off-Gassing
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Completely free of VOCs, chemical flame retardants, formaldehyde, and toxic heavy metals. Breathable and naturally hypoallergenic.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Award className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Globally Certified Standards
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Validated by world-renowned certification bodies including GOLS Organic, eco-INSTITUT, and OEKO-TEX Standard 100 for safety and purity.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep mb-4">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base font-bold text-brand-charcoal">
                Durable Resilience
              </h2>
              <p className="mt-2 text-xs sm:text-[13px] text-brand-charcoal/70 leading-relaxed">
                Organic Dunlop latex offers exceptional resilience and longevity, resisting body impressions and sagging season after season.
              </p>
            </div>
          </div>
        </section>

        {/* Manufacturing & Natural Process (Verified Component) */}
        <OrganicProcessSection />

        {/* Global Certifications & Trust Experience (Verified Component) */}
        <CertificationExperience />

        {/* Corporate Trust & Details */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="font-ui text-base font-bold uppercase tracking-[0.08em] text-brand-deep">
              Company &amp; Trust Information
            </h2>
            <p className="mt-2.5 font-ui text-sm leading-relaxed text-muted-foreground">
              KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. Registered details, GSTIN, and official contact information are published and verified. We take pride in transparent manufacturing, fair rubber plantation sourcing, and bringing pure organic sleep to homes across India.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
