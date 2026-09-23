import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDateTime, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";
import {
  Calendar,
  RefreshCw,
  Download,
  AlertTriangle,
  Package,
  Users,
  ShoppingCart,
  CheckCircle2,
  Building2,
  Clock,
  ArrowUpRight,
  Search,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import type { AuditEntry } from "@/lib/types";

interface LowStockItem {
  sku: string;
  variant_id: string;
  product_id?: string;
  product_name: string;
  category: string;
  size: string;
  current_stock: number;
  reserved: number;
  free_stock: number;
  stock_status: "OUT OF STOCK" | "CRITICAL" | "LOW STOCK";
}

interface OwnerDashboardResponse {
  preset: string;
  date_from: string;
  date_to: string;
  timezone: string;
  product_orders: {
    mattress_orders: number;
    mattress_units: number;
    mattress_gross_paise: number;
    pillow_orders: number;
    pillow_units: number;
    pillow_gross_paise: number;
    topper_orders: number;
    topper_units: number;
    topper_gross_paise: number;
    baby_kids_orders: number;
    baby_kids_units: number;
    baby_kids_gross_paise: number;
  };
  customer_activity: {
    total_signups: number;
    add_to_cart_users: number;
    purchased_unique_customers: number;
  };
  dealer_network: {
    total_dealers: number;
    pending_approvals: number;
    dealer_sales_paise: number;
    dealer_orders_count: number;
  };
  low_stock: LowStockItem[];
  revenue_paid_paise: number;
  paid_orders: number;
}

interface DrillDownState {
  isOpen: boolean;
  kind: string;
  category?: string;
  title: string;
}

export default function OwnerDashboard() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<string>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Low stock table pagination
  const [stockPage, setStockPage] = useState<number>(1);
  const [stockPageSize, setStockPageSize] = useState<number>(10);
  const [stockSearch, setStockSearch] = useState<string>("");

  // Stock update modal state
  const [stockModalItem, setStockModalItem] = useState<LowStockItem | null>(null);
  const [stockDelta, setStockDelta] = useState<string>("");
  const [stockReason, setStockReason] = useState<string>("Physical Inventory Count");
  const [stockNote, setStockNote] = useState<string>("");

  // Drill-down drawer state
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    isOpen: false,
    kind: "",
    category: "",
    title: "",
  });

  const queryParams = new URLSearchParams({
    preset,
    ...(preset === "custom" && customFrom ? { date_from: customFrom } : {}),
    ...(preset === "custom" && customTo ? { date_to: customTo } : {}),
  }).toString();

  const { data, isLoading, isFetching, refetch } = useQuery<OwnerDashboardResponse>({
    queryKey: ["owner-dashboard", preset, customFrom, customTo],
    queryFn: () => apiGet<OwnerDashboardResponse>(`/admin/dashboard?${queryParams}`),
  });

  const { data: audit } = useQuery<AuditEntry[]>({
    queryKey: ["admin-audit-snapshot"],
    queryFn: () => apiGet<AuditEntry[]>("/admin/audit?limit=8"),
  });

  // Stock adjust mutation
  const adjustStockMutation = useMutation({
    mutationFn: (payload: { variant_id: string; delta: number; reason: string }) =>
      apiPost("/admin/inventory/adjust", payload),
    onSuccess: () => {
      toast.success("Inventory updated and logged to audit ledger");
      setStockModalItem(null);
      setStockDelta("");
      setStockNote("");
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-snapshot"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update inventory");
    },
  });

  // Filtered low stock items
  const filteredStock = useMemo(() => {
    const list = data?.low_stock || [];
    if (!stockSearch) return list;
    const q = stockSearch.toLowerCase();
    return list.filter(
      (item) =>
        item.sku.toLowerCase().includes(q) ||
        item.product_name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q)
    );
  }, [data?.low_stock, stockSearch]);

  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStock.slice(start, start + stockPageSize);
  }, [filteredStock, stockPage, stockPageSize]);

  // Export current summary to CSV
  const handleExportDashboard = () => {
    if (!data) return;
    const csvRows = [
      ["Metric", "Value", "Notes"],
      ["Date Range Preset", data.preset, `${data.date_from} to ${data.date_to}`],
      ["Timezone", data.timezone, ""],
      ["Total Mattress Orders", data.product_orders.mattress_orders, `${data.product_orders.mattress_units} units sold`],
      ["Total Pillow Orders", data.product_orders.pillow_orders, `${data.product_orders.pillow_units} units sold`],
      ["Total Topper Orders", data.product_orders.topper_orders, `${data.product_orders.topper_units} units sold`],
      ["Total Baby + Kids Orders", data.product_orders.baby_kids_orders, `${data.product_orders.baby_kids_units} units sold`],
      ["Customer Signups", data.customer_activity.total_signups, ""],
      ["Add to Cart Users", data.customer_activity.add_to_cart_users, ""],
      ["Purchased Unique Customers", data.customer_activity.purchased_unique_customers, ""],
      ["Total Dealers", data.dealer_network.total_dealers, ""],
      ["Pending Dealer Approvals", data.dealer_network.pending_approvals, ""],
      ["Dealer Sales (₹)", (data.dealer_network.dealer_sales_paise / 100).toFixed(2), `${data.dealer_network.dealer_orders_count} orders`],
      ["Verified Revenue (₹)", (data.revenue_paid_paise / 100).toFixed(2), `${data.paid_orders} paid orders`],
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kotson_owner_dashboard_${data.preset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Dashboard summary exported to CSV");
  };

  const presets = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "custom", label: "Custom Date" },
  ];

  return (
    <div className="space-y-8" data-testid="owner-dashboard">
      {/* Header & Filter Controls */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              <Calendar className="h-3.5 w-3.5" /> Date:
            </span>
            {presets.map((p) => (
              <Button
                key={p.id}
                variant={preset === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p.id)}
                className="text-xs h-8"
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDashboard}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {preset === "custom" && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">From:</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">To:</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <Button size="sm" onClick={() => refetch()} className="h-8 text-xs">
              Apply Range
            </Button>
          </div>
        )}
      </div>

      {/* SECTION 1: Product Orders (4 equal cards) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Product Orders</h2>
            <p className="text-xs text-muted-foreground">
              Unique customer orders containing each category in the selected period (Click any card for full drill-down)
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {preset.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Mattresses */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "product_orders",
                category: "mattresses",
                title: "Mattress Orders Drill-Down",
              })
            }
            className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-mattress-orders"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Mattress Orders
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-deep" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold text-foreground">
                {isLoading ? "—" : data?.product_orders.mattress_orders ?? 0}
              </span>
              <span className="text-xs font-medium text-muted-foreground">orders</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>{data?.product_orders.mattress_units ?? 0} units</span>
              <span className="font-medium text-foreground">
                {inr(data?.product_orders.mattress_gross_paise ?? 0)}
              </span>
            </div>
          </div>

          {/* Card 2: Pillows */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "product_orders",
                category: "pillows",
                title: "Pillow Orders Drill-Down",
              })
            }
            className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-pillow-orders"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Pillow Orders
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-deep" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold text-foreground">
                {isLoading ? "—" : data?.product_orders.pillow_orders ?? 0}
              </span>
              <span className="text-xs font-medium text-muted-foreground">orders</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>{data?.product_orders.pillow_units ?? 0} units</span>
              <span className="font-medium text-foreground">
                {inr(data?.product_orders.pillow_gross_paise ?? 0)}
              </span>
            </div>
          </div>

          {/* Card 3: Toppers */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "product_orders",
                category: "toppers",
                title: "Topper Orders Drill-Down",
              })
            }
            className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-topper-orders"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Topper Orders
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-deep" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold text-foreground">
                {isLoading ? "—" : data?.product_orders.topper_orders ?? 0}
              </span>
              <span className="text-xs font-medium text-muted-foreground">orders</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>{data?.product_orders.topper_units ?? 0} units</span>
              <span className="font-medium text-foreground">
                {inr(data?.product_orders.topper_gross_paise ?? 0)}
              </span>
            </div>
          </div>

          {/* Card 4: Baby + Kids */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "product_orders",
                category: "baby_kids",
                title: "Baby + Kids Orders Drill-Down",
              })
            }
            className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-baby-kids-orders"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Baby + Kids Orders
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-deep" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold text-foreground">
                {isLoading ? "—" : data?.product_orders.baby_kids_orders ?? 0}
              </span>
              <span className="text-xs font-medium text-muted-foreground">orders</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>{data?.product_orders.baby_kids_units ?? 0} units</span>
              <span className="font-medium text-foreground">
                {inr(data?.product_orders.baby_kids_gross_paise ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Customer Activity (3 large cards) */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Customer Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Signups */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "customer_signups",
                title: "Registered Customers Drill-Down",
              })
            }
            className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-customer-signups"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <Users className="h-4 w-4 text-brand-deep" /> Total Customer Signups
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:text-brand-deep" />
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : data?.customer_activity.total_signups ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">New accounts registered in period</p>
          </div>

          {/* Card 2: Add to Cart Users */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "cart_users",
                title: "Add To Cart Users Drill-Down",
              })
            }
            className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-cart-users"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <ShoppingCart className="h-4 w-4 text-brand-deep" /> Add To Cart Users
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:text-brand-deep" />
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : data?.customer_activity.add_to_cart_users ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Unique users who added ≥ 1 item to cart</p>
          </div>

          {/* Card 3: Purchased Unique Customers */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "purchased_customers",
                title: "Purchased Unique Customers Drill-Down",
              })
            }
            className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-purchased-customers"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-brand-leaf" /> Purchased Unique Customers
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:text-brand-deep" />
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : data?.customer_activity.purchased_unique_customers ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Deduplicated buyer accounts with completed orders</p>
          </div>
        </div>
      </section>

      {/* SECTION 3: Dealer Network (3 cards) */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Dealer Network</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Dealers */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "dealers",
                title: "Dealer Accounts Drill-Down",
              })
            }
            className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-total-dealers"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <Building2 className="h-4 w-4 text-brand-deep" /> Total Dealers
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:text-brand-deep" />
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : data?.dealer_network.total_dealers ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Registered wholesale & showroom partners</p>
          </div>

          {/* Card 2: Pending Approvals */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "pending_dealers",
                title: "Pending Dealer Approvals Queue",
              })
            }
            className={`group cursor-pointer rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              (data?.dealer_network.pending_approvals ?? 0) > 0
                ? "border-amber-400/60 bg-amber-500/5 hover:border-amber-500"
                : "border-border bg-card hover:border-brand-leaf/50"
            }`}
            data-testid="card-pending-dealers"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-4 w-4 text-amber-600" /> Pending Approvals
              </span>
              {(data?.dealer_network.pending_approvals ?? 0) > 0 && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-100 text-[10px]">
                  Requires Action
                </Badge>
              )}
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : data?.dealer_network.pending_approvals ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Dealer applications awaiting owner verification</p>
          </div>

          {/* Card 3: Dealer Sales */}
          <div
            onClick={() =>
              setDrillDown({
                isOpen: true,
                kind: "dealer_sales",
                title: "Dealer B2B Sales Drill-Down",
              })
            }
            className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md"
            data-testid="card-dealer-sales"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <Building2 className="h-4 w-4 text-brand-leaf" /> Dealer Sales
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:text-brand-deep" />
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(data?.dealer_network.dealer_sales_paise ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.dealer_network.dealer_orders_count ?? 0} B2B wholesale orders fulfilled
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: Low Stock Table (≤5 free units) */}
      <section className="space-y-3" data-testid="section-low-stock">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="font-heading text-lg font-bold text-foreground">Low Stock Inventory</h2>
              <Badge variant="outline" className="text-xs">
                ≤ 5 free units
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Current live warehouse inventory (Free Stock = Total Stock - Reserved Units). Independent of historical date filter.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search SKU or product..."
                value={stockSearch}
                onChange={(e) => {
                  setStockSearch(e.target.value);
                  setStockPage(1);
                }}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Variant / Size</TableHead>
                <TableHead className="text-right text-xs">Total Stock</TableHead>
                <TableHead className="text-right text-xs">Reserved</TableHead>
                <TableHead className="text-right text-xs">Free Available</TableHead>
                <TableHead className="text-center text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                    {filteredStock.length === 0
                      ? "All variants have sufficient inventory (>5 free units). Excellent!"
                      : "No items match your search filter."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStock.map((item) => (
                  <TableRow key={item.sku} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                    <TableCell className="text-xs font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">
                      {item.category.replace("-", " ")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.size}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{item.current_stock}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {item.reserved}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold tabular-nums">
                      {item.free_stock}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.stock_status === "OUT OF STOCK" ? (
                        <Badge variant="destructive" className="text-[10px] uppercase">
                          Out of Stock
                        </Badge>
                      ) : item.stock_status === "CRITICAL" ? (
                        <Badge variant="outline" className="border-red-400 bg-red-50 text-red-700 text-[10px] uppercase">
                          Critical ({item.free_stock})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700 text-[10px] uppercase">
                          Low Stock ({item.free_stock})
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStockModalItem(item);
                          setStockDelta("");
                          setStockNote("");
                        }}
                        className="h-7 text-xs"
                      >
                        Update Stock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filteredStock.length > 10 && (
            <div className="border-t border-border p-3">
              <DataTablePagination
                currentPage={stockPage}
                pageSize={stockPageSize}
                totalItems={filteredStock.length}
                onPageChange={setStockPage}
                onPageSizeChange={(newSize) => {
                  setStockPageSize(newSize);
                  setStockPage(1);
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Snapshot of Recent Privileged Actions */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Privileged Actions Snapshot
          </span>
          <Link to="/admin/audit" className="text-xs font-semibold text-brand-deep hover:underline">
            Open Full Audit Log Report →
          </Link>
        </div>
        <ul className="space-y-2 text-xs">
          {(audit ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No privileged actions recorded yet.</p>
          )}
          {(audit ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                {a.action}
              </Badge>
              <span className="text-muted-foreground">
                {a.entity}/{a.entity_id.slice(0, 8)}
              </span>
              <span className="text-foreground">{a.detail}</span>
              <span className="ml-auto text-muted-foreground text-[11px]">
                {a.actor_email} · {fmtDateTime(a.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Stock Adjustment Dialog */}
      {stockModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-base font-bold">Update Stock Inventory</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audited inventory adjustment recorded in ledger
                </p>
              </div>
              <button
                onClick={() => setStockModalItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 space-y-1 text-xs">
              <p className="font-semibold text-foreground">{stockModalItem.product_name}</p>
              <p className="text-muted-foreground">
                SKU: <span className="font-mono font-medium text-foreground">{stockModalItem.sku}</span> | Size: {stockModalItem.size}
              </p>
              <div className="flex items-center gap-4 pt-1 font-mono">
                <span>Total: {stockModalItem.current_stock}</span>
                <span>Reserved: {stockModalItem.reserved}</span>
                <span className="font-bold text-brand-deep">Free: {stockModalItem.free_stock}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-xs">Quantity to Add (+) or Deduct (-)</Label>
                <Input
                  type="number"
                  placeholder="e.g. +10 or -2"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  New total stock will be:{" "}
                  <strong className="text-foreground">
                    {Math.max(0, stockModalItem.current_stock + (parseInt(stockDelta, 10) || 0))}
                  </strong>
                </p>
              </div>

              <div>
                <Label className="text-xs">Audit Reason</Label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Physical Inventory Count">Physical Inventory Count</option>
                  <option value="New Supplier Stock Received">New Supplier Stock Received</option>
                  <option value="Damaged / Scrapped Units">Damaged / Scrapped Units</option>
                  <option value="Customer Return Stock Adjustment">Customer Return Stock Adjustment</option>
                  <option value="Manual Warehouse Correction">Manual Warehouse Correction</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Optional Notes</Label>
                <Input
                  placeholder="e.g. Invoice #PO-9918 verified"
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setStockModalItem(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!stockDelta || parseInt(stockDelta, 10) === 0 || adjustStockMutation.isPending}
                onClick={() => {
                  const delta = parseInt(stockDelta, 10);
                  if (isNaN(delta) || delta === 0) return;
                  adjustStockMutation.mutate({
                    variant_id: stockModalItem.variant_id,
                    delta,
                    reason: stockNote ? `${stockReason} (${stockNote})` : stockReason,
                  });
                }}
              >
                {adjustStockMutation.isPending ? "Updating..." : "Save Stock Adjustment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Drawer / Modal */}
      {drillDown.isOpen && (
        <DrillDownModal
          state={drillDown}
          preset={preset}
          dateFrom={customFrom}
          dateTo={customTo}
          onClose={() =>
            setDrillDown({
              isOpen: false,
              kind: "",
              category: "",
              title: "",
            })
          }
        />
      )}
    </div>
  );
}

// Subcomponent: Drill-Down Modal
function DrillDownModal({
  state,
  preset,
  dateFrom,
  dateTo,
  onClose,
}: {
  state: DrillDownState;
  preset: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryParams = new URLSearchParams({
    kind: state.kind,
    ...(state.category ? { category: state.category } : {}),
    preset,
    ...(preset === "custom" && dateFrom ? { date_from: dateFrom } : {}),
    ...(preset === "custom" && dateTo ? { date_to: dateTo } : {}),
  }).toString();

  const { data, isLoading } = useQuery<{
    kind: string;
    category?: string;
    summary?: {
      total_orders?: number;
      units_sold?: number;
      gross_sales_paise?: number;
      net_revenue_paise?: number;
      total_dealers?: number;
      total_sales_paise?: number;
    };
    total?: number;
    rows: any[];
  }>({
    queryKey: ["dashboard-drill-down", state.kind, state.category, preset, dateFrom, dateTo],
    queryFn: () => apiGet<any>(`/admin/dashboard/drill-down?${queryParams}`),
  });

  const filteredRows = useMemo(() => {
    const list = data?.rows || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((r) => {
      return (
        (r.order_number && r.order_number.toLowerCase().includes(q)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.org_name && r.org_name.toLowerCase().includes(q))
      );
    });
  }, [data?.rows, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleExportCSV = () => {
    if (!filteredRows.length) return;
    const keys = Object.keys(filteredRows[0]).filter((k) => typeof filteredRows[0][k] !== "object");
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        keys.join(","),
        ...filteredRows.map((r) =>
          keys
            .map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");
    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `drilldown_${state.kind}_${state.category || ""}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Drill-down data exported");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">{state.title}</h3>
            <p className="text-xs text-muted-foreground">
              Period: <span className="font-semibold uppercase">{preset}</span> ({filteredRows.length} records found)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredRows.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Summary Strip (if available) */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border bg-muted/40 px-6 py-3 text-xs">
            <div>
              <span className="text-muted-foreground">Total Orders:</span>
              <p className="font-heading text-base font-bold text-foreground">
                {data.summary.total_orders ?? filteredRows.length}
              </p>
            </div>
            {data.summary.units_sold !== undefined && (
              <div>
                <span className="text-muted-foreground">Units Sold:</span>
                <p className="font-heading text-base font-bold text-foreground">{data.summary.units_sold}</p>
              </div>
            )}
            {data.summary.gross_sales_paise !== undefined && (
              <div>
                <span className="text-muted-foreground">Gross Sales:</span>
                <p className="font-heading text-base font-bold text-foreground">
                  {inr(data.summary.gross_sales_paise)}
                </p>
              </div>
            )}
            {data.summary.net_revenue_paise !== undefined && (
              <div>
                <span className="text-muted-foreground">Net Revenue:</span>
                <p className="font-heading text-base font-bold text-brand-deep">
                  {inr(data.summary.net_revenue_paise)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search in drill-down..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto px-6 py-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              Loading drill-down records...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              No matching records found in this category / period.
            </div>
          ) : state.kind === "product_orders" ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Order #</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Category Items</TableHead>
                  <TableHead className="text-xs">Channel / Source</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-center text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((r: any) => (
                  <TableRow key={r.order_id || r.order_number} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>{r.order_number}</span>
                        {r.is_test_data && (
                          <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-500/30">
                            TEST
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.order_date)}</TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">{r.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.mobile || r.city}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {(r.products || []).map((p: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          {p.name} ({p.size || ""}) × {p.qty}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {r.sales_source || "WEBSITE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold tabular-nums">
                      {inr(r.order_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {r.order_status || "paid"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Name / Org</TableHead>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-right text-xs">Orders / Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((r: any, idx: number) => (
                  <TableRow key={r.customer_id || r.id || idx} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{r.name || r.org_name || r.customer_name || "—"}</span>
                        {r.is_test_data && (
                          <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-500/30">
                            TEST
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p>{r.email || "—"}</p>
                      <p>{r.phone || r.mobile || ""}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.city ? `${r.city}, ${r.state || ""}` : r.territory || r.items_count ? `${r.items_count} items in cart` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(r.registration_date || r.created_at || r.updated_at)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.lifetime_spend_paise !== undefined
                        ? inr(r.lifetime_spend_paise)
                        : r.orders_count !== undefined
                        ? `${r.orders_count} orders`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer Pagination */}
        {filteredRows.length > 10 && (
          <div className="border-t border-border bg-muted/20 px-6 py-3">
            <DataTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
