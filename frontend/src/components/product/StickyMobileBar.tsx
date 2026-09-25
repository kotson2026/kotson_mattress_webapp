import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { apiPost } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import { cn } from "@/lib/utils";
import PriceDisplay from "./PriceDisplay";

interface StickyMobileBarProps {
  product: Product;
  selectedVariant: Variant | null;
}

export default function StickyMobileBar({ product, selectedVariant }: StickyMobileBarProps) {
  const qc = useQueryClient();
  const { openDrawer } = useCheckoutDrawer();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show the bar when scrolling past 400px (typically past the main hero/gallery)
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const mutation = useMutation({
    mutationFn: (variant_id: string) => apiPost("/cart/items", { variant_id, qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add to cart"),
  });

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    mutation.mutate(selectedVariant.id, {
      onSuccess: () => {
        toast.success("Added to cart");
        openDrawer();
      },
    });
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-border bg-card px-4 py-3 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] transition-transform duration-300 sm:hidden",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      data-testid="sticky-mobile-bar"
    >
      <div className="flex flex-col">
        <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">
          {product.name}
        </span>
        <PriceDisplay
          salePrice={selectedVariant ? selectedVariant.price : (product.price_from ?? 0)}
          mrp={selectedVariant ? selectedVariant.mrp : product.mrp_from}
          discountPercent={selectedVariant ? selectedVariant.discount_percent : (product.discount_percent ?? 40)}
          isFrom={!selectedVariant && product.variants.length > 1}
          size="sm"
        />
      </div>
      <Button
        size="default"
        onClick={handleAddToCart}
        disabled={!selectedVariant || selectedVariant.stock === 0 || mutation.isPending}
        className="h-10 px-6 font-semibold"
        data-testid="sticky-add-to-cart-btn"
      >
        {mutation.isPending ? "Processing..." : "Add to Cart"}
      </Button>
    </div>
  );
}
