import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Category, Claim, Product } from "@/lib/types";
import { parseJsonBlock } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SevenZones, { DEFAULT_ZONES, type Zone } from "@/components/home/SevenZones";
import VideoHero from "@/components/home/VideoHero";
import SleepRibbon from "@/components/home/SleepRibbon";
import ExploreCategories from "@/components/home/ExploreCategories";
import WhatsInside from "@/components/home/WhatsInside";
import ProductGrid from "@/components/product/ProductGrid";

interface StatSlot { value: string; label: string; pending?: boolean }
interface Benefit { title: string; body: string }
interface ProcessStep { n: number; title: string; body: string }
interface Testimonial { name: string; text: string; rating: number }

export default function Home() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "home"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=home"),
  });
  const { data: publishedClaims } = useQuery({
    queryKey: ["claims"],
    queryFn: () => apiGet<Claim[]>("/content/claims"),
  });
  const { data: pendingClaims } = useQuery({
    queryKey: ["claims-pending"],
    queryFn: () => apiGet<Claim[]>("/content/claims/pending"),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/catalog/categories"),
  });
  const { data: featured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => apiGet<Product[]>("/catalog/products?sort=featured"),
  });

  const stats = parseJsonBlock<StatSlot[]>(blocks?.stat_slots ?? "[]", []);
  const benefits = parseJsonBlock<Benefit[]>(blocks?.trust_benefits ?? "[]", []);
  const zones = parseJsonBlock<Zone[]>(blocks?.zones ?? "[]", DEFAULT_ZONES);
  const steps = parseJsonBlock<ProcessStep[]>(blocks?.process_steps ?? "[]", []);
  const testimonials = parseJsonBlock<Testimonial[]>(blocks?.testimonials ?? "[]", []);
  const featuredProducts = (featured ?? []).filter((p) => p.in_stock).slice(0, 4);

  return (
    <div className="min-h-svh">
      <StorefrontHeader />

      <main>
        {/* HERO — full-width looping video starting at y = 0 */}
        <VideoHero />

        {/* SECTION 2: IMMERSIVE SCROLLING ANNOUNCEMENT / SLEEP RIBBON */}
        <SleepRibbon />

        {/* SECTION 3: EXPLORE OUR CATEGORIES (CONTINUOUS SHOWROOM) */}
        <ExploreCategories />

        {/* SECTION 4: WHAT'S INSIDE KOTSON? (DUAL TYPOGRAPHY 3D SHOWCASE) */}
        <WhatsInside />

        {/* SECTION 5: WHAT MAKES US DIFFERENT? (TRUST BENEFITS) */}
        <section id="why-kotson" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:py-20 sm:px-6" aria-label="Why Kotson">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <p className="font-ui text-eyebrow text-brand-deep">WHAT MAKES US</p>
            <h2 className="mt-1.5 font-display text-display-lg text-brand-charcoal">
              Different.
            </h2>
            <p className="mt-2 font-ui text-sm sm:text-base text-muted-foreground">
              Every detail engineered for pure recovery and unmatched spine health.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <div key={b.title} className={`rounded-2xl border border-border bg-card p-6 ${i % 3 === 0 ? "sm:mt-6" : ""}`} data-testid={`benefit-${i}`}>
                <Sparkles className="h-5 w-5 text-brand-leaf" aria-hidden="true" />
                <h3 className="mt-3 font-ui text-base font-bold text-brand-charcoal">{b.title}</h3>
                <p className="mt-1.5 font-ui text-sm text-muted-foreground leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURED — live from catalog (COMMERCE SECTION IN MANROPE) */}
        <section className="bg-brand-sand/60 py-16 sm:py-20" aria-label="Featured products">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-ui text-eyebrow text-brand-deep">CURATED COMFORT</p>
                <h2 className="mt-1 font-ui text-section-title text-brand-charcoal">
                  {blocks?.featured_heading ?? "Featured products"}
                </h2>
                <p className="mt-1.5 font-ui text-sm sm:text-base text-muted-foreground">{blocks?.featured_sub ?? ""}</p>
              </div>
              <Link to="/collections" className={buttonVariants({ variant: "ghost" }) + " font-ui font-medium"} data-testid="featured-view-all">
                View all
              </Link>
            </div>
            <div className="mt-8">
              <ProductGrid products={featuredProducts} testId="featured-grid" />
            </div>
          </div>
        </section>

        {/* SEVEN ZONES — STORYTELLING HEADLINE + FUNCTIONAL MANROPE */}
        <section id="zones" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:py-20 sm:px-6" aria-label="Seven support zones">
          <div className="max-w-2xl mb-8">
            <p className="font-ui text-eyebrow text-brand-deep">ANATOMICAL 7-ZONE SUPPORT</p>
            <h2 className="mt-1.5 font-display text-display-lg text-brand-charcoal">
              {blocks?.zones_heading ?? "Sleep the Way Nature Intended."}
            </h2>
            <p className="mt-2 font-ui text-sm sm:text-base text-muted-foreground">{blocks?.zones_sub ?? "Targeted contouring engineered to keep your spine in zero-gravity balance."}</p>
          </div>
          <div className="mt-6">
            <SevenZones zones={zones} />
          </div>
        </section>

        {/* PROCESS — HOW IT'S MADE */}
        <section className="bg-brand-charcoal py-16 sm:py-20 text-brand-sand" aria-label="How it's made">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="font-ui text-eyebrow text-brand-leaf">FROM TREE SAP TO YOUR BEDROOM</p>
            <h2 className="mt-1.5 font-display text-display-lg text-brand-sand">
              {blocks?.process_heading ?? "Made by Nature. Designed for Better Sleep."}
            </h2>
            <p className="mt-2 font-ui text-sm sm:text-base text-brand-sand/70">{blocks?.process_sub ?? ""}</p>
            <ol className="mt-10 grid gap-4 md:grid-cols-4" data-testid="process-steps">
              {steps.map((s) => (
                <li key={s.n} className="rounded-2xl bg-white/5 p-6 backdrop-blur">
                  <span className="font-ui text-3xl sm:text-4xl font-black text-brand-leaf">{String(s.n).padStart(2, "0")}</span>
                  <h3 className="mt-3 font-ui text-base font-bold text-brand-sand">{s.title}</h3>
                  <p className="mt-2 font-ui text-sm leading-relaxed text-brand-sand/75">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CERTIFICATIONS + CLAIMS (GOLS + SCIENTIFIC CREDIBILITY IN MANROPE) */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6" aria-label="Certifications and claims">
          <div className="max-w-2xl mb-8">
            <p className="font-ui text-eyebrow text-brand-deep">100% GOLS CERTIFIED LATEX</p>
            <h2 className="mt-1.5 font-display text-display-lg text-brand-charcoal">
              {blocks?.certifications_heading ?? "Better Sleep Begins with Better Materials."}
            </h2>
            <p className="mt-2 font-ui text-sm sm:text-base text-muted-foreground">{blocks?.certifications_sub ?? "Third-party tested and certified for chemical purity, zero toxins, and natural sustainability."}</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="claims-grid">
            {(publishedClaims ?? []).map((c) => (
              <div key={c.key} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5" data-testid={`claim-${c.key}`}>
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-leaf" aria-hidden="true" />
                <div>
                  <p className="font-ui font-semibold text-brand-charcoal">{c.label}</p>
                  {c.evidence_url && (
                    <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="font-ui text-xs text-brand-deep underline mt-0.5 inline-block">
                      View proof
                    </a>
                  )}
                  {c.conditions && <p className="mt-1 font-ui text-xs text-muted-foreground">{c.conditions}</p>}
                </div>
              </div>
            ))}
            {(pendingClaims ?? []).map((c) => (
              <div key={c.key} className="rounded-2xl border border-dashed border-brand-amber/50 bg-brand-amber/5 p-5" data-testid={`claim-pending-${c.key}`}>
                <Badge variant="outline" className="border-brand-amber text-brand-amber font-ui text-[11px]">Owner verification pending</Badge>
                <p className="mt-2 font-ui font-semibold text-foreground/70">{c.label}</p>
                <p className="mt-1 font-ui text-xs text-muted-foreground">Will publish once approved evidence is on file.</p>
              </div>
            ))}
          </div>

          {/* SHARK TANK SECTION */}
          <div className="mt-8 rounded-2xl border border-border bg-brand-deep/5 p-6 sm:p-8" data-testid="sharktank-block">
            <p className="font-ui text-eyebrow text-brand-deep">SHARK TANK INDIA</p>
            <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-normal text-brand-charcoal">
              A Moment That Changed Our Journey.
            </h3>
            <p className="mt-2 font-ui text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {blocks?.sharktank_body ?? "Media block reserved pending owner-approved evidence."}
            </p>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-20 sm:px-6" aria-label="Testimonials">
          <div className="text-center max-w-xl mx-auto mb-10">
            <p className="font-ui text-eyebrow text-brand-deep">REAL EXPERIENCES</p>
            <h2 className="mt-1.5 font-display text-display-lg text-brand-charcoal">
              {blocks?.testimonials_heading ?? "Comfort, Naturally."}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3" data-testid="testimonials-grid">
            {testimonials.map((t, i) => (
              <blockquote key={i} className="rounded-2xl border border-border bg-card p-6" data-testid={`testimonial-${i}`}>
                <p className="font-ui text-sm sm:text-[15px] leading-relaxed text-brand-charcoal/85">“{t.text}”</p>
                <footer className="mt-4 font-ui text-xs font-semibold text-brand-deep">{t.name}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="rounded-3xl bg-brand-deep px-6 py-14 text-center text-white sm:px-12 shadow-sm">
            <h2 className="font-display text-display-xl text-white">
              {blocks?.final_cta_heading ?? "Where Better Sleep Begins."}
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-ui text-white/80 text-base sm:text-lg leading-relaxed">
              {blocks?.final_cta_sub ?? "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial."}
            </p>
            <Link to="/collections" className={buttonVariants({ size: "lg" }) + " mt-8 bg-white text-brand-deep hover:bg-white/90 font-ui font-semibold shadow-xs"} data-testid="final-cta">
              {blocks?.final_cta_label ?? "Shop the collection"}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
