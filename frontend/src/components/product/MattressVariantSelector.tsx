import { useMemo, useState, useEffect } from "react";
import type { Product, Variant } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MattressVariantSelectorProps {
  product: Product;
  onVariantSelect: (variant: Variant | null) => void;
}

export default function MattressVariantSelector({ product, onVariantSelect }: MattressVariantSelectorProps) {
  const isOrthoCoreMax = product.slug === "ortho-core-max-mattress";

  // Derive available sizes
  const sizes = useMemo(() => {
    return [...new Set(product.variants.map((v) => v.size))].sort().reverse(); // Queen, King
  }, [product.variants]);

  const [size, setSize] = useState<string | null>(sizes[0] || null);

  // Derive lengths based on selected size
  const lengths = useMemo(() => {
    if (!size) return [];
    const validVariants = product.variants.filter((v) => v.size === size && v.length);
    return [...new Set(validVariants.map((v) => v.length as string))].sort((a, b) => Number(a) - Number(b));
  }, [product.variants, size]);

  // For Ortho Core Max, we default to the only available length (78)
  const [length, setLength] = useState<string | null>(
    isOrthoCoreMax ? "78" : (lengths[0] || null)
  );

  // Derive heights (thicknesses) based on size and length
  const heights = useMemo(() => {
    if (!size || !length) return [];
    const validVariants = product.variants.filter(
      (v) => v.size === size && v.length === length && v.thickness
    );
    return [...new Set(validVariants.map((v) => v.thickness as string))].sort((a, b) => Number(a) - Number(b));
  }, [product.variants, size, length]);

  const [thickness, setThickness] = useState<string | null>(heights[0] || null);

  // Auto-update length and thickness when available options change
  useEffect(() => {
    if (!isOrthoCoreMax) {
      if (lengths.length > 0 && (!length || !lengths.includes(length))) {
        setLength(lengths[0]);
      }
    }
  }, [lengths, length, isOrthoCoreMax]);

  useEffect(() => {
    if (heights.length > 0 && (!thickness || !heights.includes(thickness))) {
      setThickness(heights[0]);
    }
  }, [heights, thickness]);

  // Notify parent of the exact matching variant
  useEffect(() => {
    const match = product.variants.find(
      (v) => v.size === size && v.length === length && v.thickness === thickness
    );
    onVariantSelect(match || null);
  }, [product.variants, size, length, thickness, onVariantSelect]);

  const breadth = size === "Queen" ? "60" : size === "King" ? "72" : null;

  return (
    <div className="flex flex-col gap-6" data-testid="mattress-variant-selector">
      {/* 1. Size Selection */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Size</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
              className={cn(
                "min-h-12 flex-1 rounded-2xl border-2 px-6 text-sm font-medium transition-all duration-200 min-w-[120px]",
                size === sz
                  ? "border-brand-deep bg-brand-deep text-white shadow-md"
                  : "border-border bg-card hover:border-brand-deep/40 hover:bg-brand-sand/20"
              )}
            >
              {sz}
            </button>
          ))}
        </div>
        {breadth && (
          <p className="mt-2 text-xs text-muted-foreground">
            Standard breadth: {breadth} inches
          </p>
        )}
      </div>

      {/* 2. Length Selection (Hidden for Ortho Core Max) */}
      {!isOrthoCoreMax && lengths.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Length (Inches)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {lengths.map((len) => (
              <button
                key={len}
                onClick={() => setLength(len)}
                className={cn(
                  "flex h-12 min-w-16 items-center justify-center rounded-xl border-2 text-sm font-medium transition-all duration-200",
                  length === len
                    ? "border-brand-deep bg-brand-sand text-brand-deep"
                    : "border-border bg-card hover:border-brand-deep/40 hover:bg-brand-sand/20"
                )}
              >
                {len}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Height (Thickness) Selection */}
      {heights.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Height (Inches)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {heights.map((t) => (
              <button
                key={t}
                onClick={() => setThickness(t)}
                className={cn(
                  "flex h-12 min-w-16 items-center justify-center rounded-xl border-2 text-sm font-medium transition-all duration-200",
                  thickness === t
                    ? "border-brand-deep bg-brand-sand text-brand-deep"
                    : "border-border bg-card hover:border-brand-deep/40 hover:bg-brand-sand/20"
                )}
              >
                {t}"
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Dimension Summary */}
      {(length && thickness && breadth) && (
        <div className="rounded-xl bg-brand-sand/50 px-4 py-3 text-sm text-brand-deep">
          <span className="font-medium">Selected dimensions:</span> {length}" (L) × {breadth}" (W) × {thickness}" (H)
        </div>
      )}
    </div>
  );
}
