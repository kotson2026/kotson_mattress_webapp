import React from "react";
import { Link } from "react-router-dom";
import type { Product, Variant } from "@/lib/types";
import { inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import ProductGallery from "@/components/product/ProductGallery";
import VariantSelector from "@/components/product/VariantSelector";
import ProductCarousel from "@/components/product/ProductCarousel";
import StickyMobileBar from "@/components/product/StickyMobileBar";

// Storytelling sections
import ProductStoryIntro from "./ProductStoryIntro";
import ProductLifestyleSection from "./ProductLifestyleSection";
import ProductConstruction from "./ProductConstruction";
import ProductFitGuide from "./ProductFitGuide";
import ProductCertifications from "./ProductCertifications";
import ProductInformationAccordion from "./ProductInformationAccordion";

interface StorytellingProductDetailViewProps {
  product: Product;
  selectedVariant: Variant | null;
  onVariantChange: (variant: Variant | null) => void;
  related?: Product[];
}

export default function StorytellingProductDetailView({
  product,
  selectedVariant,
  onVariantChange,
  related = [],
}: StorytellingProductDetailViewProps) {
  const filteredRelated = related.filter((p) => p.id !== product.id);

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep">Home</Link>
          <span className="mx-2 text-border">/</span>
          <Link to={`/collections/${product.category_slug}`} className="hover:text-brand-deep capitalize">
            {product.category_slug.replace("-", " ")}
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* SECTION 1 — PRIMARY PRODUCT / PURCHASE SECTION */}
        <section aria-label="Purchase Section" className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start relative">
          {/* Left Column (Product Gallery: 58% on desktop) */}
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <ProductGallery images={product.images || []} productName={product.name} />
          </div>

          {/* Right Column (Commercial Authority & Purchase Controls: 42% on desktop) */}
          <div className="lg:col-span-5 flex flex-col pt-2 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {product.badge && (
                <Badge className="bg-brand-deep text-white hover:bg-brand-deep">{product.badge}</Badge>
              )}
              {product.is_best_seller && (
                <Badge variant="secondary" className="bg-brand-sand text-brand-deep font-semibold border-brand-sand/50">
                  Best Seller
                </Badge>
              )}
            </div>

            <h1
              className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-foreground"
              data-testid="product-title"
            >
              {product.name}
            </h1>

            {product.tagline && (
              <p className="mt-4 text-xl text-muted-foreground leading-relaxed" data-testid="product-tagline">
                {product.tagline}
              </p>
            )}

            {product.short_description && (
              <p className="mt-4 text-base text-foreground/80 leading-relaxed">
                {product.short_description}
              </p>
            )}

            {/* Authoritative Variant Selection & Commerce Actions */}
            <div className="mt-8 w-full">
              <VariantSelector product={product} onVariantChange={onVariantChange} />
            </div>

            {/* Compact Specifications preview for pillows/baby */}
            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div className="mt-8 p-4 rounded-2xl border border-border bg-card">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-leaf block mb-2">
                  Key Measurements
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {Object.entries(product.specifications).slice(0, 3).map(([k, v], idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-background/80 border border-border/60">
                      <span className="text-[11px] text-muted-foreground block">{k}</span>
                      <span className="text-xs font-bold text-foreground mt-0.5 block">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2 — PRODUCT STORY INTRODUCTION (Collapses if not configured) */}
        <ProductStoryIntro
          story={product.storytelling?.story}
          productName={product.name}
        />

        {/* SECTION 3 — LIFESTYLE + SUITABILITY (Collapses if not configured) */}
        <ProductLifestyleSection
          lifestyle={product.storytelling?.lifestyle}
          productName={product.name}
        />

        {/* SECTION 4 — WHAT'S INSIDE / CONSTRUCTION (Collapses if not configured) */}
        <ProductConstruction
          construction={product.storytelling?.construction}
          productName={product.name}
        />

        {/* SECTION 5 — FIND THE RIGHT FIT (Collapses if disabled or empty) */}
        <ProductFitGuide
          fitGuide={product.storytelling?.fit_guide}
          currentSlug={product.slug}
          productName={product.name}
        />

        {/* SECTION 6 — CERTIFIED & TRUSTED (Collapses if no certifications assigned) */}
        <ProductCertifications
          certificationIds={product.storytelling?.certification_ids}
          productName={product.name}
        />

        {/* SECTION 7 — PRODUCT INFORMATION ACCORDIONS */}
        <ProductInformationAccordion product={product} />

        {/* SECTION 8 — YOU MAY ALSO LIKE (Authoritative Recommendation Engine) */}
        {filteredRelated.length > 0 && (
          <section className="mt-24 border-t border-border pt-16 pb-8" aria-label="Related products">
            <div className="flex flex-col items-center text-center mb-10">
              <span className="text-xs font-bold tracking-widest uppercase text-brand-leaf mb-2">
                CURATED RECOMMENDATIONS
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-brand-deep uppercase">
                YOU MAY ALSO LIKE
              </h2>
              <div className="mt-4 h-1 w-16 rounded-full bg-brand-leaf/40"></div>
            </div>
            <ProductCarousel products={filteredRelated} testId="related-carousel" />
          </section>
        )}

        {product.price_from !== null && (
          <p className="sr-only">Starting at {inr(product.price_from)}</p>
        )}
      </main>

      {/* Sticky Mobile Add To Cart Bar */}
      <StickyMobileBar product={product} selectedVariant={selectedVariant} />
    </>
  );
}
