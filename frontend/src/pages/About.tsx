import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";

export default function About() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "about"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=about"),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-ui text-eyebrow text-brand-deep">ABOUT KOTSON</p>
        <h1 className="mt-2 font-display text-display-xl text-brand-charcoal" data-testid="about-title">
          {blocks?.about_title ?? "Born from Nature. Built for Better Sleep."}
        </h1>
        <p className="mt-6 font-ui text-base sm:text-lg leading-relaxed text-muted-foreground font-normal" data-testid="about-body">
          {blocks?.about_body ?? "Founded on a belief that modern sleep should not come at the expense of our health or planet, Kotson pioneers 100% GOLS-certified organic Dunlop latex mattresses directly harvested from Kerala's rubber tree groves."}
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-ui text-base font-bold uppercase tracking-[0.08em] text-brand-deep">Company</h2>
          <p className="mt-2.5 font-ui text-sm leading-relaxed text-muted-foreground">
            KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. Registered details, GSTIN and official contact information are
            published once validated by the owner.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
