import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import StorytellingProductDetailView from "@/components/product/storytelling/StorytellingProductDetailView";
import LegacyProductDetailView from "@/components/product/storytelling/LegacyProductDetailView";
import { Sparkles, History, Eye } from "lucide-react";

export default function ProductDetail() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  // 1. Authoritative Product Record
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product>(`/catalog/products/${slug}`),
    retry: false,
  });

  // 2. Authoritative Server-side PDP Design Version Setting
  const { data: pdpSettings } = useQuery<{ pdp_design_version: string }>({
    queryKey: ["pdp-settings"],
    queryFn: () => apiGet<{ pdp_design_version: string }>("/catalog/pdp-settings"),
    staleTime: 60_000,
  });

  // Feature Flag: "current" | "storytelling"
  // Hierarchy: 1. URL ?pdp=... -> 2. LocalStorage -> 3. Server Setting -> 4. Default "storytelling"
  const urlOverride = searchParams.get("pdp");
  const localOverride = typeof window !== "undefined" ? localStorage.getItem("kotson_pdp_version") : null;
  const serverVersion = pdpSettings?.pdp_design_version || "storytelling";
  const activeVersion = (urlOverride || localOverride || serverVersion).toLowerCase() === "current"
    ? "current"
    : "storytelling";

  const handleVersionSwitch = (target: "current" | "storytelling") => {
    localStorage.setItem("kotson_pdp_version", target);
    const next = new URLSearchParams(searchParams);
    next.set("pdp", target);
    setSearchParams(next);
  };

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

      {/* Feature Flag & Preview Bar: Discreet, non-intrusive control */}
      <aside aria-label="PDP Presentation Mode" className="border-b border-border/60 bg-muted/40 px-4 py-1.5 text-xs">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">PDP Design System:</span>
            <span className="capitalize">{activeVersion === "storytelling" ? "Dynamic Storytelling (New Standard)" : "Current Legacy PDP"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleVersionSwitch("storytelling")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${
                activeVersion === "storytelling"
                  ? "bg-brand-leaf text-white shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
              title="View Redesigned Storytelling PDP"
            >
              <Sparkles className="w-3 h-3" />
              Storytelling
            </button>
            <button
              type="button"
              onClick={() => handleVersionSwitch("current")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${
                activeVersion === "current"
                  ? "bg-brand-deep text-white shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
              title="View Current Legacy PDP"
            >
              <History className="w-3 h-3" />
              Current
            </button>
          </div>
        </div>
      </aside>

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

      {/* Product Content: Conditional on Feature Flag */}
      {product && (
        activeVersion === "current" ? (
          <LegacyProductDetailView
            product={product}
            selectedVariant={selectedVariant}
            onVariantChange={setSelectedVariant}
            related={related}
          />
        ) : (
          <StorytellingProductDetailView
            product={product}
            selectedVariant={selectedVariant}
            onVariantChange={setSelectedVariant}
            related={related}
          />
        )
      )}

      <SiteFooter />
    </div>
  );
}
