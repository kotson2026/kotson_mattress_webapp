import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { inr, fmtDate, fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  RotateCcw,
  Ban,
  Building2,
  Calendar,
  Filter,
  Download,
  BarChart3,
  Layers,
  MapPin,
  Store,
  RefreshCw,
} from "lucide-react";
import type { SalesSummaryResponse } from "@/lib/types";

interface CascadeLocation {
  states: string[];
  districts: Record<string, string[]>;
  cities: Record<string, string[]>;
}

export default function SalesRevenueDashboard() {
  // Filters
  const [preset, setPreset] = useState<string>("month");
  const [buyerType, setBuyerType] = useState<string>("ALL");
  const [salesSource, setSalesSource] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Trend toggle: "revenue" vs "orders"
  const [trendMetric, setTrendMetric] = useState<"revenue" | "orders">("revenue");

  // Recent transactions table pagination
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(10);

  // Locations cascade
  const { data: locations } = useQuery<CascadeLocation>({
    queryKey: ["admin-locations-cascade"],
    queryFn: () => apiGet<CascadeLocation>("/admin/locations/cascade"),
  });

  const queryParams = new URLSearchParams({
    preset,
    buyer_type: buyerType,
    sales_source: salesSource,
    category,
    state: selectedState,
    district: selectedDistrict,
    ...(preset === "custom" && customFrom ? { date_from: customFrom } : {}),
    ...(preset === "custom" && customTo ? { date_to: customTo } : {}),
  }).toString();

  const { data, isLoading, isFetching, refetch } = useQuery<SalesSummaryResponse>({
    queryKey: [
      "admin-sales-summary-phase2",
      preset,
      buyerType,
      salesSource,
      category,
      selectedState,
      selectedDistrict,
      customFrom,
      customTo,
    ],
    queryFn: () => apiGet<SalesSummaryResponse>(`/admin/sales/summary?${queryParams}`),
  });

  const k1 = data?.kpi_row_1;
  const k2 = data?.kpi_row_2;

  const presets = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "Last 7 Days" },
    { id: "month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "custom", label: "Custom Range" },
  ];

  const handleExportCSV = () => {
    const exportUrl = `${window.location.origin}/api/admin/sales/export?${queryParams}`;
    window.open(exportUrl, "_blank");
    toast.success("Sales report CSV export triggered");
  };

  const paginatedTransactions = useMemo(() => {
    const list = data?.recent_transactions || [];
    const start = (txPage - 1) * txPageSize;
    return list.slice(start, start + txPageSize);
  }, [data?.recent_transactions, txPage, txPageSize]);

  // Max value in trend for scaling bars
  const maxTrendVal = useMemo(() => {
    const list = data?.trend || [];
    if (!list.length) return 1;
    return Math.max(
      ...list.map((t) => (trendMetric === "revenue" ? t.revenue_paise : t.orders)),
      1
    );
  }, [data?.trend, trendMetric]);

  const availableDistricts = useMemo(() => {
    if (!locations || selectedState === "ALL") return [];
    return locations.districts[selectedState] || [];
  }, [locations, selectedState]);

  return (
    <div className="space-y-8" data-testid="sales-revenue-dashboard">
      {/* Top Header & Export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Sales & Revenue Intelligence</h2>
          <p className="text-xs text-muted-foreground">
            Multi-channel revenue reporting, customer vs dealer breakdown, and trend analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 text-xs"
            data-testid="sales-export-btn"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
        {/* Date presets */}
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

        {/* Custom date range inputs */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs">
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
              Apply
            </Button>
          </div>
        )}

        {/* Multi-dimension dropdown filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 border-t border-border/80 pt-3 text-xs">
          {/* Buyer Type */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Buyer Type</Label>
            <select
              value={buyerType}
              onChange={(e) => setBuyerType(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="ALL">All Buyers</option>
              <option value="CUSTOMER">Retail Customers</option>
              <option value="DEALER">Dealers (B2B)</option>
            </select>
          </div>

          {/* Sales Source */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Sales Source</Label>
            <select
              value={salesSource}
              onChange={(e) => setSalesSource(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="ALL">All Sources</option>
              <option value="DIRECT_WEBSITE">Direct Website</option>
              <option value="WEB_REFERRAL">Website + Referral</option>
              <option value="DEALER">Dealer Counter</option>
              <option value="EMPLOYEE_ASSISTED">Employee Assisted</option>
              <option value="WALK_IN">Store Walk-in</option>
              <option value="PHONE_ORDER">Phone Order</option>
              <option value="MANUAL">Manual / Other</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="mattresses">Mattresses</option>
              <option value="pillows">Pillows</option>
              <option value="toppers">Toppers</option>
              <option value="baby-kids">Baby + Kids</option>
            </select>
          </div>

          {/* State */}
          <div>
            <Label className="text-[11px] text-muted-foreground">State</Label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("ALL");
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="ALL">All States</option>
              {(locations?.states || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <Label className="text-[11px] text-muted-foreground">District</Label>
            <select
              disabled={selectedState === "ALL"}
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs disabled:opacity-50"
            >
              <option value="ALL">All Districts</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI ROW 1: Core Financials (6 cards) */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Core Financial Performance (Row 1)
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {/* Net Revenue */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Net Revenue
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-brand-deep">
              {isLoading ? "—" : inr(k1?.net_revenue_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gross - Disc - Refunds</p>
          </div>

          {/* Gross Sales */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Gross Sales
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(k1?.gross_sales_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Before deductions</p>
          </div>

          {/* Paid Orders */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Paid Orders
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : k1?.paid_orders ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {k1?.retail_orders ?? 0} ret · {k1?.dealer_orders ?? 0} dlr · {k1?.walkin_orders ?? 0} store
            </p>
          </div>

          {/* Average Order Value */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Average Order Value
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(k1?.aov_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Per verified paid order</p>
          </div>

          {/* Dealer Sales */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dealer Sales
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(k1?.dealer_sales_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">B2B wholesale volume</p>
          </div>

          {/* Retail Sales */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Retail Sales
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(k1?.retail_sales_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Direct consumer sales</p>
          </div>
        </div>
      </section>

      {/* KPI ROW 2: Operational Health & Exceptions (6 cards) */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Operations, Exceptions & Pipeline (Row 2)
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {/* New Registrations */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              New Registrations
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : k2?.new_registrations ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Accounts registered</p>
          </div>

          {/* Refunds & Reversals */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Refunds & Reversals
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-destructive">
              {isLoading ? "—" : inr(k2?.refunds_reversals_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Admin-approved returns</p>
          </div>

          {/* Cancelled Orders */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cancelled Orders
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-muted-foreground">
              {isLoading ? "—" : k2?.cancelled_orders ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Voided before dispatch</p>
          </div>

          {/* Failed Payments */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Failed Payments
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-amber-600">
              {isLoading ? "—" : k2?.failed_payments ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gateway drops / retries</p>
          </div>

          {/* Total Dealer Volume */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dealer Units Volume
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : k2?.total_dealer_volume ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Wholesale items shipped</p>
          </div>

          {/* Manual Walk-in Sales */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Store / Walk-in Sales
            </span>
            <p className="mt-2 font-heading text-xl font-extrabold text-foreground">
              {isLoading ? "—" : inr(k2?.manual_walkin_sales_paise ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Physical store revenue</p>
          </div>
        </div>
      </section>

      {/* REVENUE TREND TIME SERIES */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-leaf" />
            <h3 className="font-heading text-base font-bold text-foreground">Revenue Trend Over Time</h3>
          </div>

          {/* Toggle between Revenue (₹) and Orders */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setTrendMetric("revenue")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                trendMetric === "revenue"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Revenue (₹)
            </button>
            <button
              onClick={() => setTrendMetric("orders")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                trendMetric === "orders"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Orders Count
            </button>
          </div>
        </div>

        {/* Visual Trend Bars */}
        <div className="pt-2">
          {(data?.trend || []).length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">
              No transaction trend data in this period.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-44 overflow-x-auto pb-4 pt-2">
              {data?.trend.map((t, idx) => {
                const val = trendMetric === "revenue" ? t.revenue_paise : t.orders;
                const heightPercent = Math.max(8, Math.round((val / maxTrendVal) * 100));

                return (
                  <div
                    key={idx}
                    className="group relative flex flex-1 flex-col items-center gap-1.5 min-w-[32px] h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-9 z-10 hidden rounded bg-popover px-2 py-1 text-[10px] font-mono shadow-md group-hover:block whitespace-nowrap border border-border">
                      {trendMetric === "revenue" ? inr(t.revenue_paise) : `${t.orders} orders`}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        val > 0
                          ? "bg-brand-leaf/80 group-hover:bg-brand-deep"
                          : "bg-muted/40"
                      }`}
                    />

                    {/* Label */}
                    <span className="text-[10px] text-muted-foreground truncate max-w-[48px] text-center font-mono">
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* BREAKDOWNS: 3 Columns Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Breakdown 1: Sales by Source */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <h4 className="font-heading text-sm font-bold flex items-center gap-2">
            <Store className="h-4 w-4 text-brand-deep" /> Sales By Source
          </h4>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-center text-xs">Orders</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.by_source || []).map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs font-medium">{s.source}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{s.orders}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold tabular-nums">
                      {inr(s.revenue_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Breakdown 2: Sales by Category */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <h4 className="font-heading text-sm font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-leaf" /> Sales By Category
          </h4>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-center text-xs">Units</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.by_category || []).map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs capitalize font-medium">
                      {c.category.replace("-", " ")}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{c.units}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold tabular-nums">
                      {inr(c.revenue_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Breakdown 3: Sales by Location */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <h4 className="font-heading text-sm font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-deep" /> Top Delivery Locations
          </h4>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-center text-xs">Orders</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.by_location || []).slice(0, 6).map((l, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs">
                      <p className="font-medium text-foreground">{l.state}</p>
                      {l.district && (
                        <p className="text-[10px] text-muted-foreground">{l.district}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{l.orders}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold tabular-nums">
                      {inr(l.revenue_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS TABLE */}
      <section className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">Recent Completed Orders</h3>
            <p className="text-xs text-muted-foreground">
              Latest transactions matching current filters ({data?.recent_transactions?.length || 0} total)
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Order #</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Buyer</TableHead>
                <TableHead className="text-xs">Type & Channel</TableHead>
                <TableHead className="text-right text-xs">Amount</TableHead>
                <TableHead className="text-center text-xs">Payment</TableHead>
                <TableHead className="text-center text-xs">Fulfilment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    No transactions match current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((tx: any) => (
                  <TableRow key={tx.id || tx.order_number} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">{tx.order_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(tx.created_at)}</TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium text-foreground">{tx.customer_name || tx.email}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {tx.buyer_type || "CUSTOMER"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold tabular-nums">
                      {inr(tx.amount_paise)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={tx.payment_status === "paid" ? "default" : "outline"}
                        className="text-[10px] uppercase font-mono"
                      >
                        {tx.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {(tx.fulfilment_status || "processing").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {(data?.recent_transactions?.length || 0) > 10 && (
            <div className="border-t border-border p-3">
              <DataTablePagination
                currentPage={txPage}
                pageSize={txPageSize}
                totalItems={data?.recent_transactions?.length || 0}
                onPageChange={setTxPage}
                onPageSizeChange={(newSize) => {
                  setTxPageSize(newSize);
                  setTxPage(1);
                }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
