import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Layers,
  Truck,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpDown,
  History,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  UserX,
  PackagePlus,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";
import type {
  InventoryItem,
  StockTransaction,
  StockDispatch,
  StockManager,
  StockPointDashboardMetrics,
} from "@/lib/types";

import AddStockModal from "./AddStockModal";
import AddManualItemModal from "./AddManualItemModal";
import AdjustStockModal from "./AdjustStockModal";
import DispatchModal from "./DispatchModal";
import DispatchDetailsModal from "./DispatchDetailsModal";

interface StockPointHubProps {
  isOwnerAdmin?: boolean;
}

export default function StockPointHub({ isOwnerAdmin = true }: StockPointHubProps) {
  const qc = useQueryClient();

  // Active view tab: "dashboard" | "inventory" | "movements" | "managers"
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "movements" | "managers">("dashboard");

  // Modals state
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<StockDispatch | null>(null);
  const [isAddManagerOpen, setIsAddManagerOpen] = useState(false);

  // New Manager Form State
  const [mgrName, setMgrName] = useState("");
  const [mgrEmail, setMgrEmail] = useState("");
  const [mgrPhone, setMgrPhone] = useState("");
  const [mgrPassword, setMgrPassword] = useState("Kotson-Stock-2026!");

  // Preselected variant for Add Stock modal
  const [preselectedVariantId, setPreselectedVariantId] = useState<string | null>(null);

  // Inventory table state
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("all");
  const [invStatus, setInvStatus] = useState("all");
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(25);

  // Movements ledger state
  const [movSearch, setMovSearch] = useState("");
  const [movPreset, setMovPreset] = useState("all");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  const [movTxType, setMovTxType] = useState("all");
  const [movDispatchType, setMovDispatchType] = useState("all");
  const [movCategory, setMovCategory] = useState("all");
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(25);

  // 1. Dashboard Query
  const { data: dashData, isLoading: dashLoading } = useQuery<{
    metrics: StockPointDashboardMetrics;
    recent_activity: StockTransaction[];
    user_role: string;
    is_owner_admin: boolean;
  }>({
    queryKey: ["stock-point-dashboard"],
    queryFn: () => apiGet("/stock-point/dashboard"),
    refetchInterval: 15000,
  });

  const metrics = dashData?.metrics;

  // 2. Inventory Query
  const { data: invData, isLoading: invLoading } = useQuery<{
    items: InventoryItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>({
    queryKey: ["stock-point-inventory", invCategory, invStatus, invSearch, invPage, invPageSize],
    queryFn: () =>
      apiGet(
        `/stock-point/inventory?category=${encodeURIComponent(invCategory)}&status=${encodeURIComponent(
          invStatus
        )}&q=${encodeURIComponent(invSearch)}&page=${invPage}&limit=${invPageSize}`
      ),
  });

  // 3. Movements Ledger Query
  const { data: movData, isLoading: movLoading } = useQuery<{
    items: StockTransaction[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>({
    queryKey: [
      "stock-point-movements",
      movPreset,
      movDateFrom,
      movDateTo,
      movTxType,
      movDispatchType,
      movCategory,
      movSearch,
      movPage,
      movPageSize,
    ],
    queryFn: () =>
      apiGet(
        `/stock-point/movements?preset=${movPreset}&date_from=${movDateFrom}&date_to=${movDateTo}&transaction_type=${movTxType}&dispatch_type=${movDispatchType}&category=${movCategory}&q=${encodeURIComponent(
          movSearch
        )}&page=${movPage}&limit=${movPageSize}`
      ),
  });

  // 4. Stock Managers Query (Owner Admin only)
  const { data: mgrsData, isLoading: mgrsLoading } = useQuery<{ managers: StockManager[] }>({
    queryKey: ["stock-point-managers"],
    queryFn: () => apiGet("/stock-point/managers"),
    enabled: isOwnerAdmin,
  });

  // Toggle Manager Active Status
  const toggleManagerMutation = useMutation({
    mutationFn: ({ uid, isActive }: { uid: string; isActive: boolean }) =>
      apiPatch(`/stock-point/managers/${uid}/status?is_active=${isActive}`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-managers"] });
      toast.success(data?.message || "Stock Manager status updated.");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  });

  // Create Stock Manager Mutation
  const createManagerMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/stock-point/managers", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-managers"] });
      toast.success(`Created Stock Manager account for ${data?.manager?.email}.`);
      setIsAddManagerOpen(false);
      setMgrName("");
      setMgrEmail("");
      setMgrPhone("");
      setMgrPassword("Kotson-Stock-2026!");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create manager account"),
  });

  // Helper to trigger Excel download
  const handleExportMovements = () => {
    const params = new URLSearchParams({
      preset: movPreset,
      date_from: movDateFrom,
      date_to: movDateTo,
      transaction_type: movTxType,
      dispatch_type: movDispatchType,
      category: movCategory,
      q: movSearch,
    });
    const movements = movData?.items || [];
    const rows = movements.map((m: any) => [
      m.id, m.variant_id, m.transaction_type, m.quantity, m.dispatch_type, m.created_at
    ]);
    exportToCsv(`stock_movements_${Date.now()}`, ["ID", "Variant ID", "Type", "Qty", "Dispatch Type", "Date"], rows);
    toast.success("Stock movements exported");
  };

  const handleExportCurrentStock = () => {
    const inventory = invData?.items || [];
    const rows = inventory.map((i: any) => [
      i.variant_id, i.product_name, i.variant_title, i.stock, i.reserved, i.category
    ]);
    exportToCsv(`current_stock_${Date.now()}`, ["Variant ID", "Product", "Variant", "Stock", "Reserved", "Category"], rows);
    toast.success("Current stock exported");
  };

  // Click on a dispatch ID in movements table
  const handleViewDispatch = async (dispatchId?: string | null) => {
    if (!dispatchId) return;
    try {
      const res = await apiGet<any>(`/stock-point/dispatches/${dispatchId}`);
      if (res?.dispatch) {
        setSelectedDispatch(res.dispatch);
      }
    } catch (e: any) {
      toast.error("Could not fetch dispatch details");
    }
  };

  // Quick filter jump from KPI cards
  const handleKpiCardClick = (target: "all" | "mattresses" | "pillows" | "toppers" | "baby-kids" | "low_stock" | "today_dispatches") => {
    if (target === "today_dispatches") {
      setMovPreset("today");
      setMovTxType("STOCK_DISPATCHED");
      setActiveTab("movements");
    } else if (target === "low_stock") {
      setInvStatus("low_stock");
      setInvCategory("all");
      setActiveTab("inventory");
    } else {
      setInvCategory(target);
      setInvStatus("all");
      setActiveTab("inventory");
    }
  };

  return (
    <div className="space-y-6" data-testid="stock-point-hub">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E3DDCF]/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#16241C]">
              STOCK POINT
            </h1>
            <Badge variant="outline" className="border-[#7C9C59]/40 bg-[#7C9C59]/10 text-[#467065] font-semibold text-xs">
              Physical Inventory &amp; Movements
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Manage warehouse inventory, manual stock receipts, multi-item dispatches, and permanent ledger movement history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsDispatchOpen(true)}
            className="h-11 px-5 rounded-2xl bg-[#16241C] hover:bg-[#25392d] text-white font-bold shadow-md gap-2"
            data-testid="pack-deliver-product-button"
          >
            <Truck className="h-4 w-4" />
            + Pack / Deliver Product
          </Button>

          {isOwnerAdmin && (
            <>
              <Button
                onClick={() => {
                  setPreselectedVariantId(null);
                  setIsAddStockOpen(true);
                }}
                className="h-11 px-5 rounded-2xl bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold shadow-md gap-2"
                data-testid="add-stock-button"
              >
                <PackagePlus className="h-4 w-4" />
                + Add Stock
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddManualOpen(true)}
                className="h-11 px-4 rounded-2xl border-border bg-white text-xs font-semibold gap-1.5 hover:bg-[#FAF8F5]"
                data-testid="add-manual-item-button"
              >
                <Layers className="h-4 w-4 text-amber-700" />
                + Add Manual Item
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={handleExportCurrentStock}
            className="h-11 px-4 rounded-2xl border-border bg-white text-xs font-semibold gap-1.5 hover:bg-[#FAF8F5]"
            data-testid="export-current-stock-button"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Export Stock (.xlsx)
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E3DDCF]/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "dashboard"
              ? "border-[#16241C] text-[#16241C]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-stock-dashboard"
        >
          Stock Point Dashboard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "inventory"
              ? "border-[#16241C] text-[#16241C]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-current-stock"
        >
          Current Stock ({invData?.total ?? "…"})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("movements")}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "movements"
              ? "border-[#16241C] text-[#16241C]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-stock-movements"
        >
          Stock Movements &amp; Dispatches ({movData?.total ?? "…"})
        </button>
        {isOwnerAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("managers")}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "managers"
                ? "border-[#16241C] text-[#16241C]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-stock-managers"
          >
            Stock Managers ({mgrsData?.managers?.length ?? "…"})
          </button>
        )}
      </div>

      {/* TAB 1: DASHBOARD METRICS CARDS */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* TOTAL STOCK */}
            <div
              onClick={() => handleKpiCardClick("all")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Total Units</span>
                <Package className="h-4 w-4 text-[#7C9C59]" />
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.total_stock_units ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">All warehouse items</div>
            </div>

            {/* MATTRESSES */}
            <div
              onClick={() => handleKpiCardClick("mattresses")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Mattresses</span>
                <span className="text-[10px] text-muted-foreground font-mono">inches</span>
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.mattresses_units ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">7-Zone &amp; Ortho</div>
            </div>

            {/* PILLOWS */}
            <div
              onClick={() => handleKpiCardClick("pillows")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Pillows</span>
                <span className="text-[10px] text-muted-foreground font-mono">cm</span>
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.pillows_units ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Standard &amp; Contour</div>
            </div>

            {/* TOPPERS */}
            <div
              onClick={() => handleKpiCardClick("toppers")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Toppers</span>
                <span className="text-[10px] text-muted-foreground font-mono">inches</span>
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.toppers_units ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Organic comfort layers</div>
            </div>

            {/* BABY + KIDS */}
            <div
              onClick={() => handleKpiCardClick("baby-kids")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Baby + Kids</span>
                <Package className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.baby_kids_units ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Crib &amp; Junior line</div>
            </div>

            {/* LOW STOCK ITEMS */}
            <div
              onClick={() => handleKpiCardClick("low_stock")}
              className={`rounded-3xl border p-4 shadow-sm hover:shadow-md cursor-pointer transition-all group ${
                (metrics?.low_stock_count ?? 0) > 0
                  ? "border-amber-300 bg-amber-50/60"
                  : "border-[#E3DDCF] bg-white hover:border-[#16241C]"
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span className={(metrics?.low_stock_count ?? 0) > 0 ? "text-amber-900" : ""}>Low Stock</span>
                <AlertTriangle
                  className={`h-4 w-4 ${
                    (metrics?.low_stock_count ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div
                className={`mt-2 font-black text-2xl font-mono ${
                  (metrics?.low_stock_count ?? 0) > 0 ? "text-amber-800" : "text-[#16241C]"
                }`}
              >
                {metrics?.low_stock_count ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Threshold ≤ 5 free units</div>
            </div>

            {/* TODAY'S DISPATCHES */}
            <div
              onClick={() => handleKpiCardClick("today_dispatches")}
              className="rounded-3xl border border-[#E3DDCF] bg-white p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-[#16241C] group"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                <span>Today's Out</span>
                <Truck className="h-4 w-4 text-[#16241C]" />
              </div>
              <div className="mt-2 font-black text-2xl font-mono text-[#16241C] group-hover:text-[#467065]">
                {metrics?.today_units_out ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {metrics?.today_dispatches_count ?? 0} package(s) today
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Activity Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Operational Highlights */}
            <div className="rounded-3xl border border-[#E3DDCF] bg-white p-6 space-y-4">
              <h3 className="font-heading text-base font-bold text-[#16241C] flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#7C9C59]" />
                Stock Point Operations
              </h3>
              <p className="text-xs text-muted-foreground">
                Every quantity modification is saved in the permanent transaction ledger. Dispatches automatically validate real-time server inventory without going negative.
              </p>

              <div className="space-y-2.5 pt-2">
                <Button
                  onClick={() => setIsDispatchOpen(true)}
                  className="w-full h-11 justify-start rounded-xl bg-[#16241C] hover:bg-[#25392d] text-white text-xs font-bold gap-2.5"
                >
                  <Truck className="h-4 w-4 text-[#7C9C59]" />
                  Pack &amp; Deliver Products
                </Button>

                {isOwnerAdmin && (
                  <>
                    <Button
                      onClick={() => setIsAddStockOpen(true)}
                      className="w-full h-11 justify-start rounded-xl bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-bold gap-2.5"
                    >
                      <PackagePlus className="h-4 w-4" />
                      Add / Receive Factory Stock
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddManualOpen(true)}
                      className="w-full h-11 justify-start rounded-xl border-border bg-white text-xs font-semibold gap-2.5"
                    >
                      <Layers className="h-4 w-4 text-amber-700" />
                      Add Manual / Sample Stock Item
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={handleExportMovements}
                  className="w-full h-11 justify-start rounded-xl border-border bg-white text-xs font-semibold gap-2.5"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  Export Stock Movements (.xlsx)
                </Button>
              </div>
            </div>

            {/* Right: Recent Ledger Activity */}
            <div className="lg:col-span-2 rounded-3xl border border-[#E3DDCF] bg-white p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-3">
                <h3 className="font-heading text-base font-bold text-[#16241C] flex items-center gap-2">
                  <History className="h-5 w-5 text-[#7C9C59]" />
                  Recent Stock Ledger Activity
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("movements")}
                  className="text-xs font-bold text-[#467065] hover:text-[#16241C] gap-1"
                >
                  View All Movements <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {dashData?.recent_activity?.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
                  No stock transactions recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                  {(dashData?.recent_activity || []).map((tx) => {
                    const isPositive = tx.quantity_change > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-border/70 bg-[#FAF8F5] text-xs hover:border-[#7C9C59]/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#16241C] text-sm">{tx.product_name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                tx.transaction_type === "STOCK_RECEIVED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : tx.transaction_type === "STOCK_DISPATCHED"
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {tx.transaction_type.replace("_", " ")}
                            </Badge>
                            {tx.dispatch_number && (
                              <button
                                type="button"
                                onClick={() => handleViewDispatch(tx.dispatch_id || tx.dispatch_number)}
                                className="font-mono text-[11px] text-blue-700 hover:underline font-bold"
                              >
                                {tx.dispatch_number}
                              </button>
                            )}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {tx.category} • Size: <span className="font-semibold text-foreground">{tx.variant_size}</span> ({tx.unit}) • By:{" "}
                            <span className="font-semibold text-foreground">{tx.created_by_name}</span>
                          </div>
                          {tx.remarks && <div className="text-[11px] text-foreground/80 italic">{tx.remarks}</div>}
                        </div>

                        <div className="text-right pl-3">
                          <div
                            className={`font-mono text-base font-black ${
                              isPositive ? "text-[#467065]" : "text-red-600"
                            }`}
                          >
                            {isPositive ? `+${tx.quantity_change}` : tx.quantity_change}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {tx.previous_quantity} → {tx.new_quantity}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{tx.formatted_datetime}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CURRENT STOCK TABLE */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          {/* Controls Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl border border-[#E3DDCF] bg-white">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search product, SKU, size, category…"
                  value={invSearch}
                  onChange={(e) => {
                    setInvSearch(e.target.value);
                    setInvPage(1);
                  }}
                  className="pl-10 h-11 rounded-2xl bg-[#FAF8F5] border-border/80 text-xs"
                  data-testid="stock-inventory-search"
                />
              </div>

              {/* Category Filter */}
              <select
                value={invCategory}
                onChange={(e) => {
                  setInvCategory(e.target.value);
                  setInvPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold text-foreground"
                data-testid="stock-category-filter"
              >
                <option value="all">All Categories</option>
                <option value="mattresses">Mattresses (in)</option>
                <option value="pillows">Pillows (cm)</option>
                <option value="toppers">Toppers (in)</option>
                <option value="baby-kids">Baby + Kids</option>
                <option value="manual">Manual Items</option>
              </select>

              {/* Status Filter */}
              <select
                value={invStatus}
                onChange={(e) => {
                  setInvStatus(e.target.value);
                  setInvPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold text-foreground"
                data-testid="stock-status-filter"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock (&gt; 5)</option>
                <option value="low_stock">Low Stock (≤ 5)</option>
                <option value="out_of_stock">Out of Stock (0)</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCurrentStock}
              className="h-11 px-4 rounded-2xl border-[#7C9C59]/40 bg-white hover:bg-[#7C9C59]/10 text-xs font-bold text-[#467065] gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Stock (.xlsx)
            </Button>
          </div>

          {/* Current Stock Table */}
          <div className="rounded-3xl border border-[#E3DDCF] bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF8F5] border-b border-[#E3DDCF]">
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Product</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Category</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Size / Variant</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C] text-right">Available Qty</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Last Updated</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      Loading current inventory…
                    </TableCell>
                  </TableRow>
                ) : (invData?.items?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      No inventory records match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  (invData?.items || []).map((item) => {
                    const isLow = item.available_quantity <= 5 && item.available_quantity > 0;
                    const isOut = item.available_quantity <= 0;
                    return (
                      <TableRow key={item.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <TableCell>
                          <div className="font-bold text-sm text-[#16241C]">{item.product_name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-semibold">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-semibold text-foreground">{item.size}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-mono">Unit: {item.unit}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono text-base font-black ${isOut ? "text-red-600" : isLow ? "text-amber-700" : "text-[#16241C]"}`}>
                            {item.available_quantity}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1">{item.unit}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isOut
                                ? "bg-red-50 text-red-700 border-red-200"
                                : isLow
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {item.stock_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.last_updated}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOwnerAdmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => setAdjustItem(item)}
                                  className="h-8 text-[11px] font-semibold hover:border-amber-500 hover:text-amber-800"
                                  data-testid={`adjust-stock-${item.id}`}
                                >
                                  Adjust
                                </Button>
                                {item.item_type === "CATALOG_VARIANT" && (
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => {
                                      setPreselectedVariantId(item.variant_id ?? null);
                                      setIsAddStockOpen(true);
                                    }}
                                    className="h-8 text-[11px] font-semibold hover:border-[#7C9C59] hover:text-[#467065]"
                                  >
                                    + Add Stock
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setMovSearch(item.product_name);
                                setActiveTab("movements");
                              }}
                              className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {invData && invData.total > 0 && (
              <div className="border-t border-[#E3DDCF]/80 p-4 bg-[#FAF8F5]">
                <DataTablePagination
                  currentPage={invPage}
                  pageSize={invPageSize}
                  totalItems={invData.total}
                  onPageChange={setInvPage}
                  onPageSizeChange={(sz) => {
                    setInvPageSize(sz);
                    setInvPage(1);
                  }}
                  pageSizeOptions={[25, 50, 100]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS & DISPATCHES */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-3xl border border-[#E3DDCF] bg-white space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search product, dispatch #, order #, remarks, user…"
                  value={movSearch}
                  onChange={(e) => {
                    setMovSearch(e.target.value);
                    setMovPage(1);
                  }}
                  className="pl-10 h-11 rounded-2xl bg-[#FAF8F5] border-border/80 text-xs"
                  data-testid="movements-search-input"
                />
              </div>

              {/* Date Preset */}
              <select
                value={movPreset}
                onChange={(e) => {
                  setMovPreset(e.target.value);
                  setMovPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold"
                data-testid="movements-date-preset"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {/* Transaction Type */}
              <select
                value={movTxType}
                onChange={(e) => {
                  setMovTxType(e.target.value);
                  setMovPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold"
                data-testid="movements-tx-type"
              >
                <option value="all">All Transaction Types</option>
                <option value="STOCK_RECEIVED">Stock Received (+)</option>
                <option value="STOCK_DISPATCHED">Stock Dispatched (-)</option>
                <option value="STOCK_ADJUSTMENT">Stock Adjustment (±)</option>
              </select>

              {/* Dispatch Type */}
              <select
                value={movDispatchType}
                onChange={(e) => {
                  setMovDispatchType(e.target.value);
                  setMovPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold"
                data-testid="movements-dispatch-type"
              >
                <option value="all">All Dispatch Types</option>
                <option value="ONLINE_ORDER">Online Order</option>
                <option value="OFFLINE_ORDER">Offline Order</option>
                <option value="DEALER">Dealer</option>
                <option value="FRIENDS_INTERNAL">Friends / Internal</option>
                <option value="OTHER">Other Reason</option>
              </select>

              {/* Category */}
              <select
                value={movCategory}
                onChange={(e) => {
                  setMovCategory(e.target.value);
                  setMovPage(1);
                }}
                className="h-11 px-3 rounded-2xl border border-border/80 bg-[#FAF8F5] text-xs font-semibold"
              >
                <option value="all">All Categories</option>
                <option value="mattresses">Mattresses</option>
                <option value="pillows">Pillows</option>
                <option value="toppers">Toppers</option>
                <option value="baby-kids">Baby + Kids</option>
                <option value="manual">Manual Items</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMovements}
                className="h-11 px-4 rounded-2xl border-[#7C9C59]/40 bg-white hover:bg-[#7C9C59]/10 text-xs font-bold text-[#467065] gap-1.5 ml-auto"
                data-testid="export-movements-button"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export Ledger (.xlsx)
              </Button>
            </div>

            {/* Custom Date Inputs if custom selected */}
            {movPreset === "custom" && (
              <div className="flex items-center gap-3 pt-2 border-t border-border/60 text-xs">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">From Date</Label>
                  <Input
                    type="date"
                    value={movDateFrom}
                    onChange={(e) => {
                      setMovDateFrom(e.target.value);
                      setMovPage(1);
                    }}
                    className="h-9 mt-1 bg-[#FAF8F5]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">To Date</Label>
                  <Input
                    type="date"
                    value={movDateTo}
                    onChange={(e) => {
                      setMovDateTo(e.target.value);
                      setMovPage(1);
                    }}
                    className="h-9 mt-1 bg-[#FAF8F5]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Movements Ledger Table */}
          <div className="rounded-3xl border border-[#E3DDCF] bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF8F5] border-b border-[#E3DDCF]">
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Date &amp; Time (IST)</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Dispatch / Tx ID</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Type</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Product</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Size / Unit</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C] text-right">Change</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C] text-right">Prev → New</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Reference / Remarks</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      Loading stock movements ledger…
                    </TableCell>
                  </TableRow>
                ) : (movData?.items?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      No stock movement ledger records match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  (movData?.items || []).map((tx) => {
                    const isPositive = tx.quantity_change > 0;
                    return (
                      <TableRow key={tx.id} className="hover:bg-[#FAF8F5]/80 transition-colors text-xs">
                        <TableCell>
                          <div className="font-semibold text-foreground">{tx.formatted_date}</div>
                          <div className="text-[11px] text-muted-foreground">{tx.formatted_time}</div>
                        </TableCell>
                        <TableCell>
                          {tx.dispatch_number ? (
                            <button
                              type="button"
                              onClick={() => handleViewDispatch(tx.dispatch_id || tx.dispatch_number)}
                              className="font-mono font-bold text-blue-700 hover:underline flex items-center gap-1"
                              title="Click to view full dispatch package details"
                            >
                              <span>{tx.dispatch_number}</span>
                              <Eye className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {tx.id.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              tx.transaction_type === "STOCK_RECEIVED"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : tx.transaction_type === "STOCK_DISPATCHED"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {tx.transaction_type.replace("_", " ")}
                          </Badge>
                          {tx.dispatch_type && (
                            <div className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wider">
                              {tx.dispatch_type.replace("_", " ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-[#16241C]">{tx.product_name}</div>
                          <div className="text-[11px] text-muted-foreground">{tx.category}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{tx.variant_size}</span>{" "}
                          <span className="text-[10px] text-muted-foreground font-mono">({tx.unit})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-mono text-sm font-black ${
                              isPositive ? "text-[#467065]" : "text-red-600"
                            }`}
                          >
                            {isPositive ? `+${tx.quantity_change}` : tx.quantity_change}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span className="text-muted-foreground">{tx.previous_quantity}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-black text-[#16241C]">{tx.new_quantity}</span>
                        </TableCell>
                        <TableCell>
                          {tx.reference_number && (
                            <div className="font-mono text-[11px] font-semibold text-foreground">
                              Ref: {tx.reference_number}
                            </div>
                          )}
                          <div className="text-muted-foreground text-[11px] italic max-w-xs truncate">
                            {tx.remarks || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">{tx.created_by_name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{tx.created_by_role}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {movData && movData.total > 0 && (
              <div className="border-t border-[#E3DDCF]/80 p-4 bg-[#FAF8F5]">
                <DataTablePagination
                  currentPage={movPage}
                  pageSize={movPageSize}
                  totalItems={movData.total}
                  onPageChange={setMovPage}
                  onPageSizeChange={(sz) => {
                    setMovPageSize(sz);
                    setMovPage(1);
                  }}
                  pageSizeOptions={[25, 50, 100]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STOCK MANAGERS ADMINISTRATION (OWNER ADMIN ONLY) */}
      {isOwnerAdmin && activeTab === "managers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-3xl border border-[#E3DDCF] bg-white">
            <div>
              <h3 className="font-heading text-base font-bold text-[#16241C]">
                Stock Point Managers &amp; Operators
              </h3>
              <p className="text-xs text-muted-foreground">
                Stock Point Managers have restricted access: they can pack and dispatch stock, view inventory, and view history, but cannot alter prices, edit website, access CRM, or delete history.
              </p>
            </div>
            <Button
              onClick={() => setIsAddManagerOpen(true)}
              className="h-11 px-5 rounded-2xl bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold shadow-md gap-2"
              data-testid="add-stock-manager-button"
            >
              <Users className="h-4 w-4" />
              + Add Stock Manager
            </Button>
          </div>

          <div className="rounded-3xl border border-[#E3DDCF] bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF8F5] border-b border-[#E3DDCF]">
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Name</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Email / Login</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Mobile</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C]">Created Date</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-[#16241C] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mgrsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      Loading Stock Managers…
                    </TableCell>
                  </TableRow>
                ) : (mgrsData?.managers?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      No Stock Point Managers created yet. Use "+ Add Stock Manager" to create operator accounts.
                    </TableCell>
                  </TableRow>
                ) : (
                  (mgrsData?.managers || []).map((m) => (
                    <TableRow key={m.id} className="hover:bg-[#FAF8F5]/80 transition-colors text-xs">
                      <TableCell className="font-bold text-[#16241C]">{m.name}</TableCell>
                      <TableCell className="font-mono">{m.email}</TableCell>
                      <TableCell className="font-mono">{m.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            m.is_active
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {m.is_active ? "Active" : "Deactivated"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.created_at_formatted}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            toggleManagerMutation.mutate({
                              uid: m.id,
                              isActive: !m.is_active,
                            })
                          }
                          className={`h-8 text-[11px] font-bold ${
                            m.is_active
                              ? "hover:border-red-400 hover:text-red-700"
                              : "hover:border-emerald-500 hover:text-emerald-700"
                          }`}
                        >
                          {m.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AddStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        preselectedVariantId={preselectedVariantId}
      />

      <AddManualItemModal
        isOpen={isAddManualOpen}
        onClose={() => setIsAddManualOpen(false)}
      />

      <AdjustStockModal
        isOpen={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        item={adjustItem}
      />

      <DispatchModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        onSuccessDispatch={(d) => {
          setSelectedDispatch(d);
        }}
      />

      <DispatchDetailsModal
        isOpen={!!selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
        dispatch={selectedDispatch}
      />

      {/* Add Stock Manager Modal */}
      {isAddManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]">
            <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#7C9C59]" />
                <h2 className="font-heading text-lg font-bold">Add Stock Point Manager</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddManagerOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-[#E3DDCF]/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createManagerMutation.mutate({
                  name: mgrName,
                  email: mgrEmail,
                  phone: mgrPhone,
                  password: mgrPassword,
                });
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manager Full Name *
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={mgrName}
                  onChange={(e) => setMgrName(e.target.value)}
                  required
                  className="mt-1 h-10 bg-white"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  placeholder="e.g. ramesh.stock@kotsonmattress.com"
                  value={mgrEmail}
                  onChange={(e) => setMgrEmail(e.target.value)}
                  required
                  className="mt-1 h-10 bg-white"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mobile Number *
                </Label>
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mgrPhone}
                  onChange={(e) => setMgrPhone(e.target.value)}
                  required
                  className="mt-1 h-10 bg-white"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Initial Password *
                </Label>
                <Input
                  type="password"
                  value={mgrPassword}
                  onChange={(e) => setMgrPassword(e.target.value)}
                  required
                  className="mt-1 h-10 bg-white"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Default: Kotson-Stock-2026! (Staff can change password upon login)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DDCF]/80">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddManagerOpen(false)}
                  className="rounded-xl h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createManagerMutation.isPending || !mgrName || !mgrEmail}
                  className="rounded-xl h-10 px-5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold"
                >
                  {createManagerMutation.isPending ? "Creating Account…" : "Create Manager"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
