import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ProductGrid from "@/components/product/ProductGrid";
import { buttonVariants } from "@/components/ui/button";

export default function Collections() {
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => apiGet<Category[]>("/catalog/categories") });
  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">All collections</h1>
        <div className="mt-6 flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.slug}`}
              className="min-h-11 rounded-full border border-border bg-card px-5 text-sm font-medium leading-[2.75rem] hover:border-brand-deep hover:text-brand-deep"
              data-testid={`collections-tab-${c.slug}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-brand-sand" />
              ))}
            </div>
          ) : (
            <ProductGrid products={products ?? []} testId="collections-grid" />
          )}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Looking for something specific? <Link to="/contact" className="text-brand-deep underline">Contact us</Link> or{" "}
          <Link to="/track-order" className={buttonVariants({ variant: "link", size: "sm" })}>track an order</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
