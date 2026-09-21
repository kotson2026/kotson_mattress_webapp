import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

export default function ProductGrid({ products, testId }: { products: Product[]; testId: string }) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center" data-testid={`${testId}-empty`}>
        <p className="font-heading text-lg font-semibold">No products here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">The catalog is live — new products appear the moment they are published.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
