import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import VariantSelector from "@/components/product/VariantSelector";
import ProductGrid from "@/components/product/ProductGrid";
import { Badge } from "@/components/ui/badge";

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product>(`/catalog/products/${slug}`),
    retry: false,
  });

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
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep">Home</Link> / <Link to={`/collections/${product?.category_slug ?? ""}`} className="hover:text-brand-deep">
            {product?.category_slug ?? "Collections"}
          </Link>
        </nav>

        {isLoading && <div className="mt-8 h-96 animate-pulse rounded-2xl bg-brand-sand" />}

        {isError && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center" data-testid="product-not-found">
            <h1 className="font-heading text-2xl font-bold">Product not found</h1>
            <p className="mt-2 text-muted-foreground">It may have been deactivated. Browse the live collection instead.</p>
            <Link to="/collections" className="mt-4 inline-block text-brand-deep underline">All collections</Link>
          </div>
        )}

        {product && (
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div>
              <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-brand-sand" data-testid="product-gallery">
                {product.images[0] ? (
                  <img src={product.images[0]} alt={product.name} className="h-full w-full rounded-3xl object-cover" />
                ) : (
                  <span className="text-sm uppercase tracking-[0.3em] text-brand-deep/50">
                    product-{product.slug} — awaiting owner photo
                  </span>
                )}
              </div>
              {product.is_seed && (
                <p className="mt-3 text-xs text-muted-foreground" data-testid="product-seed-note">
                  SEED SAMPLE — price, stock and copy are placeholders the owner replaces in /admin.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                {product.badge && <Badge className="bg-brand-deep text-white">{product.badge}</Badge>}
                {product.trial_days && <Badge variant="outline">{product.trial_days}-night trial (terms pending)</Badge>}
                {product.warranty_years && <Badge variant="outline">{product.warranty_years}-year warranty (terms pending)</Badge>}
              </div>
              <h1 className="mt-3 font-heading text-4xl font-black tracking-tight" data-testid="product-title">{product.name}</h1>
              <p className="mt-2 text-lg text-muted-foreground" data-testid="product-tagline">{product.tagline}</p>

              <div className="mt-6">
                <VariantSelector product={product} />
              </div>

              <div className="mt-8 border-t border-border pt-6">
                <h2 className="font-heading text-lg font-bold">About this product</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground" data-testid="product-description">{product.description}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Final GST, shipping and delivery-lead-time lines are calculated server-side at checkout and shown before you pay.
                </p>
              </div>
            </div>
          </div>
        )}

        {product && (related ?? []).filter((p) => p.id !== product.id).length > 0 && (
          <section className="mt-16" aria-label="Related products">
            <h2 className="font-heading text-2xl font-bold">More from {product.category_slug.replace("-", " ")}</h2>
            <div className="mt-6">
              <ProductGrid products={(related ?? []).filter((p) => p.id !== product.id).slice(0, 3)} testId="related-grid" />
            </div>
          </section>
        )}

        {product && product.price_from !== null && (
          <p className="sr-only">Starting at {inr(product.price_from)}</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
