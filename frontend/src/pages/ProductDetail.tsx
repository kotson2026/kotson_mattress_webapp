import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import StorytellingProductDetailView from "@/components/product/storytelling/StorytellingProductDetailView";
import { getCanonicalStorytelling } from "@/lib/storytellingDefaults";

export default function ProductDetail() {
  const { slug } = useParams();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  // 1. Authoritative Product Record
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product>(`/catalog/products/${slug}`),
    retry: false,
  });

  // Default the selectedVariant on load if only 1 variant exists
  useEffect(() => {
    if (product && !selectedVariant && product.variants.length === 1) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product, selectedVariant]);

  // SEO: structured product data from authoritative product record (JSON-LD), title sync.
  useEffect(() => {
    if (product) {
      document.title = `${product.name} — Kotson Mattress`;
      const activeOfferPrice = selectedVariant ? selectedVariant.price : product.price_from;
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
          price: activeOfferPrice !== null && activeOfferPrice !== undefined ? (activeOfferPrice / 100).toFixed(2) : undefined,
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
  }, [product, selectedVariant]);

  // Authoritative Related Products Query
  const { data: related } = useQuery({
    queryKey: ["products", product?.category_slug ?? "x"],
    queryFn: () => apiGet<Product[]>(`/catalog/products?category=${product?.category_slug}`),
    enabled: !!product,
  });

  return (
    <div className="min-h-svh bg-background">
      <StorefrontHeader />

      {/* Loading Skeleton */}
      {isLoading && (
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7 h-[600px] animate-pulse rounded-3xl bg-brand-sand/60" />
            <div className="lg:col-span-5 h-[600px] animate-pulse rounded-3xl bg-brand-sand/30" />
          </div>
        </main>
      )}

      {/* Error State */}
      {isError && (
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className="my-16 rounded-3xl border-2 border-dashed border-border p-16 text-center" data-testid="product-not-found">
            <h1 className="font-heading text-3xl font-bold text-brand-deep">Product unavailable</h1>
            <p className="mt-4 text-lg text-muted-foreground">This product may have been archived or deactivated.</p>
            <Link to="/collections" className="mt-8 inline-block rounded-full bg-brand-deep px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep/90">
              Explore Collections
            </Link>
          </div>
        </main>
      )}

      {/* Product Content: Authoritative Storytelling PDP for all collections */}
      {product && (
        <StorytellingProductDetailView
          product={{
            ...product,
            storytelling: product.storytelling || getCanonicalStorytelling(product.category_slug, product.slug),
          }}
          selectedVariant={selectedVariant}
          onVariantChange={setSelectedVariant}
          related={related}
        />
      )}

      <SiteFooter />
    </div>
  );
}
