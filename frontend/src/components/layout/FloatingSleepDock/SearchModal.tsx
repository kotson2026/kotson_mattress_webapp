import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ArrowRight } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import PriceDisplay from "@/components/product/PriceDisplay";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products", "search-all"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
    staleTime: 120_000,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const results = (products ?? []).filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.tagline && p.tagline.toLowerCase().includes(q)) ||
      p.category_slug.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20 sm:pt-28 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="dock-search-modal"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-black/[0.08] bg-[#FAF8F5] p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="relative flex items-center border-b border-black/[0.06] pb-4">
          <Search className="h-5 w-5 text-brand-deep/70" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mattresses, pillows, toppers, baby + kids..."
            className="ml-3 w-full bg-transparent text-base font-medium text-brand-charcoal placeholder:text-brand-charcoal/40 outline-none"
            data-testid="search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-brand-charcoal/50 hover:text-brand-charcoal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-full p-1.5 text-brand-charcoal/60 hover:bg-black/5"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
          {results.length > 0 ? (
            <div className="flex flex-col gap-2">
              {results.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  onClick={onClose}
                  className="group flex items-center justify-between rounded-xl p-3 hover:bg-black/[0.03] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-heading text-sm font-bold text-brand-charcoal group-hover:text-brand-deep">
                      {p.name}
                    </span>
                    <span className="text-xs text-brand-charcoal/60 line-clamp-1">
                      {p.tagline || p.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <PriceDisplay
                      salePrice={p.price_from}
                      mrp={p.mrp_from}
                      discountPercent={p.discount_percent ?? 40}
                      isFrom={p.variants && p.variants.length > 1}
                      size="sm"
                    />
                    <ArrowRight className="h-4 w-4 text-brand-leaf opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-brand-charcoal/60">
              No products found matching &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
