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
        {/* HERO — full-width owner-configured YouTube video, directly below the navbar */}
        <VideoHero />

        {/* TRUST BENEFITS */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-label="Why Kotson">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <div key={b.title} className={`rounded-2xl border border-border bg-card p-6 ${i % 3 === 0 ? "sm:mt-6" : ""}`} data-testid={`benefit-${i}`}>
                <Sparkles className="h-5 w-5 text-brand-leaf" aria-hidden="true" />
                <h3 className="mt-3 font-heading text-lg font-bold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CATEGORIES — asymmetric first tile */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-label="Categories">
          <h2 className="font-heading text-3xl font-bold">{blocks?.categories_heading ?? "Shop by category"}</h2>
          <p className="mt-2 text-muted-foreground">{blocks?.categories_sub ?? ""}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-4" data-testid="category-grid">
            {(categories ?? []).map((c, i) => (
              <Link
                key={c.id}
                to={`/collections/${c.slug}`}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-brand-sand p-6 transition-transform hover:-translate-y-1 ${
                  i === 0 ? "md:row-span-2 md:flex md:flex-col md:justify-end" : ""
                }`}
                data-testid={`category-tile-${c.slug}`}
              >
                <span className="font-heading text-xl font-bold group-hover:text-brand-deep">{c.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{c.description}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* FEATURED — live from catalog */}
        <section className="bg-brand-sand/60 py-16" aria-label="Featured products">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-bold">{blocks?.featured_heading ?? "Featured products"}</h2>
                <p className="mt-2 text-muted-foreground">{blocks?.featured_sub ?? ""}</p>
              </div>
              <Link to="/collections" className={buttonVariants({ variant: "ghost" })} data-testid="featured-view-all">
                View all
              </Link>
            </div>
            <div className="mt-8">
              <ProductGrid products={featuredProducts} testId="featured-grid" />
            </div>
          </div>
        </section>

        {/* SEVEN ZONES */}
        <section id="zones" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6" aria-label="Seven support zones">
          <h2 className="font-heading text-3xl font-bold">{blocks?.zones_heading ?? "Seven zones. One spine."}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{blocks?.zones_sub ?? ""}</p>
          <div className="mt-10">
            <SevenZones zones={zones} />
          </div>
        </section>

        {/* PROCESS */}
        <section className="bg-brand-charcoal py-16 text-brand-sand" aria-label="How it's made">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="font-heading text-3xl font-bold">{blocks?.process_heading ?? "From tree sap to your bedroom"}</h2>
            <p className="mt-2 text-brand-sand/70">{blocks?.process_sub ?? ""}</p>
            <ol className="mt-10 grid gap-4 md:grid-cols-4" data-testid="process-steps">
              {steps.map((s) => (
                <li key={s.n} className="rounded-2xl bg-white/5 p-6 backdrop-blur">
                  <span className="font-heading text-4xl font-black text-brand-leaf">{String(s.n).padStart(2, "0")}</span>
                  <h3 className="mt-3 font-heading text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-sand/75">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CERTIFICATIONS + CLAIMS */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-label="Certifications and claims">
          <h2 className="font-heading text-3xl font-bold">{blocks?.certifications_heading ?? "Certifications & proof"}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{blocks?.certifications_sub ?? ""}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="claims-grid">
            {(publishedClaims ?? []).map((c) => (
              <div key={c.key} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5" data-testid={`claim-${c.key}`}>
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-leaf" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{c.label}</p>
                  {c.evidence_url && (
                    <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-deep underline">
                      View proof
                    </a>
                  )}
                  {c.conditions && <p className="mt-1 text-xs text-muted-foreground">{c.conditions}</p>}
                </div>
              </div>
            ))}
            {(pendingClaims ?? []).map((c) => (
              <div key={c.key} className="rounded-2xl border border-dashed border-brand-amber/50 bg-brand-amber/5 p-5" data-testid={`claim-pending-${c.key}`}>
                <Badge variant="outline" className="border-brand-amber text-brand-amber">Owner verification pending</Badge>
                <p className="mt-2 font-semibold text-foreground/70">{c.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Will publish once approved evidence is on file.</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-border bg-brand-deep/5 p-6" data-testid="sharktank-block">
            <p className="font-heading text-lg font-bold">Shark Tank India</p>
            <p className="mt-1 text-sm text-muted-foreground">{blocks?.sharktank_body ?? "Media block reserved pending owner-approved evidence."}</p>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-label="Testimonials">
          <h2 className="font-heading text-3xl font-bold">{blocks?.testimonials_heading ?? "What sleepers say"}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3" data-testid="testimonials-grid">
            {testimonials.map((t, i) => (
              <blockquote key={i} className="rounded-2xl border border-border bg-card p-6" data-testid={`testimonial-${i}`}>
                <p className="text-sm leading-relaxed">“{t.text}”</p>
                <footer className="mt-3 text-xs font-medium text-muted-foreground">{t.name}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="rounded-3xl bg-brand-deep px-6 py-14 text-center text-white sm:px-12">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">{blocks?.final_cta_heading ?? "Ready for deeper sleep?"}</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">{blocks?.final_cta_sub ?? ""}</p>
            <Link to="/collections" className={buttonVariants({ size: "lg" }) + " mt-8 bg-white text-brand-deep hover:bg-white/90"} data-testid="final-cta">
              {blocks?.final_cta_label ?? "Shop the collection"}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
