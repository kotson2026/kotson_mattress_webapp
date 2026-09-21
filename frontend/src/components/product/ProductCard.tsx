import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

// Quick add is only offered when the product has exactly one variant — never silently
// add a wrong default when a variant choice is required.
export default function ProductCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const single = product.variants.length === 1 ? product.variants[0] : null;

  const quickAdd = async () => {
    if (!single) return;
    setBusy(true);
    try {
      await apiPost("/cart/items", { variant_id: single.id, qty: 1 });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
      data-testid={`product-card-${product.slug}`}
    >
      <Link to={`/products/${product.slug}`} className="relative block aspect-[4/3] bg-brand-sand" aria-label={product.name}>
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-brand-deep/50">
            {product.category_slug}
          </span>
        )}
        {product.badge && (
          <Badge className="absolute left-3 top-3 bg-brand-deep text-white" data-testid={`product-badge-${product.slug}`}>
            {product.badge}
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-brand-amber text-brand-amber" aria-hidden="true" />
          {product.rating?.toFixed(1) ?? "New"} · {product.review_count} reviews
        </div>
        <h3 className="font-heading text-lg font-bold leading-snug">
          <Link to={`/products/${product.slug}`} className="hover:text-brand-deep" data-testid={`product-name-${product.slug}`}>
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div>
            <p className="font-heading text-lg font-bold" data-testid={`product-price-${product.slug}`}>
              {product.price_from !== null ? inr(product.price_from) : "—"}
              {product.variants.length > 1 && <span className="text-xs font-normal text-muted-foreground"> onwards</span>}
            </p>
            {product.trial_days && <p className="text-xs text-brand-leaf">{product.trial_days}-night trial</p>}
          </div>
          {single && product.in_stock ? (
            <Button size="sm" onClick={quickAdd} disabled={busy} className="min-h-11" data-testid={`product-quick-add-${product.slug}`}>
              Add
            </Button>
          ) : (
            <Link to={`/products/${product.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid={`product-view-${product.slug}`}>
              {product.in_stock ? "Options" : "View"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
