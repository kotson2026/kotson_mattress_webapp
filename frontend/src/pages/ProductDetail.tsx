import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import { inr } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import VariantSelector from "@/components/product/VariantSelector";
import ProductGallery from "@/components/product/ProductGallery";
import ProductAccordions from "@/components/product/ProductAccordions";
import StickyMobileBar from "@/components/product/StickyMobileBar";
import ProductCarousel from "@/components/product/ProductCarousel";
import { Badge } from "@/components/ui/badge";

export default function ProductDetail() {
  const { slug } = useParams();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product>(`/catalog/products/${slug}`),
    retry: false,
  });

  // Default the selectedVariant on load if missing
  useEffect(() => {
    if (product && !selectedVariant && product.variants.length === 1) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product, selectedVariant]);

  // SEO: structured product data from the actual record (JSON-LD), title sync.
  useEffect(() => {
    if (product) {
      document.title = `${product.name} — Kotson Mattress`;
      const ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.tagline || product.description,
        brand: { "@type": "Brand", name: "Kotson Mattress" },
        ...(product.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.review_count } } : {}),
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: product.price_from !== null ? (product.price_from / 100).toFixed(2) : undefined,
          availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      };
      const existing = document.getElementById("product-jsonld");
      const el = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
      el.id = "product-jsonld";
      el.type = "application/ld+json";
      el.textContent = JSON.stringify(ld);
      document.head.appendChild(el);
    }
    return () => {
      document.getElementById("product-jsonld")?.remove();
    };
  }, [product]);

  const { data: related } = useQuery({
    queryKey: ["products", product?.category_slug ?? "x"],
    queryFn: () => apiGet<Product[]>(`/catalog/products?category=${product?.category_slug}`),
    enabled: !!product,
  });

  return (
    <div className="min-h-svh bg-background">
      <StorefrontHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep">Home</Link>
          <span className="mx-2 text-border">/</span>
          <Link to={`/collections/${product?.category_slug ?? ""}`} className="hover:text-brand-deep capitalize">
            {product?.category_slug.replace("-", " ") ?? "Collections"}
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="text-foreground">{product?.name}</span>
        </nav>

        {isLoading && (
          <div className="grid gap-12 lg:grid-cols-12">
             <div className="lg:col-span-7 h-[600px] animate-pulse rounded-3xl bg-brand-sand/60" />
             <div className="lg:col-span-5 h-[600px] animate-pulse rounded-3xl bg-brand-sand/30" />
          </div>
        )}

        {isError && (
          <div className="my-16 rounded-3xl border-2 border-dashed border-border p-16 text-center" data-testid="product-not-found">
            <h1 className="font-heading text-3xl font-bold text-brand-deep">Product unavailable</h1>
            <p className="mt-4 text-lg text-muted-foreground">This product may have been archived or deactivated.</p>
            <Link to="/collections" className="mt-8 inline-block rounded-full bg-brand-deep px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep/90">
              Explore Collections
            </Link>
          </div>
        )}

        {product && (
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
                <VariantSelector product={product} onVariantChange={setSelectedVariant} />
              </div>

              {/* Accordions */}
              <div className="mt-8">
                <ProductAccordions product={product} />
              </div>
            </div>
          </div>
        )}

        {/* Related Products Section */}
        {product && (related ?? []).filter((p) => p.id !== product.id).length > 0 && (
          <section className="mt-24 border-t border-border pt-16 pb-8" aria-label="Related products">
            <div className="flex flex-col items-center text-center mb-10">
              <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-brand-deep uppercase">
                YOU MAY ALSO LIKE
              </h2>
              <div className="mt-4 h-1 w-16 rounded-full bg-brand-leaf/40"></div>
            </div>
            <ProductCarousel products={(related ?? []).filter((p) => p.id !== product.id)} testId="related-carousel" />
          </section>
        )}

        {product && product.price_from !== null && (
          <p className="sr-only">Starting at {inr(product.price_from)}</p>
        )}
      </main>

      {product && (
        <StickyMobileBar product={product} selectedVariant={selectedVariant} />
      )}
      <SiteFooter />
    </div>
  );
}
