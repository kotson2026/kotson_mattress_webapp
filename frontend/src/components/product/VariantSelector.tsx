import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Product, Variant } from "@/lib/types";
import { inr } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function OptionGroup({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  testId: string;
}) {
  if (options.length <= 1 && options[0] === undefined) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            data-testid={`${testId}-${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              value === o ? "border-brand-deep bg-brand-deep text-white" : "border-border bg-card hover:border-brand-deep/50"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VariantSelector({ product }: { product: Product }) {
  const qc = useQueryClient();
  const [size, setSize] = useState<string | null>(null);
  const [thickness, setThickness] = useState<string | null>(null);
  const [firmness, setFirmness] = useState<string | null>(null);

  const sizes = useMemo(() => [...new Set(product.variants.map((v) => v.size))], [product.variants]);
  const thicknesses = useMemo(
    () => [...new Set(product.variants.filter((v) => !size || v.size === size).map((v) => v.thickness).filter(Boolean) as string[])],
    [product.variants, size]
  );
  const firmnesses = useMemo(
    () =>
      [
        ...new Set(
          product.variants
            .filter((v) => (!size || v.size === size) && (!thickness || v.thickness === thickness))
            .map((v) => v.firmness)
            .filter(Boolean) as string[]
        ),
      ] as string[],
    [product.variants, size, thickness]
  );

  const match: Variant | undefined = product.variants.find(
    (v) => (!size || v.size === size) && (!thickness || v.thickness === thickness) && (!firmness || v.firmness === firmness)
  );

  const mutation = useMutation({
    mutationFn: (variant_id: string) => apiPost("/cart/items", { variant_id, qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add to cart"),
  });

  return (
    <div className="flex flex-col gap-5" data-testid="variant-selector">
      {sizes.length > 1 && <OptionGroup label="Size" options={sizes} value={size ?? sizes[0]} onChange={(v) => { setSize(v); setThickness(null); setFirmness(null); }} testId="variant-size" />}
      {thicknesses.length > 1 && <OptionGroup label="Thickness" options={thicknesses} value={thickness ?? thicknesses[0]} onChange={setThickness} testId="variant-thickness" />}
      {firmnesses.length > 1 && <OptionGroup label="Firmness" options={firmnesses} value={firmness ?? firmnesses[0]} onChange={setFirmness} testId="variant-firmness" />}

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="font-heading text-2xl font-bold" data-testid="variant-price">{match ? inr(match.price) : "—"}</p>
          {match?.mrp && match.mrp > match.price && (
            <p className="text-xs text-muted-foreground">
              MRP <s>{inr(match.mrp)}</s> · incl. taxes as configured
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground" data-testid="variant-sku">SKU: {match?.sku ?? "—"}</p>
        </div>
        <div className="text-right">
          {match ? (
            match.free_stock > 0 ? (
              <p className="text-xs font-medium text-brand-leaf" data-testid="variant-stock">
                In stock{match.free_stock <= 5 ? ` — only ${match.free_stock} left` : ""}
              </p>
            ) : (
              <p className="text-xs font-medium text-destructive" data-testid="variant-stock">Out of stock</p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">Select options</p>
          )}
        </div>
      </div>

      <Button
        size="lg"
        disabled={!match || match.free_stock === 0 || mutation.isPending}
        onClick={() => match && mutation.mutate(match.id)}
        className="min-h-12 text-base"
        data-testid="add-to-cart-btn"
      >
        {mutation.isPending ? "Adding…" : match && match.free_stock === 0 ? "Out of stock" : "Add to cart"}
      </Button>
    </div>
  );
}
