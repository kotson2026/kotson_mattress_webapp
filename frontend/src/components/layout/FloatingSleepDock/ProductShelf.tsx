import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { DOCK_CATEGORIES, type CategorySlug } from "./types";

interface Props {
  activeCategory: CategorySlug | null;
  onSelectCategory: (slug: CategorySlug) => void;
  onClose: () => void;
}

export default function ProductShelf({ activeCategory, onSelectCategory, onClose }: Props) {
  const { data: allProducts } = useQuery({
    queryKey: ["products", "catalog-all"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
    staleTime: 120_000,
  });

  const categoryItem = DOCK_CATEGORIES.find((c) => c.slug === activeCategory);
  const products = (allProducts ?? []).filter(
    (p) => p.category_slug === activeCategory && p.is_active
  );

  // Crossfade state tracking
  const [displayCategory, setDisplayCategory] = useState<CategorySlug | null>(activeCategory);
  const [isCrossfading, setIsCrossfading] = useState(false);

  useEffect(() => {
    if (activeCategory && activeCategory !== displayCategory) {
      setIsCrossfading(true);
      const timer = setTimeout(() => {
        setDisplayCategory(activeCategory);
        setIsCrossfading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeCategory, displayCategory]);

  if (!activeCategory || !categoryItem) return null;

  return (
    <div
      onMouseEnter={() => onSelectCategory(activeCategory)}
      onMouseLeave={onClose}
      data-testid="dock-product-shelf"
      className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-[calc(100%+10px)] w-[calc(100%-32px)] max-w-[1240px] rounded-[30px] border border-black/[0.06] bg-[#FAF8F5]/98 p-6 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2"
    >
      {/* Shelf Header: Category Switcher & Tagline */}
      <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-leaf/15 text-brand-deep">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-xl font-bold text-brand-charcoal">
              Explore {categoryItem.label}
            </h3>
            <p className="text-xs text-brand-charcoal/65">{categoryItem.tagline}</p>
          </div>
        </div>

        {/* Quick Category Switch Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-black/[0.03] p-1">
          {DOCK_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => onSelectCategory(c.slug)}
              onMouseEnter={() => onSelectCategory(c.slug)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                c.slug === activeCategory
                  ? "bg-white text-brand-deep shadow-2xs font-semibold"
                  : "text-brand-charcoal/70 hover:text-brand-deep"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Crossfading Product Cards Shelf */}
      <div
        className={`mt-6 grid gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-4 ${
          isCrossfading ? "opacity-40 scale-[0.99]" : "opacity-100 scale-100"
        }`}
      >
        {products.length > 0 ? (
          products.slice(0, 4).map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.slug}`}
              onClick={onClose}
              data-testid={`shelf-product-${product.slug}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.04] bg-white/70 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-brand-leaf/40 hover:bg-white hover:shadow-md"
            >
              <div>
                {/* Badge if available */}
                {product.badge && (
                  <span className="inline-block rounded-md bg-brand-leaf/15 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                    {product.badge}
                  </span>
                )}

                {/* Product Thumbnail / Category Icon */}
                <div className="relative my-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-brand-sand/50">
                  <img
                    src={categoryItem.imageUrl}
                    alt={product.name}
                    width={80}
                    height={80}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = categoryItem.localFallback;
                    }}
                    className="h-20 w-20 object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                </div>

                <h4 className="font-heading text-sm font-bold text-brand-charcoal group-hover:text-brand-deep">
                  {product.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-brand-charcoal/60">
                  {product.tagline || product.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-black/[0.04] pt-2.5">
                <span className="text-xs font-semibold text-brand-charcoal">
                  {product.price_from ? inr(product.price_from) : "View details"}
                </span>
                <span className="text-xs font-medium text-brand-leaf group-hover:underline">
                  View →
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-8 text-center text-sm text-brand-charcoal/60">
            Catalog products for {categoryItem.label} loading...
          </div>
        )}
      </div>

      {/* Shelf Footer Link */}
      <div className="mt-6 flex items-center justify-end border-t border-black/[0.05] pt-4">
        <Link
          to={`/collections/${categoryItem.slug}`}
          onClick={onClose}
          data-testid={`shelf-view-all-${categoryItem.slug}`}
          className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-deep transition-all hover:gap-2.5 hover:text-brand-leaf"
        >
          <span>View all {categoryItem.label.toLowerCase()}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
