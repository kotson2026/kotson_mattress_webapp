import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  EyeOff,
  Copy,
  Archive,
  Edit3,
  Layers,
  Sparkles,
  AlertCircle,
  Tag,
  DollarSign,
  Grid,
  FileText,
  CheckCircle2,
  X,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";

interface ProductOverview {
  total_products: number;
  active_products: number;
  paused_products: number;
  out_of_stock: number;
  low_stock: number;
}

interface Variant {
  id: string;
  sku: string;
  size: string;
  price: number;
  mrp: number;
  stock: number;
  free_stock: number;
  discount_amount: number;
  discount_percent: number;
}

interface ProductItem {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  brand?: string;
  tagline?: string;
  short_description?: string;
  description?: string;
  primary_image?: string;
  images?: string[];
  cta_button_name?: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  website_visibility: "VISIBLE" | "HIDDEN";
  is_featured?: boolean;
  is_new_arrival?: boolean;
  is_best_seller?: boolean;
  price_from?: number;
  mrp_from?: number;
  in_stock: boolean;
  total_stock: number;
  variants: Variant[];
}

export default function CatalogCentralHub() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  // Queries
  const { data: overview } = useQuery<ProductOverview>({
    queryKey: ["catalog-overview"],
    queryFn: () => apiGet("/admin/catalog/overview"),
  });

  const { data: categoriesData } = useQuery<{ rows: { id: string; slug: string; name: string }[] }>({
    queryKey: ["admin-categories"],
    queryFn: () => apiGet("/admin/catalog/categories"),
  });
  const categories = categoriesData?.rows || [];

  const { data: productsData, isLoading } = useQuery<{
    total: number;
    rows: ProductItem[];
  }>({
    queryKey: ["catalog-products", q, categoryFilter, statusFilter, stockFilter, page, pageSize],
    queryFn: () =>
      apiGet(
        `/admin/catalog/products?q=${encodeURIComponent(q)}&category=${categoryFilter}&status=${statusFilter}&stock_status=${stockFilter}&page=${page}&limit=${pageSize}`
      ),
  });

  const products = productsData?.rows || [];
  const total = productsData?.total || 0;

  // Mutations
  const toggleStatus = useMutation({
    mutationFn: ({ id, status, visibility }: { id: string; status: string; visibility: string }) =>
      apiPost(`/admin/catalog/products/${id}/status?status=${status}&visibility=${visibility}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-overview"] });
      toast.success("Product visibility updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update status"),
  });

  const duplicateProduct = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/catalog/products/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-overview"] });
      toast.success("Product cloned into draft successfully");
    },
    onError: (e: any) => toast.error(e.message || "Could not duplicate product"),
  });

  const archiveProduct = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/catalog/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-overview"] });
      toast.success("Product archived safely (orders preserved)");
    },
    onError: (e: any) => toast.error(e.message || "Could not archive product"),
  });

  const openNewProduct = () => {
    setEditingProduct(null);
    setActiveTab(1);
    setIsProductModalOpen(true);
  };

  const openEditProduct = (p: ProductItem) => {
    setEditingProduct(p);
    setActiveTab(1);
    setIsProductModalOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="catalog-central-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Catalog Central Hub</h1>
          <p className="text-sm text-muted-foreground">
            Authoritative source of truth for products, pricing, variants, and storefront display.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsCategoryDrawerOpen(true)}
            className="border-primary/20 hover:bg-primary/5"
          >
            <Grid className="w-4 h-4 mr-2" />
            Categories ({categories.length})
          </Button>
          <Button onClick={openNewProduct} className="bg-primary text-primary-foreground shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Products</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_products ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all categories</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active & Live</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.active_products ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Visible on storefront</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paused / Hidden</span>
            <EyeOff className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{overview?.paused_products ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Temporarily inactive</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{overview?.out_of_stock ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Zero free stock</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Low Stock</span>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-700">{overview?.low_stock ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">&lt; 5 units remaining</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search products by title, SKU, or slug…"
              className="pl-9 bg-background"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active (Live)</option>
              <option value="PAUSED">Paused / Draft</option>
            </select>
          </div>

          <div>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Stock Levels</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock (&lt; 5)</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products High-Density Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-16">Preview</TableHead>
              <TableHead>Product Name & Slug</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Selling Price (MRP)</TableHead>
              <TableHead>Variants / Sizes</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Display Badges</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Loading catalog inventory…
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  No products found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const isLive = p.status === "ACTIVE" && p.website_visibility === "VISIBLE";
                return (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
                        {p.primary_image ? (
                          <img src={p.primary_image} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">/products/{p.slug}</div>
                      {p.tagline && <div className="text-xs text-muted-foreground italic truncate max-w-xs">{p.tagline}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.category_slug}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-sm text-foreground">
                        {p.price_from ? inr(p.price_from) : "—"}
                      </div>
                      {p.mrp_from && p.price_from && p.mrp_from > p.price_from && (
                        <div className="text-xs text-muted-foreground line-through">
                          {inr(p.mrp_from)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">
                        {p.variants?.length || 0} variant(s)
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {p.variants?.map((v) => v.size).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.total_stock === 0
                              ? "bg-rose-500"
                              : p.total_stock < 5
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="text-xs font-semibold">{p.total_stock} in stock</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.is_best_seller && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 border-amber-300">
                            Best Seller
                          </Badge>
                        )}
                        {p.is_new_arrival && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 border-emerald-300">
                            New
                          </Badge>
                        )}
                        {p.cta_button_name && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {p.cta_button_name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          isLive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isLive ? "LIVE" : "PAUSED"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          title="Edit Product"
                          onClick={() => openEditProduct(p)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={isLive ? "Pause / Hide" : "Publish Live"}
                          onClick={() =>
                            toggleStatus.mutate({
                              id: p.id,
                              status: isLive ? "PAUSED" : "ACTIVE",
                              visibility: isLive ? "HIDDEN" : "VISIBLE",
                            })
                          }
                        >
                          {isLive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Duplicate Product"
                          onClick={() => duplicateProduct.mutate(p.id)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                          title="Archive Product"
                          onClick={() => {
                            if (confirm(`Archive product "${p.name}"? Past orders remain intact.`)) {
                              archiveProduct.mutate(p.id);
                            }
                          }}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-border">
          <DataTablePagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* 10-Tab Product Modal */}
      {isProductModalOpen && (
        <ProductEditorModal
          product={editingProduct}
          categories={categories}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={() => setIsProductModalOpen(false)}
          onSuccess={() => {
            setIsProductModalOpen(false);
            qc.invalidateQueries({ queryKey: ["catalog-products"] });
            qc.invalidateQueries({ queryKey: ["catalog-overview"] });
          }}
        />
      )}

      {/* Categories Management Drawer */}
      {isCategoryDrawerOpen && (
        <CategoryManagerDrawer
          categories={categories}
          onClose={() => setIsCategoryDrawerOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin-categories"] });
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 10-Tab Product Editor Modal Component
// -------------------------------------------------------------
function ProductEditorModal({
  product,
  categories,
  activeTab,
  setActiveTab,
  onClose,
  onSuccess,
}: {
  product: ProductItem | null;
  categories: { id: string; slug: string; name: string }[];
  activeTab: number;
  setActiveTab: (n: number) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<any>({
    name: product?.name || "",
    slug: product?.slug || "",
    brand: product?.brand || "Kotson Mattress Co.",
    category_slug: product?.category_slug || (categories[0]?.slug || "mattresses"),
    tagline: product?.tagline || "",
    short_description: product?.short_description || "",
    description: product?.description || "",
    cta_button_name: product?.cta_button_name || "Buy Now",
    primary_image: product?.primary_image || "",
    images: product?.images || [],
    is_featured: product?.is_featured || false,
    is_new_arrival: product?.is_new_arrival || false,
    is_best_seller: product?.is_best_seller || false,
    status: product?.status || "ACTIVE",
    website_visibility: product?.website_visibility || "VISIBLE",
    referral_reward_percent: 5.0,
    dealer_discount_percent: 25.0,
    variants: product?.variants || [
      { id: "v1", sku: "KS-KING-01", size: "King (78x72)", price: 29999, mrp: 39999, stock: 10 },
      { id: "v2", sku: "KS-QUEEN-01", size: "Queen (78x60)", price: 24999, mrp: 32999, stock: 8 },
    ],
  });

  const saveProduct = useMutation({
    mutationFn: () => {
      if (product) {
        return apiPut(`/admin/catalog/products/${product.id}`, formData);
      }
      return apiPost("/admin/catalog/products", formData);
    },
    onSuccess: () => {
      toast.success(product ? "Product updated successfully" : "Product created successfully");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save product"),
  });

  const tabs = [
    { id: 1, label: "Basic Info", icon: Package },
    { id: 2, label: "Pricing & MRP", icon: DollarSign },
    { id: 3, label: "Variants & Stock", icon: Layers },
    { id: 4, label: "Media Gallery", icon: Grid },
    { id: 5, label: "Materials & Firmness", icon: Sparkles },
    { id: 6, label: "Store Display", icon: Eye },
    { id: 7, label: "Inventory Thresholds", icon: AlertCircle },
    { id: 8, label: "SEO & Social", icon: FileText },
    { id: 9, label: "Refer & Earn", icon: TrendingUp },
    { id: 10, label: "Dealer Terms", icon: Tag },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-5xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="font-heading text-lg font-bold">
              {product ? `Edit Product: ${product.name}` : "Create New Master Catalog Product"}
            </h2>
            <p className="text-xs text-muted-foreground">Authoritative price authority and storefront specification.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="flex border-b border-border bg-muted/10 overflow-x-auto px-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Kotson 7-Zone Orthopedic Mattress"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>URL Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="kotson-7-zone-ortho"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <select
                    value={formData.category_slug}
                    onChange={(e) => setFormData({ ...formData, category_slug: e.target.value })}
                    className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Brand / Manufacturer</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Kotson Mattress Co."
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Tagline / Subheadline</Label>
                <Input
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Ergonomically contoured for chronic backache relief"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Short Description (Card summary)</Label>
                <Textarea
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  placeholder="Brief synopsis shown on category pages and Google preview"
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <Label>Detailed Story / Construction Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Full engineering description, foam densities, and breathability details"
                  className="mt-1"
                  rows={4}
                />
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <strong>Authoritative Pricing Rule:</strong> Prices set here are absolute. The storefront checkout
                revalidates every line against database variants. Selling price must never exceed MRP.
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Base Selling Price (₹)</Label>
                  <Input
                    type="number"
                    value={formData.variants[0]?.price || 24999}
                    onChange={(e) => {
                      const v = [...formData.variants];
                      if (v[0]) v[0].price = Number(e.target.value);
                      setFormData({ ...formData, variants: v });
                    }}
                    className="mt-1 font-bold text-lg"
                  />
                </div>
                <div>
                  <Label>Maximum Retail Price (MRP ₹)</Label>
                  <Input
                    type="number"
                    value={formData.variants[0]?.mrp || 32999}
                    onChange={(e) => {
                      const v = [...formData.variants];
                      if (v[0]) v[0].mrp = Number(e.target.value);
                      setFormData({ ...formData, variants: v });
                    }}
                    className="mt-1 font-bold text-lg"
                  />
                </div>
                <div>
                  <Label>Auto-Calculated Discount</Label>
                  <div className="h-10 mt-1 flex items-center px-3 rounded-md bg-muted font-bold text-emerald-700">
                    {formData.variants[0]?.mrp > formData.variants[0]?.price
                      ? `${Math.round(
                          ((formData.variants[0].mrp - formData.variants[0].price) / formData.variants[0].mrp) * 100
                        )}% OFF (Save ${inr(formData.variants[0].mrp - formData.variants[0].price)})`
                      : "No discount"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold">Product Sizes & SKUs</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      variants: [
                        ...formData.variants,
                        {
                          id: `v_${Date.now()}`,
                          sku: `KS-${Date.now().toString().slice(-4)}`,
                          size: "Single (72x36)",
                          price: 14999,
                          mrp: 19999,
                          stock: 5,
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Size / Dimension</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Selling Price (₹)</TableHead>
                      <TableHead>MRP (₹)</TableHead>
                      <TableHead>Stock Qty</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.variants.map((v: any, idx: number) => (
                      <TableRow key={v.id || idx}>
                        <TableCell>
                          <Input
                            value={v.size}
                            onChange={(e) => {
                              const n = [...formData.variants];
                              n[idx].size = e.target.value;
                              setFormData({ ...formData, variants: n });
                            }}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={v.sku}
                            onChange={(e) => {
                              const n = [...formData.variants];
                              n[idx].sku = e.target.value;
                              setFormData({ ...formData, variants: n });
                            }}
                            className="h-8 font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={v.price}
                            onChange={(e) => {
                              const n = [...formData.variants];
                              n[idx].price = Number(e.target.value);
                              setFormData({ ...formData, variants: n });
                            }}
                            className="h-8 font-bold"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={v.mrp}
                            onChange={(e) => {
                              const n = [...formData.variants];
                              n[idx].mrp = Number(e.target.value);
                              setFormData({ ...formData, variants: n });
                            }}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={v.stock}
                            onChange={(e) => {
                              const n = [...formData.variants];
                              n[idx].stock = Number(e.target.value);
                              setFormData({ ...formData, variants: n });
                            }}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                            onClick={() => {
                              const n = formData.variants.filter((_: any, i: number) => i !== idx);
                              setFormData({ ...formData, variants: n });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Primary Hero Image URL</Label>
                <Input
                  value={formData.primary_image}
                  onChange={(e) => setFormData({ ...formData, primary_image: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Additional Gallery Images (Comma-separated URLs)</Label>
                <Textarea
                  value={(formData.images || []).join("\n")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      images: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="One image URL per line"
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {activeTab === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Firmness Score (1 Soft - 10 Extra Firm)</Label>
                  <Input type="number" min="1" max="10" defaultValue="7" className="mt-1" />
                </div>
                <div>
                  <Label>Mattress Height / Thickness</Label>
                  <Input defaultValue="8 Inches (20.3 cm)" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Core Foam / Spring Technology</Label>
                <Input defaultValue="7-Zone Ergonomic Memory Foam + Natural Latex" className="mt-1" />
              </div>
            </div>
          )}

          {activeTab === 6 && (
            <div className="space-y-4">
              <div>
                <Label>Storefront CTA Button Label</Label>
                <Input
                  value={formData.cta_button_name}
                  onChange={(e) => setFormData({ ...formData, cta_button_name: e.target.value })}
                  placeholder="Buy Now / Pre-Order"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-6 mt-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_best_seller}
                    onChange={(e) => setFormData({ ...formData, is_best_seller: e.target.checked })}
                    className="rounded"
                  />
                  Mark as Best Seller
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_new_arrival}
                    onChange={(e) => setFormData({ ...formData, is_new_arrival: e.target.checked })}
                    className="rounded"
                  />
                  Mark as New Arrival
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="rounded"
                  />
                  Feature on Homepage
                </label>
              </div>
            </div>
          )}

          {activeTab === 7 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Low Stock Alert Threshold</Label>
                  <Input type="number" defaultValue="5" className="mt-1" />
                </div>
                <div>
                  <Label>Warehouse Bin Location</Label>
                  <Input defaultValue="WH-HYD-BIN-A4" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 8 && (
            <div className="space-y-4">
              <div>
                <Label>SEO Meta Title</Label>
                <Input defaultValue={`${formData.name} | Buy Online at Best Price`} className="mt-1" />
              </div>
              <div>
                <Label>SEO Meta Description</Label>
                <Textarea defaultValue={formData.short_description} rows={3} className="mt-1" />
              </div>
            </div>
          )}

          {activeTab === 9 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <Label>Refer & Earn Reward Percentage for This Product</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    value={formData.referral_reward_percent}
                    onChange={(e) => setFormData({ ...formData, referral_reward_percent: Number(e.target.value) })}
                    className="w-32 font-bold"
                  />
                  <span className="text-sm font-semibold">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  When a customer purchases this product using a referral link, the referrer automatically earns this
                  reward.
                </p>
              </div>
            </div>
          )}

          {activeTab === 10 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <Label>Authorized Dealer Wholesale Margin</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    value={formData.dealer_discount_percent}
                    onChange={(e) => setFormData({ ...formData, dealer_discount_percent: Number(e.target.value) })}
                    className="w-32 font-bold"
                  />
                  <span className="text-sm font-semibold">% off MRP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Standard wholesale concession available to approved dealers placing B2B orders.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {activeTab < 10 && (
              <Button variant="outline" onClick={() => setActiveTab(activeTab + 1)}>
                Next Tab <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            <Button
              onClick={() => saveProduct.mutate()}
              disabled={saveProduct.isPending}
              className="bg-primary text-primary-foreground font-semibold px-6"
            >
              {saveProduct.isPending ? "Saving Product…" : product ? "Update Product" : "Publish to Catalog"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Category Management Drawer Component
// -------------------------------------------------------------
function CategoryManagerDrawer({
  categories,
  onClose,
  onSuccess,
}: {
  categories: { id: string; slug: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  const addCategory = useMutation({
    mutationFn: () =>
      apiPost("/admin/catalog/categories", {
        name: newCatName,
        slug: newCatSlug || newCatName.toLowerCase().replace(/\s+/g, "-"),
      }),
    onSuccess: () => {
      toast.success("Category created");
      setNewCatName("");
      setNewCatSlug("");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create category"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
      <div className="bg-card w-full max-w-md h-full border-l border-border p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        <div>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-heading text-lg font-bold">Catalog Categories</h3>
              <p className="text-xs text-muted-foreground">Manage storefront product categories</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <Label className="text-xs font-bold uppercase">Add New Category</Label>
              <Input
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                placeholder="Category Name (e.g. Bed Protectors)"
              />
              <Input
                value={newCatSlug}
                onChange={(e) => setNewCatSlug(e.target.value)}
                placeholder="slug (e.g. bed-protectors)"
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={() => addCategory.mutate()}
                disabled={!newCatName.trim() || addCategory.isPending}
                className="w-full"
              >
                Create Category
              </Button>
            </div>

            <div className="space-y-2 mt-4">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Existing Categories</Label>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/10"
                >
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">/collections/{c.slug}</div>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={onClose} className="w-full mt-6">
          Close Drawer
        </Button>
      </div>
    </div>
  );
}
