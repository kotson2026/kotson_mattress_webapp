import { Link, useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import PriceDisplay from "./PriceDisplay";

export default function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const [hasError, setHasError] = useState(false);

  const requiresVariantSelection = product.variants.length > 1;

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${product.slug}`);
  };

  const rawImage = (product.images && product.images[0]) || product.primary_image;
  const showImage = Boolean(rawImage && !hasError);

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-transform duration-300 hover:-translate-y-1 w-full"
      data-testid={`product-card-${product.slug}`}
    >
      <Link
        to={`/products/${product.slug}`}
        className="product-image-wrapper relative bg-brand-sand/60 p-4 transition-colors group-hover:bg-brand-sand/80 overflow-hidden"
        aria-label={product.name}
      >
        {showImage ? (
          <img
            src={rawImage}
            alt={product.name}
            className="product-image aspect-square h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={400}
            height={400}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex aspect-square h-full w-full flex-col items-center justify-center p-4 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-deep/60">
              Product Image Coming Soon
            </span>
          </div>
        )}
        {product.badge && (
          <Badge className="absolute left-3 top-3 bg-brand-deep text-white text-[10px] px-2 py-0.5 border-none" data-testid={`product-badge-${product.slug}`}>
            {product.badge}
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-5">
        {product.rating !== null && product.rating !== undefined && product.review_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-brand-amber text-brand-amber" aria-hidden="true" />
            {product.rating.toFixed(1)} · {product.review_count} reviews
          </div>
        )}

        <h3 className="font-heading text-lg font-bold leading-snug">
          <Link to={`/products/${product.slug}`} className="hover:text-brand-deep transition-colors" data-testid={`product-name-${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {product.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>}

        <div className="mt-auto flex flex-col gap-4 pt-3">
          <div data-testid={`product-price-${product.slug}`}>
            <PriceDisplay
              salePrice={product.price_from}
              mrp={product.mrp_from}
              discountPercent={product.discount_percent ?? 40}
              isFrom={requiresVariantSelection}
              size="md"
            />
          </div>

          <Button
            size="sm"
            onClick={handleAction}
            disabled={!product.in_stock}
            className="w-full min-h-11 font-semibold transition-colors duration-200"
            variant="default"
            data-testid={`product-action-${product.slug}`}
          >
            {!product.in_stock ? "Out of stock" : "Shop Now"}
          </Button>
        </div>
      </div>
    </article>
  );
}
