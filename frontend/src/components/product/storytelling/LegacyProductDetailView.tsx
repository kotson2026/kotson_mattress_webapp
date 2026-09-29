import React from "react";
import { Link } from "react-router-dom";
import type { Product, Variant } from "@/lib/types";
import { inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import ProductGallery from "@/components/product/ProductGallery";
import VariantSelector from "@/components/product/VariantSelector";
import ProductAccordions from "@/components/product/ProductAccordions";
import ProductCarousel from "@/components/product/ProductCarousel";
import StickyMobileBar from "@/components/product/StickyMobileBar";

interface LegacyProductDetailViewProps {
  product: Product;
  selectedVariant: Variant | null;
  onVariantChange: (variant: Variant | null) => void;
  related?: Product[];
}

export default function LegacyProductDetailView({
  product,
  selectedVariant,
  onVariantChange,
  related = [],
}: LegacyProductDetailViewProps) {
  const filteredRelated = related.filter((p) => p.id !== product.id);

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep">Home</Link>
          <span className="mx-2 text-border">/</span>
          <Link to={`/collections/${product.category_slug ?? ""}`} className="hover:text-brand-deep capitalize">
            {product.category_slug.replace("-", " ") ?? "Collections"}
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start relative">
          {/* Left Column (Images: 58% width on desktop) */}
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <ProductGallery images={product.images || []} productName={product.name} />
          </div>

          {/* Right Column (Info: 42% width on desktop) */}
          <div className="lg:col-span-5 flex flex-col pt-2 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {product.badge && <Badge className="bg-brand-deep text-white hover:bg-brand-deep">{product.badge}</Badge>}
              {product.is_best_seller && <Badge variant="secondary" className="bg-brand-sand text-brand-deep font-semibold border-brand-sand/50">Best Seller</Badge>}
            </div>
            
            <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-foreground" data-testid="product-title">
              {product.name}
            </h1>
            
            {product.tagline && (
              <p className="mt-4 text-xl text-muted-foreground leading-relaxed" data-testid="product-tagline">
                {product.tagline}
              </p>
            )}

            {/* Short description if available */}
            {product.short_description && (
              <p className="mt-4 text-base text-foreground/80 leading-relaxed">
                {product.short_description}
              </p>
            )}

            <div className="mt-8 w-full">
              <VariantSelector product={product} onVariantChange={onVariantChange} />
            </div>

            {/* Accordions */}
            <div className="mt-8">
              <ProductAccordions product={product} />
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {filteredRelated.length > 0 && (
          <section className="mt-24 border-t border-border pt-16 pb-8" aria-label="Related products">
            <div className="flex flex-col items-center text-center mb-10">
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

      <StickyMobileBar product={product} selectedVariant={selectedVariant} />
    </>
  );
}
