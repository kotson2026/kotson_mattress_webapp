import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: Product[];
  testId: string;
  className?: string;
  emptyMessage?: string;
  emptySubtext?: string;
}

export default function ProductGrid({
  products,
  testId,
  className,
  emptyMessage = "No products here yet",
  emptySubtext = "The catalog is live — new products appear the moment they are published.",
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center"
        data-testid={`${testId}-empty`}
      >
        <p className="font-heading text-lg font-semibold text-foreground">{emptyMessage}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptySubtext}</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      data-testid={testId}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

