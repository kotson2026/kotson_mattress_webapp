import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ProductGrid from "@/components/product/ProductGrid";
import { cn } from "@/lib/utils";

interface CollectionTab {
  id: string;
  slug: string;
  label: string;
}

const COLLECTION_TABS: CollectionTab[] = [
  { id: "all", slug: "all", label: "All" },
  { id: "mattresses", slug: "mattresses", label: "Mattresses" },
  { id: "pillows", slug: "pillows", label: "Pillows" },
  { id: "toppers", slug: "toppers", label: "Toppers" },
  { id: "baby-kids", slug: "baby-kids", label: "Baby + Kids" },
];

export default function Collections() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Set page title for SEO
  useEffect(() => {
    document.title = "Explore Our Collections — Kotson Naturals";
  }, []);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/catalog/categories"),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
  });

  // Read active filter from URL query param
  const rawParam = searchParams.get("category")?.toLowerCase() || "all";
  const activeCategory = COLLECTION_TABS.some((t) => t.slug === rawParam)
    ? rawParam
    : "all";

  const handleTabChange = (slug: string) => {
    if (slug === "all") {
      setSearchParams({}, { replace: false });
    } else {
      setSearchParams({ category: slug }, { replace: false });
    }
  };

  // Compute counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products?.length ?? 0 };
    if (!products) return counts;
    for (const p of products) {
      if (p.category_slug) {
        counts[p.category_slug] = (counts[p.category_slug] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  // Filter products by active tab
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category_slug === activeCategory);
  }, [products, activeCategory]);

  const activeTabMeta = COLLECTION_TABS.find((t) => t.slug === activeCategory);

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <StorefrontHeader />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep transition-colors">
            Home
          </Link>
          <span className="mx-2 text-muted-foreground/60">/</span>
          <span className="text-foreground font-medium">Collections</span>
          {activeCategory !== "all" && (
            <>
              <span className="mx-2 text-muted-foreground/60">/</span>
              <span className="text-brand-deep font-semibold">
                {activeTabMeta?.label}
              </span>
            </>
          )}
        </nav>

        {/* Page Header */}
        <div className="border-b border-border/60 pb-8 mb-8">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#2F5233] bg-[#2F5233]/10 px-3 py-1 rounded-full mb-3">
            Organic &amp; Natural Sleep
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            EXPLORE OUR COLLECTIONS
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl">
            Thoughtfully designed for naturally better sleep.
          </p>
        </div>

        {/* Filter Navigation Tabs */}
        <div
          className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8"
          role="tablist"
          aria-label="Filter by collection"
        >
          {COLLECTION_TABS.map((tab) => {
            const isSelected = activeCategory === tab.slug;
            const count = categoryCounts[tab.slug];

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.slug}`}
                aria-selected={isSelected}
                aria-controls="collections-grid-section"
                onClick={() => handleTabChange(tab.slug)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer select-none",
                  isSelected
                    ? "bg-[#2F5233] text-white shadow-sm ring-1 ring-[#2F5233]"
                    : "border border-border bg-card text-foreground/85 hover:bg-brand-sand/50 hover:text-foreground hover:border-[#2F5233]/30"
                )}
                data-testid={`collections-tab-${tab.slug}`}
              >
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none transition-colors",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Collection Results Summary */}
        <div className="flex items-center justify-between mb-6 text-sm text-muted-foreground">
          <p>
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredProducts.length}
            </span>{" "}
            {filteredProducts.length === 1 ? "product" : "products"}
            {activeCategory !== "all" && (
              <>
                {" "}in <span className="font-semibold text-brand-deep">{activeTabMeta?.label}</span>
              </>
            )}
          </p>
        </div>

        {/* Product Grid or Loading Skeleton */}
        <div id="collections-grid-section" aria-live="polite">
          {isLoading ? (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl border border-border bg-card p-4 space-y-4 animate-pulse"
                >
                  <div className="aspect-square w-full rounded-xl bg-brand-sand/60" />
                  <div className="h-4 w-3/4 rounded bg-brand-sand/70" />
                  <div className="h-3 w-1/2 rounded bg-brand-sand/50" />
                  <div className="mt-auto h-10 w-full rounded-xl bg-brand-sand/60" />
                </div>
              ))}
            </div>
          ) : (
            <ProductGrid
              products={filteredProducts}
              testId="collections-grid"
              emptyMessage={`No products currently available in ${activeTabMeta?.label ?? "this collection"}.`}
              emptySubtext="Please check back shortly or explore our other collections."
            />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
