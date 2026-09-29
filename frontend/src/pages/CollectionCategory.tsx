import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ProductGrid from "@/components/product/ProductGrid";

export default function CollectionCategory() {
  const { category } = useParams();
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => apiGet<Category[]>("/catalog/categories") });
  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", category],
    queryFn: () => apiGet<Product[]>(`/catalog/products?category=${category}`),
    retry: 2,
  });

  const cat = (categories ?? []).find((c) => c.slug === category);

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-brand-deep">Home</Link> / <Link to="/collections" className="hover:text-brand-deep">Collections</Link> /{" "}
          <span className="text-foreground">{cat?.name ?? category}</span>
        </nav>
        <div className="flex flex-wrap items-baseline gap-3 mt-4">
          <h1 className="font-heading text-4xl font-black tracking-tight" data-testid="category-title">{cat?.name ?? "Collection"}</h1>
          {products !== undefined && (
            <span className="text-sm font-medium text-muted-foreground" data-testid="category-product-count">
              {products.length} {products.length === 1 ? "Product" : "Products"}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">{cat?.description}</p>
        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-brand-sand" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-muted-foreground text-sm mb-4">Unable to load products. Please check your connection.</p>
              <button
                onClick={() => refetch()}
                className="rounded-full bg-[#2F5233] text-white px-6 py-2 text-sm font-semibold hover:bg-[#2F5233]/90 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <ProductGrid products={products ?? []} testId={`category-grid-${category}`} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
