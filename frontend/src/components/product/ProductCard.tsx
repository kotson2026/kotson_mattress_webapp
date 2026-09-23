import { Link, useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export default function ProductCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);

  const requiresVariantSelection = product.variants.length > 1;

  const handleAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (requiresVariantSelection) {
      navigate(`/products/${product.slug}`);
      return;
    }

    if (!product.variants[0]) return;

    setBusy(true);
    try {
      await apiPost("/cart/items", { variant_id: product.variants[0].id, qty: 1 });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
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
          <div>
            <p className="font-heading text-lg font-bold" data-testid={`product-price-${product.slug}`}>
              {requiresVariantSelection && <span className="text-xs font-normal text-muted-foreground mr-1">From</span>}
              {product.price_from !== null ? inr(product.price_from) : "—"}
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleAction}
            disabled={busy || !product.in_stock}
            className="w-full min-h-11 font-semibold transition-colors duration-200"
            variant={requiresVariantSelection ? "outline" : "default"}
            data-testid={`product-action-${product.slug}`}
          >
            {busy ? "Processing..." : (!product.in_stock ? "Out of stock" : (requiresVariantSelection ? "Add to Cart" : "Add to Cart"))}
          </Button>
        </div>
      </div>
    </article>
  );
}
