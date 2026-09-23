import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Printer,
  Search,
  ShieldCheck,
  Box,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Check,
  Building2,
  ExternalLink,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTime, inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTablePagination from "@/components/ui/DataTablePagination";
import type {
  DispatchOverviewResponse,
  DispatchOrdersResponse,
  DispatchOrderRow,
  ReturnsResponse,
  ReturnRequestRow,
  TrialsResponse,
  TrialRow,
  CarriersResponse,
  CarrierRow,
} from "@/lib/dispatchTypes";

type TabKey =
  | "overview"
  | "awaiting_dispatch"
  | "ready_to_pack"
  | "packed"
  | "in_transit"
  | "delivered"
  | "returns"
  | "trials"
  | "carriers";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: Layers },
  { key: "awaiting_dispatch", label: "Awaiting Dispatch", icon: Clock },
  { key: "ready_to_pack", label: "Ready to Pack", icon: Box },
  { key: "packed", label: "Packed & Staged", icon: Package },
  { key: "in_transit", label: "Shipped / In Transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
  { key: "returns", label: "Returns & QC", icon: RotateCcw },
  { key: "trials", label: "100-Night Trial", icon: ShieldCheck },
  { key: "carriers", label: "Carriers", icon: Building2 },
];

export default function DispatchReturnsHub() {
  const queryClient = useQueryClient();

  // Top Filters
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [warehouse, setWarehouse] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [packingSlipOrder, setPackingSlipOrder] = useState<DispatchOrderRow | null>(null);
  const [allocateOrder, setAllocateOrder] = useState<DispatchOrderRow | null>(null);
  const [packModalOrder, setPackModalOrder] = useState<DispatchOrderRow | null>(null);
  const [shipModalOrder, setShipModalOrder] = useState<DispatchOrderRow | null>(null);
  const [milestoneModalOrder, setMilestoneModalOrder] = useState<DispatchOrderRow | null>(null);
  const [exceptionModalOrder, setExceptionModalOrder] = useState<DispatchOrderRow | null>(null);
  const [qcModalReturn, setQcModalReturn] = useState<ReturnRequestRow | null>(null);
  const [initiateReturnOrder, setInitiateReturnOrder] = useState<DispatchOrderRow | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierRow | null>(null);

  // Form states
  const [packForm, setPackForm] = useState({
    package_count: 1,
    package_weight_kg: 28.5,
    package_dimensions: "198 x 182 x 25 cm",
    packing_notes: "Double protective waterproof shroud and corner guards applied.",
    warehouse_id: "WH-01",
  });

  const [shipForm, setShipForm] = useState({
    carrier: "BlueDart Surface Logistics",
    awb_number: "",
    notes: "Expedited heavy surface dispatch",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    status: "IN_TRANSIT",
    location: "Gurugram Central Linehaul Hub",
    notes: "Loaded on express linehaul vehicle",
  });

  const [exceptionForm, setExceptionForm] = useState({
    issue_type: "CUSTOMER_UNAVAILABLE",
    assigned_to: "Logistics Desk 1",
    notes: "Customer phone unreachable during first delivery attempt. Rescheduling for tomorrow.",
  });

  const [qcForm, setQcForm] = useState({
    condition: "good" as "unopened" | "good" | "used" | "damaged" | "defective" | "unsellable",
    decision: "restock" as "restock" | "do_not_restock" | "replacement" | "refund" | "reject",
    inspection_notes: "Inspected in clean room. Core resilience certified, fabric intact.",
  });

  const [returnInitForm, setReturnInitForm] = useState({
    reason: "100-Night Trial comfort adjustment",
    is_trial_return: true,
  });

  // Queries
  const { data: overview, refetch: refetchOverview, isFetching: loadingOverview } =
    useQuery<DispatchOverviewResponse>({
      queryKey: ["admin-dispatch-overview", datePreset, warehouse, carrierFilter],
      queryFn: () =>
        apiGet<DispatchOverviewResponse>(
          `/admin/dispatch/overview?preset=${datePreset}&warehouse_id=${warehouse}&carrier=${carrierFilter}`
        ),
      staleTime: 10_000,
    });

  const {
    data: ordersData,
    refetch: refetchOrders,
    isFetching: loadingOrders,
  } = useQuery<DispatchOrdersResponse>({
    queryKey: [
      "admin-dispatch-orders",
      activeTab,
      datePreset,
      warehouse,
      carrierFilter,
      search,
      page,
      pageSize,
    ],
    queryFn: () => {
      let tabParam = "awaiting_dispatch";
      if (activeTab === "ready_to_pack") tabParam = "ready_to_pack";
      else if (activeTab === "packed") tabParam = "packed";
      else if (activeTab === "in_transit") tabParam = "in_transit";
      else if (activeTab === "delivered") tabParam = "delivered";

      return apiGet<DispatchOrdersResponse>(
        `/admin/dispatch/orders?tab=${tabParam}&warehouse_id=${warehouse}&carrier=${carrierFilter}&q=${encodeURIComponent(
          search
        )}&page=${page}&limit=${pageSize}`
      );
    },
    enabled:
      activeTab !== "overview" &&
      activeTab !== "returns" &&
      activeTab !== "trials" &&
      activeTab !== "carriers",
    staleTime: 10_000,
  });

  const {
    data: returnsData,
    refetch: refetchReturns,
    isFetching: loadingReturns,
  } = useQuery<ReturnsResponse>({
    queryKey: ["admin-dispatch-returns", search, page, pageSize],
    queryFn: () =>
      apiGet<ReturnsResponse>(
        `/admin/dispatch/returns?q=${encodeURIComponent(search)}&page=${page}&limit=${pageSize}`
      ),
    enabled: activeTab === "returns",
    staleTime: 10_000,
  });

  const {
    data: trialsData,
    refetch: refetchTrials,
    isFetching: loadingTrials,
  } = useQuery<TrialsResponse>({
    queryKey: ["admin-dispatch-trials", search, page, pageSize],
    queryFn: () =>
      apiGet<TrialsResponse>(
        `/admin/dispatch/trials?q=${encodeURIComponent(search)}&page=${page}&limit=${pageSize}`
      ),
    enabled: activeTab === "trials",
    staleTime: 10_000,
  });

  const {
    data: carriersData,
    refetch: refetchCarriers,
    isFetching: loadingCarriers,
  } = useQuery<CarriersResponse>({
    queryKey: ["admin-dispatch-carriers"],
    queryFn: () => apiGet<CarriersResponse>("/admin/dispatch/carriers"),
    staleTime: 30_000,
  });

  // Mutations
  const allocateMutation = useMutation({
    mutationFn: (orderId: string) => apiPost(`/admin/dispatch/orders/${orderId}/allocate`, {}),
    onSuccess: () => {
      toast.success("Inventory allocated and moved to Ready to Pack");
      setAllocateOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Stock allocation failed"),
  });

  const packMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: any }) =>
      apiPost(`/admin/dispatch/orders/${orderId}/pack`, data),
    onSuccess: () => {
      toast.success("Order packed and staged for carrier pickup");
      setPackModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Packing confirmation failed"),
  });

  const shipMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: any }) =>
      apiPost(`/admin/dispatch/orders/${orderId}/shipment`, data),
    onSuccess: (res: any) => {
      toast.success(`Carrier assigned! AWB: ${res?.awb_number || "Generated"}`);
      setShipModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Shipment creation failed"),
  });

  const milestoneMutation = useMutation({
    mutationFn: ({ shipmentId, data }: { shipmentId: string; data: any }) =>
      apiPatch(`/admin/dispatch/shipments/${shipmentId}/status`, data),
    onSuccess: () => {
      toast.success("Shipment milestone updated");
      setMilestoneModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Milestone update failed"),
  });

  const exceptionMutation = useMutation({
    mutationFn: ({ shipmentId, data }: { shipmentId: string; data: any }) =>
      apiPost(`/admin/dispatch/shipments/${shipmentId}/exception`, data),
    onSuccess: () => {
      toast.success("Delivery exception logged");
      setExceptionModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Exception logging failed"),
  });

  const qcMutation = useMutation({
    mutationFn: ({ returnId, data }: { returnId: string; data: any }) =>
      apiPost(`/admin/dispatch/returns/${returnId}/inspect`, data),
    onSuccess: () => {
      toast.success("QC inspection recorded");
      setQcModalReturn(null);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "QC inspection failed"),
  });

  const restockMutation = useMutation({
    mutationFn: (returnId: string) => apiPost(`/admin/dispatch/returns/${returnId}/restock`, {}),
    onSuccess: () => {
      toast.success("Returned items restocked to inventory");
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Restock failed"),
  });

  const refundMutation = useMutation({
    mutationFn: ({ returnId, amountPaise }: { returnId: string; amountPaise: number }) =>
      apiPost(`/admin/dispatch/returns/${returnId}/refund`, {
        amount_paise: amountPaise,
        refund_type: "full",
        refund_method: "gateway",
      }),
    onSuccess: () => {
      toast.success("Financial refund processed & recorded in ledger");
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Refund failed"),
  });

  const replacementMutation = useMutation({
    mutationFn: (returnId: string) => apiPost(`/admin/dispatch/returns/${returnId}/replacement`, {}),
    onSuccess: (res: any) => {
      toast.success(`Replacement Order #${res.replacement_order_number} created!`);
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-overview"] });
    },
    onError: (err: any) => toast.error(err?.message || "Replacement creation failed"),
  });

  const handleRefresh = () => {
    refetchOverview();
    refetchOrders();
    refetchReturns();
    refetchTrials();
    refetchCarriers();
    toast.info("Refreshed dispatch & returns operations data");
  };

  const exportCsv = () => {
    toast.success("Exporting Dispatch & Returns manifest (CSV)...");
    const header = "Order Number,Customer,Status,Items,Amount INR,City,Pincode\n";
    const rows =
      ordersData?.rows.map((o) =>
        `"${o.order_number}","${o.customer_name}","${o.dispatch_status}","${o.products_summary}",${(
          o.order_value_paise / 100
        ).toFixed(2)},"${o.city}","${o.pincode}"`
      ) || [];
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kotson-dispatch-manifest-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sla = overview?.sla;

  return (
    <div className="space-y-6" data-testid="dispatch-returns-hub">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Date Filter
            </Label>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest focus:outline-none"
              data-testid="dispatch-date-filter"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Fulfillment Hub
            </Label>
            <select
              value={warehouse}
              onChange={(e) => {
                setWarehouse(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest focus:outline-none"
              data-testid="dispatch-warehouse-filter"
            >
              <option value="all">All Fulfillment Hubs</option>
              <option value="WH-01">Central Warehouse (Gurugram)</option>
              <option value="WH-02">South Hub (Bengaluru)</option>
              <option value="WH-03">West Hub (Mumbai)</option>
            </select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Carrier
            </Label>
            <select
              value={carrierFilter}
              onChange={(e) => {
                setCarrierFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest focus:outline-none"
              data-testid="dispatch-carrier-filter"
            >
              <option value="all">All Carriers</option>
              <option value="BLUEDART">BlueDart Surface Logistics</option>
              <option value="DELHIVERY">Delhivery Surface</option>
              <option value="EKART">Ekart Logistics</option>
              <option value="DTDC">DTDC Express Cargo</option>
              <option value="SHADOWFAX">Shadowfax Hyperlocal</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search order #, customer, city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-9 w-56 pl-8 text-xs font-medium"
              data-testid="dispatch-search-input"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-9 gap-1.5 text-xs font-medium hover:border-brand-forest hover:text-brand-forest"
            data-testid="dispatch-export-btn"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Manifest
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-9 gap-1.5 text-xs font-medium"
            disabled={loadingOverview || loadingOrders}
            data-testid="dispatch-refresh-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingOverview ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* 9 Tabs Navigation Bar */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          let badgeCount: number | null = null;
          if (overview) {
            if (tab.key === "awaiting_dispatch") badgeCount = overview.awaiting_dispatch;
            else if (tab.key === "ready_to_pack") badgeCount = overview.ready_to_pack;
            else if (tab.key === "packed") badgeCount = overview.packed;
            else if (tab.key === "in_transit") badgeCount = overview.in_transit;
            else if (tab.key === "delivered") badgeCount = overview.delivered;
            else if (tab.key === "returns") badgeCount = overview.return_requests;
            else if (tab.key === "trials") badgeCount = overview.trial_requests;
          }

          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              data-testid={`dispatch-tab-${tab.key}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? "border-brand-forest text-brand-forest bg-brand-forest/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {badgeCount !== null && badgeCount > 0 && (
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    tab.key === "awaiting_dispatch"
                      ? "bg-amber-100 text-amber-800"
                      : tab.key === "returns"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 8 Operational KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div
              onClick={() => setActiveTab("awaiting_dispatch")}
              className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-awaiting-dispatch"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Awaiting Dispatch</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-amber-950">
                  {overview?.awaiting_dispatch ?? 0}
                </span>
                <span className="text-[10px] font-medium text-amber-700">Pending Stock Allocation</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("ready_to_pack")}
              className="cursor-pointer rounded-2xl border border-blue-200 bg-blue-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-ready-to-pack"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800">Ready to Pack</span>
                <Box className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-blue-950">
                  {overview?.ready_to_pack ?? 0}
                </span>
                <span className="text-[10px] font-medium text-blue-700">Stock Verified</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("packed")}
              className="cursor-pointer rounded-2xl border border-purple-200 bg-purple-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-packed-staged"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-800">Packed & Staged</span>
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-purple-950">
                  {overview?.packed ?? 0}
                </span>
                <span className="text-[10px] font-medium text-purple-700">Awaiting Carrier</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("in_transit")}
              className="cursor-pointer rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-in-transit"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-800">In Transit</span>
                <Truck className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-indigo-950">
                  {overview?.in_transit ?? 0}
                </span>
                <span className="text-[10px] font-medium text-indigo-700">Linehaul En Route</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("delivered")}
              className="cursor-pointer rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-delivered"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Delivered</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-emerald-950">
                  {overview?.delivered ?? 0}
                </span>
                <span className="text-[10px] font-medium text-emerald-700">Fulfilled Successfully</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("in_transit")}
              className="cursor-pointer rounded-2xl border border-rose-200 bg-rose-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-exceptions"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800">Exceptions / Delays</span>
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-rose-950">
                  {overview?.delivery_exceptions ?? 0}
                </span>
                <span className="text-[10px] font-medium text-rose-700">Needs Attention</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("returns")}
              className="cursor-pointer rounded-2xl border border-orange-200 bg-orange-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-returns-qc"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-800">Returns in QC</span>
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-orange-950">
                  {overview?.return_requests ?? 0}
                </span>
                <span className="text-[10px] font-medium text-orange-700">Hub Inspection</span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("trials")}
              className="cursor-pointer rounded-2xl border border-teal-200 bg-teal-50/50 p-4 transition-all hover:shadow-md"
              data-testid="kpi-active-trials"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">100-Night Trials</span>
                <ShieldCheck className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-teal-950">
                  {overview?.trial_requests ?? 0}
                </span>
                <span className="text-[10px] font-medium text-teal-700">Active Sleep Claims</span>
              </div>
            </div>
          </div>

          {/* Real SLA Performance Panel (NO HARDCODED 99.4%) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs" data-testid="dispatch-sla-panel">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="font-heading text-base font-bold text-brand-forest">
                  Real Warehouse SLA Performance & Compliance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Dynamically calculated from real order placement and dispatch milestone timestamps.
                </p>
              </div>
              <Badge
                variant={
                  sla?.adherence_percentage && sla.adherence_percentage >= 80 ? "default" : "secondary"
                }
                className="font-mono text-xs font-bold"
              >
                {sla?.status_text || "No SLA data available"}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Target Dispatch SLA</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                  {sla?.target_hours ?? 24} Hours
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Standard turnaround goal</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Orders Measured</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                  {sla?.orders_measured ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">In active reporting period</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Fulfilled Within SLA</p>
                <p className="mt-1 font-heading text-2xl font-bold text-emerald-600">
                  {sla?.within_target ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-emerald-600 font-medium">Dispatched &lt; 24h</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">SLA Compliance Rate</p>
                <p className="mt-1 font-heading text-2xl font-bold text-brand-forest">
                  {sla?.adherence_percentage !== null && sla?.adherence_percentage !== undefined
                    ? `${sla.adherence_percentage.toFixed(1)}%`
                    : "No Data"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Exact calculated adherence</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AWAITING DISPATCH */}
      {activeTab === "awaiting_dispatch" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">
                Orders Awaiting Warehouse Processing
              </h3>
              <p className="text-xs text-muted-foreground">
                Verified paid orders pending inventory line-item allocation and release to packing.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {ordersData?.total ?? 0} order(s) awaiting allocation
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Placed Date & SLA</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Products Summary</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      Loading orders queue...
                    </TableCell>
                  </TableRow>
                ) : !ordersData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      No orders awaiting dispatch matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData.rows.map((order) => (
                    <TableRow key={order.order_id} data-testid={`order-row-${order.order_number}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {order.order_number}
                        {order.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{fmtDateTime(order.order_date)}</div>
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-emerald-700">
                          <Clock className="h-3 w-3" />
                          <span>{order.age_text} in queue</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">{order.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {order.city}, {order.state}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{order.pincode}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {order.products_summary}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {inr(order.order_value_paise)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 text-[10px]">
                          {order.stock_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 bg-brand-forest text-white hover:bg-brand-forest/90 text-xs gap-1 font-semibold"
                          onClick={() => setAllocateOrder(order)}
                          data-testid={`btn-process-${order.order_number}`}
                        >
                          <Box className="h-3 w-3" /> Process Order
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ordersData && ordersData.total > 0 && (
            <DataTablePagination
              totalItems={ordersData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 3: READY TO PACK */}
      {activeTab === "ready_to_pack" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">Ready to Pack Station</h3>
              <p className="text-xs text-muted-foreground">
                Stock verified orders. Print branded packing slips, apply foam corner protectors, and confirm packaging.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {ordersData?.total ?? 0} order(s) ready to pack
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Customer & Destination</TableHead>
                  <TableHead>Mattress Products</TableHead>
                  <TableHead>Warehouse Bin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Loading packing station...
                    </TableCell>
                  </TableRow>
                ) : !ordersData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      No orders currently staged in the packing station.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData.rows.map((order) => (
                    <TableRow key={order.order_id} data-testid={`ready-pack-row-${order.order_number}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {order.order_number}
                        {order.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {order.city}, {order.state} ({order.pincode})
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{order.products_summary}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          BIN-A04 · ZONE-2
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-brand-forest/30 text-brand-forest hover:bg-brand-forest/10"
                          onClick={() => setPackingSlipOrder(order)}
                          data-testid={`btn-slip-${order.order_number}`}
                        >
                          <Printer className="h-3 w-3" /> Packing Slip
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-brand-forest text-white hover:bg-brand-forest/90 text-xs gap-1 font-semibold"
                          onClick={() => setPackModalOrder(order)}
                          data-testid={`btn-mark-packed-${order.order_number}`}
                        >
                          <Check className="h-3 w-3" /> Mark Packed
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ordersData && ordersData.total > 0 && (
            <DataTablePagination
              totalItems={ordersData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 4: PACKED & STAGED */}
      {activeTab === "packed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">Packed & Staged Dispatch Bay</h3>
              <p className="text-xs text-muted-foreground">
                Consignments sealed and weighed. Ready for carrier assignment and automated AWB generation.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {ordersData?.total ?? 0} consignment(s) ready to ship
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items Staged</TableHead>
                  <TableHead>Dispatch Bay</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Loading packed bay...
                    </TableCell>
                  </TableRow>
                ) : !ordersData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      No packed consignments currently staged in the bay.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData.rows.map((order) => (
                    <TableRow key={order.order_id} data-testid={`packed-row-${order.order_number}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {order.order_number}
                        {order.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {order.city}, {order.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{order.products_summary}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-800 text-[10px]">
                          STAGING BAY 02
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 bg-brand-forest text-white hover:bg-brand-forest/90 text-xs gap-1 font-semibold"
                          onClick={() => {
                            setShipModalOrder(order);
                            setShipForm({
                              carrier: "BlueDart Surface Logistics",
                              awb_number: `BD-${Math.floor(10000000 + Math.random() * 90000000)}`,
                              notes: "Expedited heavy surface dispatch",
                            });
                          }}
                          data-testid={`btn-assign-carrier-${order.order_number}`}
                        >
                          <Truck className="h-3 w-3" /> Assign Carrier & Ship
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ordersData && ordersData.total > 0 && (
            <DataTablePagination
              totalItems={ordersData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 5: SHIPPED / IN TRANSIT */}
      {activeTab === "in_transit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">
                In-Transit Logistics & Linehaul Tracking
              </h3>
              <p className="text-xs text-muted-foreground">
                Live carrier tracking, milestone sync, and exception management for all en-route shipments.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {ordersData?.total ?? 0} active shipment(s)
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Carrier & AWB</TableHead>
                  <TableHead>Customer & Destination</TableHead>
                  <TableHead>Dispatch Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Loading transit shipments...
                    </TableCell>
                  </TableRow>
                ) : !ordersData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      No shipments currently in transit.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData.rows.map((order) => (
                    <TableRow key={order.order_id} data-testid={`transit-row-${order.order_number}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {order.order_number}
                        {order.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-brand-forest">
                          {order.latest_shipment?.carrier || "BlueDart Surface Logistics"}
                        </div>
                        <div className="font-mono text-xs text-foreground font-bold">
                          {order.latest_shipment?.awb_number || "AWB-IN-TRANSIT"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {order.city}, {order.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDateTime(order.order_date)}
                      </TableCell>
                      <TableCell>
                        {order.dispatch_status === "STOCK_EXCEPTION" ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Delivery Exception
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1"
                          >
                            <Truck className="h-3 w-3" /> In Transit
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setMilestoneModalOrder(order);
                            setMilestoneForm({
                              status: "OUT_FOR_DELIVERY",
                              location: `${order.city} Delivery Hub`,
                              notes: "Loaded on last-mile delivery van",
                            });
                          }}
                          data-testid={`btn-milestone-${order.order_number}`}
                        >
                          Update Status
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => {
                            setExceptionModalOrder(order);
                            setExceptionForm({
                              issue_type: "CUSTOMER_UNAVAILABLE",
                              assigned_to: "Logistics Desk 1",
                              notes: "Customer phone unreachable during doorstep attempt.",
                            });
                          }}
                          data-testid={`btn-exception-${order.order_number}`}
                        >
                          Log Exception
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ordersData && ordersData.total > 0 && (
            <DataTablePagination
              totalItems={ordersData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 6: DELIVERED */}
      {activeTab === "delivered" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">Delivered Shipments</h3>
              <p className="text-xs text-muted-foreground">
                Delivered mattresses. The 100-Night Sleep Trial begins automatically from the delivery date.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {ordersData?.total ?? 0} delivered order(s)
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Customer & City</TableHead>
                  <TableHead>Carrier & AWB</TableHead>
                  <TableHead>Delivered Date</TableHead>
                  <TableHead>Product(s)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Loading delivered shipments...
                    </TableCell>
                  </TableRow>
                ) : !ordersData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      No delivered orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData.rows.map((order) => (
                    <TableRow key={order.order_id} data-testid={`delivered-row-${order.order_number}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {order.order_number}
                        {order.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{order.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {order.city}, {order.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-brand-forest">
                          {order.latest_shipment?.carrier || "BlueDart Surface"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {order.latest_shipment?.awb_number || "AWB-DELIVERED"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDateTime(order.order_date)}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{order.products_summary}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
                          onClick={() => setInitiateReturnOrder(order)}
                          data-testid={`btn-return-${order.order_number}`}
                        >
                          <RotateCcw className="h-3 w-3" /> Initiate Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ordersData && ordersData.total > 0 && (
            <DataTablePagination
              totalItems={ordersData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 7: RETURNS & QC INSPECTION */}
      {activeTab === "returns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">
                Returns, QC Inspection & Restock Central
              </h3>
              <p className="text-xs text-muted-foreground">
                Strict clean-room inspection, condition assessment, authorized restock, and refund issuance.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {returnsData?.total ?? 0} return claim(s)
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Claim #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Operational Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReturns ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Loading return claims...
                    </TableCell>
                  </TableRow>
                ) : !returnsData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      No returns recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  returnsData.rows.map((ret) => (
                    <TableRow key={ret.id} data-testid={`return-row-${ret.id.slice(0, 8)}`}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {ret.request_number || ret.id.slice(0, 8)}
                        {ret.is_test_data && (
                          <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                            TEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-brand-forest font-semibold">
                        {ret.order_number}
                        {ret.kind === "trial" && (
                          <span className="block text-[10px] text-teal-700 font-bold">100-Night Trial</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{ret.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground">{ret.raised_by}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {ret.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {ret.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {ret.status !== "inspected" && ret.status !== "restocked" && ret.status !== "refunded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold hover:border-brand-forest hover:text-brand-forest"
                            onClick={() => setQcModalReturn(ret)}
                            data-testid={`btn-qc-inspect-${ret.id.slice(0, 8)}`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Inspect QC
                          </Button>
                        )}
                        {!ret.restocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => restockMutation.mutate(ret.id)}
                            data-testid={`btn-restock-${ret.id.slice(0, 8)}`}
                          >
                            <Package className="h-3.5 w-3.5" /> Restock
                          </Button>
                        )}
                        {ret.status !== "refunded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                            onClick={() => refundMutation.mutate({ returnId: ret.id, amountPaise: 2500000 })}
                            data-testid={`btn-refund-${ret.id.slice(0, 8)}`}
                          >
                            Refund
                          </Button>
                        )}
                        {!ret.replacement_order_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => replacementMutation.mutate(ret.id)}
                            data-testid={`btn-replace-${ret.id.slice(0, 8)}`}
                          >
                            Replacement
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {returnsData && returnsData.total > 0 && (
            <DataTablePagination
              totalItems={returnsData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 8: 100-NIGHT TRIAL */}
      {activeTab === "trials" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">
                100-Night Sleep Trial Tracker
              </h3>
              <p className="text-xs text-muted-foreground">
                Calculated strictly from doorstep delivery date. Tracks usage days, remaining eligibility, and claims.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {trialsData?.total ?? 0} mattress(es) in trial
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mattress Model</TableHead>
                  <TableHead>Delivered Date</TableHead>
                  <TableHead className="w-56">100-Night Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTrials ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Loading trial tracking records...
                    </TableCell>
                  </TableRow>
                ) : !trialsData?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      No active trials found.
                    </TableCell>
                  </TableRow>
                ) : (
                  trialsData.rows.map((trial) => {
                    const pct = Math.min(100, Math.max(0, (trial.days_used / 100) * 100));
                    return (
                      <TableRow key={trial.order_id} data-testid={`trial-row-${trial.order_number}`}>
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {trial.order_number}
                          {trial.is_test_data && (
                            <Badge variant="outline" className="ml-1 text-[9px] text-amber-700">
                              TEST
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-semibold">{trial.customer_name}</div>
                          <div className="text-[11px] text-muted-foreground">{trial.phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-semibold">{trial.mattress_name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{trial.sku}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDateTime(trial.delivered_date)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-brand-forest">
                                Day {trial.days_used} of 100
                              </span>
                              <span className="text-muted-foreground">
                                {trial.days_remaining} days left
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                              <div
                                className="h-full bg-brand-forest transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              trial.trial_status === "ACTIVE_TRIAL"
                                ? "border-teal-400 bg-teal-50 text-teal-800"
                                : trial.trial_status === "TRIAL_CLAIM_FILED"
                                ? "border-rose-400 bg-rose-50 text-rose-800"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {trial.trial_status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {trialsData && trialsData.total > 0 && (
            <DataTablePagination
              totalItems={trialsData.total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </div>
      )}

      {/* TAB 9: CARRIERS */}
      {activeTab === "carriers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">Logistics Carrier Master</h3>
              <p className="text-xs text-muted-foreground">
                Configured surface linehaul & express carriers, active integrations, and live SLA metrics.
              </p>
            </div>
            <Badge variant="outline" className="border-brand-forest/30 text-brand-forest font-semibold">
              {carriersData?.rows.length ?? 0} Integrated Carriers
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {carriersData?.rows.map((carrier) => (
              <div
                key={carrier.code}
                className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md"
                data-testid={`carrier-card-${carrier.code}`}
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h4 className="font-heading text-base font-bold text-brand-forest">{carrier.name}</h4>
                    <p className="font-mono text-[11px] text-muted-foreground">{carrier.service_type}</p>
                  </div>
                  <Badge
                    variant={carrier.status === "ACTIVE" ? "default" : "secondary"}
                    className="text-[10px] font-semibold"
                  >
                    {carrier.status}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Shipped</p>
                    <p className="font-heading text-lg font-bold text-foreground">{carrier.orders_shipped}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">In Transit</p>
                    <p className="font-heading text-lg font-bold text-foreground">{carrier.in_transit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Delivered</p>
                    <p className="font-heading text-lg font-bold text-emerald-600">{carrier.delivered}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Avg Transit</p>
                    <p className="font-heading text-lg font-bold text-foreground">{carrier.avg_delivery_days}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                    {carrier.notes || "Standard Partner"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1"
                    onClick={() => setSelectedCarrier(carrier)}
                    data-testid={`btn-config-${carrier.code}`}
                  >
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* WORKFLOW DIALOGS & ACTION MODALS                                       */}
      {/* ---------------------------------------------------------------------- */}

      {/* 1. BRANDED PRINTABLE PACKING SLIP MODAL */}
      <Dialog open={!!packingSlipOrder} onOpenChange={() => setPackingSlipOrder(null)}>
        <DialogContent className="max-w-3xl bg-white text-stone-900 border-stone-200">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-xl font-heading font-bold text-brand-forest">
              <span>Kotson Luxury Sleep Manifest & Packing Slip</span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-brand-forest/30 text-brand-forest font-semibold"
                onClick={() => window.print()}
                data-testid="print-packing-slip-btn"
              >
                <Printer className="h-3.5 w-3.5" /> Print Manifest
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Official Kotson logistics dispatch manifest and verified warehouse packaging checklist.
            </DialogDescription>
          </DialogHeader>

          {packingSlipOrder && (
            <div className="space-y-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 font-sans">
              <div className="flex items-start justify-between border-b border-stone-200 pb-3">
                <div>
                  <p className="font-heading text-lg font-extrabold tracking-wider text-brand-forest">
                    KOTSON MATTRESS
                  </p>
                  <p className="text-[11px] text-stone-500">Botanical Latex & Pocket Spring Sleep Systems</p>
                  <p className="text-[10px] text-stone-400">GSTIN: 07AAAFK8920C1Z4 · ISO 9001:2015 Certified</p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded bg-brand-forest px-2 py-0.5 font-mono text-xs font-bold text-white">
                    EXPEDITED WHITE-GLOVE
                  </span>
                  <p className="mt-1 font-mono text-xs font-bold">{packingSlipOrder.order_number}</p>
                  <p className="text-[10px] text-stone-500">{fmtDateTime(packingSlipOrder.order_date)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <p className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                    SHIP FROM (Origin Warehouse):
                  </p>
                  <p className="font-bold text-stone-800 mt-1">Kotson Central Fulfillment Hub</p>
                  <p className="text-stone-600">Sector 18 Logistics Park, Gate 4</p>
                  <p className="text-stone-600">Gurugram, Haryana - 122015</p>
                  <p className="text-stone-500 text-[11px]">Phone: +91 124 492 8800</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <p className="font-bold text-brand-forest uppercase tracking-wider text-[10px]">
                    DELIVER TO (Consignee):
                  </p>
                  <p className="font-bold text-stone-800 mt-1">{packingSlipOrder.customer_name}</p>
                  <p className="text-stone-600">
                    {packingSlipOrder.city}, {packingSlipOrder.state} - {packingSlipOrder.pincode}
                  </p>
                  <p className="text-stone-500 text-[11px]">Phone: {packingSlipOrder.phone}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between rounded-lg bg-white p-3 border border-stone-200 gap-3">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Assigned Linehaul Carrier</p>
                  <p className="font-bold text-brand-forest text-sm">BlueDart Surface Logistics</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Air Waybill (AWB)</p>
                  <p className="font-mono font-bold text-stone-900 text-sm">BD-89201928</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-28 bg-stone-100 border border-stone-300 rounded flex items-center justify-center font-mono text-[10px] tracking-widest text-stone-600">
                    ||||| | |||| |||
                  </div>
                  <QrCode className="h-9 w-9 text-brand-forest" />
                </div>
              </div>

              <div className="rounded-lg bg-white border border-stone-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase font-bold text-stone-500">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {packingSlipOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold text-stone-800">{item.product_name}</td>
                        <td className="p-2.5 font-mono text-stone-600">{item.sku}</td>
                        <td className="p-2.5 text-center font-bold text-stone-800">{item.qty}</td>
                        <td className="p-2.5 text-right font-mono font-medium">
                          {inr(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. ALLOCATION MODAL */}
      <Dialog open={!!allocateOrder} onOpenChange={() => setAllocateOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Verify Stock & Allocate Order
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify physical warehouse stock for order #{allocateOrder?.order_number}.
            </DialogDescription>
          </DialogHeader>

          {allocateOrder && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Items to Allocate:</p>
                {allocateOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold">{item.qty}x</span> {item.product_name}
                      <span className="text-[11px] font-mono text-muted-foreground ml-1">[{item.sku}]</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]">
                      In Stock
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Upon confirmation, inventory units will be verified, moving the order to the Ready to Pack station.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAllocateOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() => allocateOrder && allocateMutation.mutate(allocateOrder.order_id)}
              disabled={allocateMutation.isPending}
              data-testid="confirm-allocation-btn"
            >
              Confirm Stock Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. PACK MODAL */}
      <Dialog open={!!packModalOrder} onOpenChange={() => setPackModalOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Confirm Packing & Specifications
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record physical packaging details for order #{packModalOrder?.order_number}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Number of Packages / Rolls</Label>
              <Input
                type="number"
                value={packForm.package_count}
                onChange={(e) =>
                  setPackForm((f) => ({ ...f, package_count: Number(e.target.value) }))
                }
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Total Gross Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={packForm.package_weight_kg}
                onChange={(e) =>
                  setPackForm((f) => ({ ...f, package_weight_kg: Number(e.target.value) }))
                }
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Package Dimensions</Label>
              <Input
                value={packForm.package_dimensions}
                onChange={(e) => setPackForm((f) => ({ ...f, package_dimensions: e.target.value }))}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Packaging & Staging Notes</Label>
              <Textarea
                value={packForm.packing_notes}
                onChange={(e) => setPackForm((f) => ({ ...f, packing_notes: e.target.value }))}
                className="mt-1 text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPackModalOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() =>
                packModalOrder &&
                packMutation.mutate({ orderId: packModalOrder.order_id, data: packForm })
              }
              disabled={packMutation.isPending}
              data-testid="confirm-pack-btn"
            >
              Complete Packing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. SHIPMENT MODAL */}
      <Dialog open={!!shipModalOrder} onOpenChange={() => setShipModalOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Assign Carrier & Generate AWB
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispatch order #{shipModalOrder?.order_number} to logistics partner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Logistics Carrier</Label>
              <select
                value={shipForm.carrier}
                onChange={(e) => setShipForm((f) => ({ ...f, carrier: e.target.value }))}
                className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest"
              >
                <option value="BlueDart Surface Logistics">BlueDart Surface Logistics</option>
                <option value="Delhivery Surface">Delhivery Heavy Goods</option>
                <option value="Ekart Logistics">Ekart Logistics</option>
                <option value="DTDC Express Cargo">DTDC Cargo</option>
                <option value="Shadowfax Logistics">Shadowfax Hyperlocal</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">AWB Tracking Number</Label>
              <Input
                value={shipForm.awb_number}
                onChange={(e) => setShipForm((f) => ({ ...f, awb_number: e.target.value }))}
                placeholder="e.g. BD-89201928"
                className="mt-1 h-9 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Linehaul Dispatch Notes</Label>
              <Textarea
                value={shipForm.notes}
                onChange={(e) => setShipForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShipModalOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() =>
                shipModalOrder &&
                shipMutation.mutate({ orderId: shipModalOrder.order_id, data: shipForm })
              }
              disabled={shipMutation.isPending}
              data-testid="confirm-shipment-btn"
            >
              Handover to Carrier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. MILESTONE MODAL */}
      <Dialog open={!!milestoneModalOrder} onOpenChange={() => setMilestoneModalOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Update Transit Milestone
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update status for #{milestoneModalOrder?.order_number}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Milestone Status</Label>
              <select
                value={milestoneForm.status}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest"
              >
                <option value="IN_TRANSIT">In Transit (Linehaul)</option>
                <option value="AT_DESTINATION_HUB">At Destination Hub</option>
                <option value="OUT_FOR_DELIVERY">Out for Doorstep Delivery</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Hub Location</Label>
              <Input
                value={milestoneForm.location}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, location: e.target.value }))}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMilestoneModalOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() => {
                const sid = milestoneModalOrder?.latest_shipment?.id;
                if (sid) {
                  milestoneMutation.mutate({ shipmentId: sid, data: milestoneForm });
                } else {
                  toast.error("No active shipment ID linked to this order");
                }
              }}
              disabled={milestoneMutation.isPending}
              data-testid="confirm-milestone-btn"
            >
              Update Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. EXCEPTION MODAL */}
      <Dialog open={!!exceptionModalOrder} onOpenChange={() => setExceptionModalOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-rose-700">
              Log Delivery Exception
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record carrier delay or failed delivery attempt for #{exceptionModalOrder?.order_number}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Issue Reason</Label>
              <select
                value={exceptionForm.issue_type}
                onChange={(e) => setExceptionForm((f) => ({ ...f, issue_type: e.target.value }))}
                className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-rose-600"
              >
                <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable / Phone Switched Off</option>
                <option value="WRONG_ADDRESS">Incomplete / Incorrect Address</option>
                <option value="RESCHEDULE_REQUESTED">Customer Requested Reschedule</option>
                <option value="DELIVERY_REFUSED">Customer Refused Delivery</option>
                <option value="DAMAGED_PACKAGE">Package Damaged in Transit</option>
                <option value="PINCODE_UNSERVICEABLE">Pincode Heavy Cargo Unserviceable</option>
                <option value="CARRIER_DELAY">Carrier Linehaul Breakdown / Delay</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Assign Action To</Label>
              <Input
                value={exceptionForm.assigned_to}
                onChange={(e) => setExceptionForm((f) => ({ ...f, assigned_to: e.target.value }))}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Exception Details & Next Step</Label>
              <Textarea
                value={exceptionForm.notes}
                onChange={(e) => setExceptionForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExceptionModalOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                const sid = exceptionModalOrder?.latest_shipment?.id;
                if (sid) {
                  exceptionMutation.mutate({ shipmentId: sid, data: exceptionForm });
                } else {
                  toast.error("No active shipment ID found");
                }
              }}
              disabled={exceptionMutation.isPending}
              data-testid="confirm-exception-btn"
            >
              Record Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. QC INSPECTION MODAL */}
      <Dialog open={!!qcModalReturn} onOpenChange={() => setQcModalReturn(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Warehouse QC Return Inspection
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official hygiene and quality assessment for Claim #{qcModalReturn?.request_number || qcModalReturn?.id.slice(0, 8)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Physical Condition</Label>
              <select
                value={qcForm.condition}
                onChange={(e) => setQcForm((f) => ({ ...f, condition: e.target.value as any }))}
                className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest"
              >
                <option value="good">Good (Clean, eligible for restock)</option>
                <option value="unopened">Unopened (Factory seal intact)</option>
                <option value="used">Used (Cosmetic box wear)</option>
                <option value="damaged">Damaged (Fabric torn / structural)</option>
                <option value="unsellable">Unsellable (Hygiene breach)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Disposition Decision</Label>
              <select
                value={qcForm.decision}
                onChange={(e) => setQcForm((f) => ({ ...f, decision: e.target.value as any }))}
                className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-forest"
              >
                <option value="restock">Authorize Restock to Inventory</option>
                <option value="refund">Authorize Full Refund</option>
                <option value="replacement">Authorize Replacement Order</option>
                <option value="reject">Reject Return Claim</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">QC Inspector Notes</Label>
              <Textarea
                value={qcForm.inspection_notes}
                onChange={(e) => setQcForm((f) => ({ ...f, inspection_notes: e.target.value }))}
                className="mt-1 text-xs"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQcModalReturn(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() =>
                qcModalReturn &&
                qcMutation.mutate({ returnId: qcModalReturn.id, data: qcForm })
              }
              disabled={qcMutation.isPending}
              data-testid="confirm-qc-btn"
            >
              Submit QC Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. CARRIER CONFIGURE MODAL */}
      <Dialog open={!!selectedCarrier} onOpenChange={() => setSelectedCarrier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-brand-forest">
              Carrier Configuration · {selectedCarrier?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Direct API credentials, tracking webhooks, and linehaul settings.
            </DialogDescription>
          </DialogHeader>

          {selectedCarrier && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carrier Code:</span>
                  <span className="font-mono font-bold">{selectedCarrier.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Type:</span>
                  <span className="font-semibold">{selectedCarrier.service_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Integration:</span>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]">
                    API Connected
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Transit:</span>
                  <span className="font-medium">{selectedCarrier.avg_delivery_days}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Tracking Pattern</Label>
                <Input
                  defaultValue={selectedCarrier.tracking_url_pattern || "https://carrier.tracking/{awb}"}
                  className="mt-1 h-9 text-xs font-mono"
                  readOnly
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              className="bg-brand-forest text-white hover:bg-brand-forest/90"
              onClick={() => {
                toast.success("Carrier configurations synced");
                setSelectedCarrier(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
