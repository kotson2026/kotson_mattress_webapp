import { useState, useEffect } from "react";
import type { Product, Variant } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopperVariantSelectorProps {
  product: Product;
  onVariantSelect: (variant: Variant | null) => void;
}

export default function TopperVariantSelector({ product, onVariantSelect }: TopperVariantSelectorProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(product.variants[0]?.id || null);

  useEffect(() => {
    const match = product.variants.find((v) => v.id === selectedVariantId);
    onVariantSelect(match || null);
  }, [product.variants, selectedVariantId, onVariantSelect]);

  return (
    <div className="flex flex-col gap-4" data-testid="topper-variant-selector">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Dimensions</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {product.variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id;
          return (
            <button
              key={variant.id}
              onClick={() => setSelectedVariantId(variant.id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border-2 transition-all duration-200",
                isSelected
                  ? "border-brand-deep bg-brand-deep text-white shadow-md"
                  : "border-border bg-card hover:border-brand-deep/40 hover:bg-brand-sand/20 text-foreground"
              )}
            >
              <span className="text-sm font-medium">
                {variant.length}" × {variant.width}"
              </span>
              <span className={cn("text-[10px] uppercase", isSelected ? "text-white/80" : "text-muted-foreground")}>
                {variant.size}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        * Standard thickness: 2 inches
      </p>
    </div>
  );
}
