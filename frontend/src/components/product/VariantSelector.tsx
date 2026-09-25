import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Product, Variant } from "@/lib/types";
import { inr } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import MattressVariantSelector from "./MattressVariantSelector";
import TopperVariantSelector from "./TopperVariantSelector";
import PriceDisplay from "./PriceDisplay";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

interface VariantSelectorProps {
  product: Product;
  onVariantChange?: (variant: Variant | null) => void;
}

export default function VariantSelector({ product, onVariantChange }: VariantSelectorProps) {
  const qc = useQueryClient();
  const { openDrawer } = useCheckoutDrawer();
  
  // Default variant for pillows or products with 1 variant
  const defaultVariant = product.variants.length === 1 ? product.variants[0] : null;
  const [selectedVariant, setSelectedVariantState] = useState<Variant | null>(defaultVariant);

  const setSelectedVariant = useCallback((variant: Variant | null) => {
    setSelectedVariantState(variant);
    if (onVariantChange) onVariantChange(variant);
  }, [onVariantChange]);

  const isMattress = product.category_slug === "mattresses";
  const isTopper = product.category_slug === "toppers";
  
  const mutation = useMutation({
    mutationFn: (variant_id: string) => apiPost("/cart/items", { variant_id, qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add to cart"),
  });

  const handleAddToCart = useCallback(() => {
    if (!selectedVariant) return;
    mutation.mutate(selectedVariant.id, {
      onSuccess: () => {
        toast.success("Added to cart");
        openDrawer();
      },
    });
  }, [selectedVariant, mutation, openDrawer]);

  return (
    <div className="flex flex-col gap-6" data-testid="unified-variant-selector">
      {/* Delegate to specific selectors */}
      {isMattress && product.variants.length > 1 && (
        <MattressVariantSelector product={product} onVariantSelect={setSelectedVariant} />
      )}
      
      {isTopper && product.variants.length > 1 && (
        <TopperVariantSelector product={product} onVariantSelect={setSelectedVariant} />
      )}

      {/* Price and Stock Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <div data-testid="variant-price">
            <PriceDisplay
              salePrice={selectedVariant ? selectedVariant.price : (product.price_from ?? 0)}
              mrp={selectedVariant ? selectedVariant.mrp : product.mrp_from}
              discountPercent={selectedVariant ? selectedVariant.discount_percent : (product.discount_percent ?? 40)}
              isFrom={!selectedVariant && product.variants.length > 1}
              size="xl"
            />
          </div>
          <p className="text-xs text-muted-foreground">incl. of all taxes</p>
        </div>
        <div className="text-right flex flex-col justify-end">
          {selectedVariant ? (
            selectedVariant.stock > 0 ? (
              <p className="text-sm font-medium text-brand-leaf" data-testid="variant-stock">
                In stock{selectedVariant.free_stock <= 5 ? ` — only ${selectedVariant.free_stock} left` : ""}
              </p>
            ) : (
              <p className="text-sm font-medium text-destructive" data-testid="variant-stock">Out of stock</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Select options</p>
          )}
          {selectedVariant?.sku && (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="variant-sku">
              SKU: {selectedVariant.sku}
            </p>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          variant="default"
          disabled={!selectedVariant || selectedVariant.stock === 0 || mutation.isPending}
          onClick={handleAddToCart}
          className="min-h-14 w-full text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          data-testid="add-to-cart-btn"
        >
          {mutation.isPending ? "Processing…" : selectedVariant && selectedVariant.stock === 0 ? "Out of stock" : "Add to Cart"}
        </Button>
      </div>
      
      <div className="mt-2 flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
           <span>100-Night Trial</span>
        </div>
        <div className="flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
           <span>10-Year Warranty</span>
        </div>
        <div className="flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>
           <span>Free Shipping</span>
        </div>
      </div>
    </div>
  );
}
