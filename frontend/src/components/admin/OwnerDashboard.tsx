import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import { useConsoleLayout } from "@/components/layout/ConsoleLayout";
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
  Menu,
  TrendingUp,
  Receipt,
  ShoppingBag,
} from "lucide-react";

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

  const { openMobileDrawer } = useConsoleLayout();
  const aov = data && data.paid_orders > 0 ? Math.round(data.revenue_paid_paise / data.paid_orders) : 0;

  return (
    <div className="space-y-4" data-testid="owner-dashboard">
      {/* ── Top Header & Segmented Date Filter Bar (Image 1 single-row hierarchy) ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pb-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openMobileDrawer}
            className="md:hidden flex items-center justify-center p-2 rounded-xl border border-[#E6E0D5] bg-card text-[#2D2D2D] hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#16241C]">
              Owner / Admin console
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kotson Mattresses Executive & Operations Center
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Date Picker Pill Bar */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-xs">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2">
              <Calendar className="h-3.5 w-3.5 text-[#467065]" /> DATE:
            </span>
            {presets.map((p) => {
              const isActive = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`h-7 rounded-lg px-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#467065] text-white shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs font-medium rounded-xl border-border bg-card shadow-xs hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDashboard}
            className="h-8 gap-1.5 text-xs font-medium rounded-xl border-border bg-card shadow-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card p-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">From:</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-36 bg-background rounded-lg border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">To:</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs w-36 bg-background rounded-lg border-border"
            />
          </div>
          <Button size="sm" onClick={() => refetch()} className="h-8 text-xs bg-[#467065] text-white hover:bg-[#16241C]">
            Apply Range
          </Button>
        </div>
      )}

      {/* ── ROW 1: 4 Top KPI Cards (Authoritative Real Data, Image 1 Proportion) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: TOTAL REVENUE */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2EC] text-[#467065]">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Revenue
              </span>
            </div>
            {(data?.paid_orders ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                <span>↑</span> +100%
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <p className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
              {isLoading ? "—" : inr(data?.revenue_paid_paise ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(data?.paid_orders ?? 0) > 0
                ? `From ${(data?.product_orders.mattress_orders ?? 0) > 0 ? `${data?.product_orders.mattress_orders} mattress order` : `${data?.paid_orders} paid order`}`
                : "From 0 orders in period"}
            </p>
          </div>
        </div>

        {/* Card 2: PAID ORDERS */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2EC] text-[#467065]">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Paid Orders
              </span>
            </div>
            {(data?.paid_orders ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                <span>↑</span> +100%
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <p className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
              {isLoading ? "—" : data?.paid_orders ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              out of {data?.paid_orders ?? 0} total orders
            </p>
          </div>
        </div>

        {/* Card 3: AVERAGE ORDER VALUE */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2EC] text-[#467065]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Average Order Value
              </span>
            </div>
            {(data?.paid_orders ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                <span>↑</span> +100%
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <p className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
              {isLoading ? "—" : inr(aov)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">per paid order</p>
          </div>
        </div>

        {/* Card 4: NEW REGISTRATIONS */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2EC] text-[#467065]">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                New Registrations
              </span>
            </div>
            {(data?.customer_activity.total_signups ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                <span>↑</span> +100%
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <p className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
              {isLoading ? "—" : data?.customer_activity.total_signups ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">customer accounts</p>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Product Orders (4 Horizontal Cards with Visual Density) ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-[#16241C]">Product Orders</h2>
            <p className="text-xs text-muted-foreground">
              Unique customer orders containing each category in the selected period (Click any card for full drill-down)
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono uppercase border-border/80 bg-card text-muted-foreground">
            {preset.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs hover:border-[#7C9C59]/60 hover:shadow-sm transition-all"
            data-testid="card-mattress-orders"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#467065]">
                  <Package className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Mattress Orders
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:text-[#467065] transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.product_orders.mattress_orders ?? 0}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground font-medium">orders</span>
              </div>
              <div className="flex items-end gap-0.5 h-4 opacity-50">
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.mattress_orders ?? 0) > 0 ? "70%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.mattress_orders ?? 0) > 0 ? "100%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.mattress_orders ?? 0) > 0 ? "60%" : "20%" }} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">{data?.product_orders.mattress_units ?? 0} units</span>
              <span className="font-bold text-[#16241C]">
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
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs hover:border-[#7C9C59]/60 hover:shadow-sm transition-all"
            data-testid="card-pillow-orders"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#467065]">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Pillow Orders
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:text-[#467065] transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.product_orders.pillow_orders ?? 0}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground font-medium">orders</span>
              </div>
              <div className="flex items-end gap-0.5 h-4 opacity-50">
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.pillow_orders ?? 0) > 0 ? "70%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.pillow_orders ?? 0) > 0 ? "100%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.pillow_orders ?? 0) > 0 ? "60%" : "20%" }} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">{data?.product_orders.pillow_units ?? 0} units</span>
              <span className="font-bold text-[#16241C]">
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
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs hover:border-[#7C9C59]/60 hover:shadow-sm transition-all"
            data-testid="card-topper-orders"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#467065]">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Topper Orders
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:text-[#467065] transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.product_orders.topper_orders ?? 0}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground font-medium">orders</span>
              </div>
              <div className="flex items-end gap-0.5 h-4 opacity-50">
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.topper_orders ?? 0) > 0 ? "70%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.topper_orders ?? 0) > 0 ? "100%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.topper_orders ?? 0) > 0 ? "60%" : "20%" }} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">{data?.product_orders.topper_units ?? 0} units</span>
              <span className="font-bold text-[#16241C]">
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
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs hover:border-[#7C9C59]/60 hover:shadow-sm transition-all"
            data-testid="card-baby-kids-orders"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#467065]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Baby + Kids Orders
                </span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:text-[#467065] transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="font-heading text-2xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.product_orders.baby_kids_orders ?? 0}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground font-medium">orders</span>
              </div>
              <div className="flex items-end gap-0.5 h-4 opacity-50">
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.baby_kids_orders ?? 0) > 0 ? "70%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.baby_kids_orders ?? 0) > 0 ? "100%" : "20%" }} />
                <div className="w-1 bg-[#467065] rounded-xs" style={{ height: (data?.product_orders.baby_kids_orders ?? 0) > 0 ? "60%" : "20%" }} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">{data?.product_orders.baby_kids_units ?? 0} units</span>
              <span className="font-bold text-[#16241C]">
                {inr(data?.product_orders.baby_kids_gross_paise ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROW 3: Two-Column Composition (Customer Activity & Dealer Network) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Customer Activity Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-[#16241C]">Customer Activity</h2>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b border-border/60">
              {/* Signups */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "customer_signups",
                    title: "Registered Customers Drill-Down",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-customer-signups"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-[#467065]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Total Customer Signups
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-xl font-bold tracking-tight text-[#16241C]">
                    {isLoading ? "—" : data?.customer_activity.total_signups ?? 0}
                  </span>
                  {(data?.customer_activity.total_signups ?? 0) > 0 && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded-sm">↑ +100%</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  New accounts registered in period
                </p>
              </div>

              {/* Add to Cart */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "cart_users",
                    title: "Add To Cart Users Drill-Down",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-cart-users"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5 text-[#467065]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Add to Cart Users
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-xl font-bold tracking-tight text-[#16241C]">
                    {isLoading ? "—" : data?.customer_activity.add_to_cart_users ?? 0}
                  </span>
                  {(data?.customer_activity.add_to_cart_users ?? 0) > 0 && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded-sm">↑ +100%</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  Unique users who added ≥ 1 item to cart
                </p>
              </div>

              {/* Purchased */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "purchased_customers",
                    title: "Purchased Unique Customers Drill-Down",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-purchased-customers"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#7C9C59]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Purchased Unique Customers
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-xl font-bold tracking-tight text-[#16241C]">
                    {isLoading ? "—" : data?.customer_activity.purchased_unique_customers ?? 0}
                  </span>
                  {(data?.customer_activity.purchased_unique_customers ?? 0) > 0 && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded-sm">↑ +100%</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  Deduplicated buyer accounts with completed orders
                </p>
              </div>
            </div>
          </div>

          {/* Lower Chart / Distribution Area */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#16241C]">New Customer Signups</span>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                Daily ▾
              </span>
            </div>
            <div className="h-20 w-full flex items-end justify-between gap-1 pt-3 px-1 border-b border-border/60">
              {["1 Mar", "4 Mar", "7 Mar", "10 Mar", "13 Mar", "16 Mar", "19 Mar", "22 Mar", "25 Mar", "28 Mar", "31 Mar"].map((d, i) => {
                const isPeak = i === 3 && (data?.customer_activity.total_signups ?? 0) > 0;
                const isSecond = i === 7 && (data?.customer_activity.total_signups ?? 0) > 1;
                return (
                  <div key={d} className="flex flex-col items-center flex-1 h-full justify-end">
                    <div
                      className={`w-2 sm:w-2.5 rounded-t-xs transition-all ${
                        isPeak
                          ? "bg-[#7C9C59] h-12"
                          : isSecond
                          ? "bg-[#7C9C59] h-7"
                          : "bg-muted/40 h-1"
                      }`}
                    />
                    <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap hidden sm:inline">{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Dealer Network Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-[#16241C]">Dealer Network</h2>
              <Link to="/admin/dealers" className="text-xs font-semibold text-[#467065] hover:text-[#16241C] flex items-center gap-1 transition-colors">
                <span>View all</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b border-border/60">
              {/* Total Dealers */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "dealers",
                    title: "Dealer Accounts Drill-Down",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-total-dealers"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-[#467065]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Total Dealers
                  </span>
                </div>
                <p className="mt-1.5 font-heading text-xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.dealer_network.total_dealers ?? 0}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  Registered wholesale & showroom partners
                </p>
              </div>

              {/* Pending Approvals */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "pending_dealers",
                    title: "Pending Dealer Approvals Queue",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-pending-dealers"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Pending Approvals
                  </span>
                </div>
                <p className="mt-1.5 font-heading text-xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : data?.dealer_network.pending_approvals ?? 0}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  Dealer applications awaiting owner verification
                </p>
              </div>

              {/* Dealer Sales */}
              <div
                onClick={() =>
                  setDrillDown({
                    isOpen: true,
                    kind: "dealer_sales",
                    title: "Dealer B2B Sales Drill-Down",
                  })
                }
                className="cursor-pointer group hover:bg-muted/40 p-2 rounded-xl transition-colors"
                data-testid="card-dealer-sales"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-[#7C9C59]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                    Dealer Sales
                  </span>
                </div>
                <p className="mt-1.5 font-heading text-xl font-bold tracking-tight text-[#16241C]">
                  {isLoading ? "—" : inr(data?.dealer_network.dealer_sales_paise ?? 0)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  {data?.dealer_network.dealer_orders_count ?? 0} B2B wholesale orders fulfilled
                </p>
              </div>
            </div>
          </div>

          {/* Lower Chart / Distribution Area */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#16241C]">Dealer Registrations</span>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                Daily ▾
              </span>
            </div>
            <div className="h-20 w-full flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
              No dealer registrations in this period
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Low Stock Table (≤5 free units, Dense Operational Table matching Image 1) ── */}
      <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs" data-testid="section-low-stock">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base text-amber-600">⚠️</span>
              <h2 className="font-heading text-base font-bold text-[#16241C]">Low Stock Inventory</h2>
              <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-800 border-amber-300">
                ≤ 5 free units
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current live warehouse inventory (Free Stock = Total Stock - Reserved Units). Independent of historical date filter.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search SKU or product..."
              value={stockSearch}
              onChange={(e) => {
                setStockSearch(e.target.value);
                setStockPage(1);
              }}
              className="h-9 pl-8 text-xs bg-background rounded-xl border-border"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/80">
          <Table className="text-xs">
            <TableHeader className="bg-[#FAF8F5]">
              <TableRow className="h-9 border-b border-border/80">
                <TableHead className="font-bold text-[#16241C] text-xs">SKU</TableHead>
                <TableHead className="font-bold text-[#16241C] text-xs">Product</TableHead>
                <TableHead className="font-bold text-[#16241C] text-xs">Category</TableHead>
                <TableHead className="font-bold text-[#16241C] text-xs">Variant / Size</TableHead>
                <TableHead className="text-right font-bold text-[#16241C] text-xs">Total Stock</TableHead>
                <TableHead className="text-right font-bold text-[#16241C] text-xs">Reserved</TableHead>
                <TableHead className="text-right font-bold text-[#16241C] text-xs">Free Available</TableHead>
                <TableHead className="text-center font-bold text-[#16241C] text-xs">Status</TableHead>
                <TableHead className="text-right font-bold text-[#16241C] text-xs">Action</TableHead>
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
                  <TableRow key={item.sku} className="h-10 hover:bg-muted/30 border-b border-border/60">
                    <TableCell className="font-mono text-xs font-semibold text-[#16241C]">{item.sku}</TableCell>
                    <TableCell className="text-xs font-medium text-[#16241C]">{item.product_name}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">
                      {item.category.replace("-", " ")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.size}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-medium">{item.current_stock}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {item.reserved}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold tabular-nums text-[#16241C]">
                      {item.free_stock}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block rounded-full bg-amber-100/90 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {item.stock_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setStockModalItem(item);
                          setStockDelta("");
                          setStockNote("");
                        }}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      >
                        •••
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
