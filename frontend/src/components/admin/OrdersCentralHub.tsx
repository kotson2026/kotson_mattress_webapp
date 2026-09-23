import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDateTime, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";
import AddManualSaleModal from "@/components/admin/AddManualSaleModal";
import {
  Search,
  Plus,
  Download,
  Filter,
  RefreshCw,
  X,
  Eye,
  Store,
  Globe,
  MapPin,
  Calendar,
  CheckCircle,
  Truck,
  RotateCcw,
  CreditCard,
  User,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import type { Order } from "@/lib/types";

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface CascadeLocation {
  states: string[];
  districts: Record<string, string[]>;
  cities: Record<string, string[]>;
}

export default function OrdersCentralHub() {
  const qc = useQueryClient();

  // Search & Pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [salesSource, setSalesSource] = useState("all");
  const [orderChannel, setOrderChannel] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");

  // Modals & Drawers
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Location Cascade Query
  const { data: locations } = useQuery<CascadeLocation>({
    queryKey: ["admin-locations-cascade"],
    queryFn: () => apiGet<CascadeLocation>("/admin/locations/cascade"),
  });

  // Query Params construction
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(datePreset !== "all" && datePreset !== "custom" ? { date_from: datePreset } : {}),
    ...(datePreset === "custom" && dateFrom ? { date_from: dateFrom } : {}),
    ...(datePreset === "custom" && dateTo ? { date_to: dateTo } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(paymentStatus !== "all" ? { payment: paymentStatus } : {}),
    ...(salesSource !== "all" ? { sales_source: salesSource } : {}),
    ...(orderChannel !== "all" ? { order_channel: orderChannel } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(selectedState !== "all" ? { state: selectedState } : {}),
    ...(selectedDistrict !== "all" ? { district: selectedDistrict } : {}),
  }).toString();

  // Orders Query
  const { data, isLoading, isFetching, refetch } = useQuery<OrdersResponse>({
    queryKey: [
      "admin-orders-central",
      page,
      pageSize,
      q,
      datePreset,
      dateFrom,
      dateTo,
      status,
      paymentStatus,
      salesSource,
      orderChannel,
      category,
      selectedState,
      selectedDistrict,
    ],
    queryFn: () => apiGet<OrdersResponse>(`/admin/orders?${queryParams}`),
  });

  // State transitions mutation
  const transitionMutation = useMutation({
    mutationFn: (payload: { id: string; to: string }) =>
      apiPost(`/admin/orders/${payload.id}/transition`, { to: payload.to }),
    onSuccess: () => {
      toast.success("Order status updated successfully");
      qc.invalidateQueries({ queryKey: ["admin-orders-central"] });
      refetch();
      if (selectedOrder) {
        // Update local selected order state
        setSelectedOrder((prev) => (prev ? { ...prev, fulfilment_status: "shipped" as any } : null));
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update order status");
    },
  });

  // Export CSV
  const handleExportOrders = () => {
    const exportUrl = `${window.location.origin}/api/admin/orders/export?format=csv&${queryParams}`;
    window.open(exportUrl, "_blank");
    toast.success("Export initiated");
  };

  const orders = data?.orders || [];
  const total = data?.total || 0;

  // Available districts for chosen state
  const availableDistricts = useMemo(() => {
    if (!locations || selectedState === "all") return [];
    return locations.districts[selectedState] || [];
  }, [locations, selectedState]);

  return (
    <div className="space-y-6" data-testid="orders-central-hub">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Orders Central Hub</h2>
          <p className="text-xs text-muted-foreground">
            Complete order operations across Online, Referral, Dealer, and In-Store counter channels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            className="h-9 gap-1.5 bg-brand-deep text-white hover:bg-brand-deep/90 text-xs shadow-xs"
            data-testid="btn-add-manual-sale"
          >
            <Plus className="h-4 w-4" />
            + Add Manual Sale
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportOrders}
            className="h-9 gap-1.5 text-xs"
            data-testid="btn-export-orders"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
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

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Order #, Customer Name, Mobile, or Email..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="h-9 pl-9 text-xs"
              data-testid="orders-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date</option>
            </select>

            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs w-32"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs w-32"
                />
              </div>
            )}
          </div>
        </div>

        {/* Multi-dimension & Cascading Location Dropdowns */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 text-xs">
          {/* Order Status */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Order Status</Label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="all">All Statuses</option>
              <option value="processing">Processing</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Payment Status</Label>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Sales Source */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Sales Source</Label>
            <select
              value={salesSource}
              onChange={(e) => {
                setSalesSource(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="all">All Sources</option>
              <option value="DIRECT_WEBSITE">Direct Website</option>
              <option value="WEB_REFERRAL">Website + Referral</option>
              <option value="WALK_IN">Store Walk-in</option>
              <option value="DEALER">Dealer Counter</option>
              <option value="EMPLOYEE_ASSISTED">Employee Assisted</option>
              <option value="PHONE_ORDER">Phone Order</option>
              <option value="MANUAL">Manual / Other</option>
            </select>
          </div>

          {/* Channel */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Channel</Label>
            <select
              value={orderChannel}
              onChange={(e) => {
                setOrderChannel(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="all">All Channels</option>
              <option value="WEBSITE">WEBSITE</option>
              <option value="STORE">STORE</option>
              <option value="PORTAL">PORTAL</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </div>

          {/* Cascading State */}
          <div>
            <Label className="text-[11px] text-muted-foreground">State</Label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("all");
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs"
            >
              <option value="all">All States</option>
              {(locations?.states || []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Cascading District */}
          <div>
            <Label className="text-[11px] text-muted-foreground">District</Label>
            <select
              disabled={selectedState === "all"}
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs disabled:opacity-50"
            >
              <option value="all">All Districts</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <Table data-testid="admin-orders-table">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Order # & Date</TableHead>
              <TableHead className="text-xs font-semibold">Customer</TableHead>
              <TableHead className="text-xs font-semibold">Channel & Source</TableHead>
              <TableHead className="text-xs font-semibold">Items Preview</TableHead>
              <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
              <TableHead className="text-center text-xs font-semibold">Payment</TableHead>
              <TableHead className="text-center text-xs font-semibold">Fulfilment</TableHead>
              <TableHead className="text-right text-xs font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  No orders match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const isManual =
                  o.order_channel === "STORE" ||
                  o.payment_verification_source === "ADMIN_RECORDED" ||
                  o.order_source === "WALK_IN";
                const addr = o.address || {};
                const customerName = addr.full_name || o.email;
                const itemsCount = (o.items || []).reduce((acc, it) => acc + (it.qty || 1), 0);
                const firstItem = o.items?.[0];

                return (
                  <TableRow key={o.id} className="hover:bg-muted/30" data-testid={`order-row-${o.order_number}`}>
                    {/* Order & Date */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <p className="font-mono text-xs font-bold text-foreground">{o.order_number}</p>
                        {o.is_test_data && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-500/30 tracking-tight">
                            TEST
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(o.sale_date || o.created_at)}
                      </p>
                      {o.stock_exception && (
                        <Badge variant="destructive" className="mt-1 text-[9px]">
                          stock exception
                        </Badge>
                      )}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{customerName}</p>
                      <p className="text-[11px] text-muted-foreground">{addr.phone || o.email}</p>
                      {addr.city && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {addr.city}, {addr.state}
                        </p>
                      )}
                    </TableCell>

                    {/* Channel & Source */}
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant="outline"
                          className={`text-[10px] flex items-center gap-1 ${
                            isManual
                              ? "border-emerald-600/40 bg-emerald-50 text-emerald-800"
                              : "border-blue-600/40 bg-blue-50 text-blue-800"
                          }`}
                        >
                          {isManual ? <Store className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                          {o.order_channel || (isManual ? "STORE" : "WEBSITE")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {o.order_source || "DIRECT"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Items preview */}
                    <TableCell className="max-w-[200px]">
                      <p className="truncate text-xs text-foreground font-medium">
                        {firstItem?.product_name || "Custom Items"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {itemsCount} unit{itemsCount > 1 ? "s" : ""}
                        {o.items?.length > 1 ? ` (${o.items.length} variants)` : ""}
                      </p>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right">
                      <p className="font-mono text-xs font-bold text-foreground">
                        {inr(o.amounts?.total || 0)}
                      </p>
                      {o.amounts?.discount > 0 && (
                        <p className="text-[10px] text-destructive font-mono">
                          -{inr(o.amounts.discount)}
                        </p>
                      )}
                    </TableCell>

                    {/* Payment */}
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          o.payment_status === "paid"
                            ? "default"
                            : o.payment_status === "failed"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[10px] uppercase font-mono"
                      >
                        {o.payment_status}
                      </Badge>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {o.payment_verification_source === "ADMIN_RECORDED" ? "Recorded" : "Gateway"}
                      </p>
                    </TableCell>

                    {/* Fulfilment */}
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {o.fulfilment_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrder(o)}
                        className="h-7 text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Server-Side Pagination */}
        {total > 10 && (
          <div className="border-t border-border p-4">
            <DataTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Manual Sale Creation Modal */}
      <AddManualSaleModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <OrderDetailsDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onTransition={(to) => transitionMutation.mutate({ id: selectedOrder.id, to })}
          isTransitioning={transitionMutation.isPending}
        />
      )}
    </div>
  );
}

// Subcomponent: Order Details Drawer
function OrderDetailsDrawer({
  order,
  onClose,
  onTransition,
  isTransitioning,
}: {
  order: Order;
  onClose: () => void;
  onTransition: (to: string) => void;
  isTransitioning: boolean;
}) {
  const addr = order.address || {};
  const isManual =
    order.order_channel === "STORE" ||
    order.payment_verification_source === "ADMIN_RECORDED" ||
    order.order_source === "WALK_IN";
  const rzpData = (order.razorpay || {}) as Record<string, any>;
  const rzpOrder = rzpData.order as Record<string, any> | undefined;
  const rzpPayment = rzpData.payment as Record<string, any> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Order #{order.order_number}
              </h3>
              {order.is_test_data && (
                <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/30 text-[10px] font-bold">
                  TEST RECORD
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-xs uppercase">
                {order.payment_status}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {order.fulfilment_status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Placed on {fmtDateTime(order.sale_date || order.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer & Address */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <User className="h-3.5 w-3.5 text-brand-deep" /> Customer & Delivery
              </h4>
              <p className="text-xs font-semibold text-foreground">
                {addr.full_name || order.email}
              </p>
              <p className="text-muted-foreground">{addr.phone || "No phone provided"}</p>
              <p className="text-muted-foreground">{order.email}</p>
              <div className="pt-1 border-t border-border/60 text-muted-foreground">
                <p>{addr.line1 || "Store Carry-out"}</p>
                {addr.city && (
                  <p>
                    {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                )}
              </div>
            </div>

            {/* Sales Attribution & Provenance */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Store className="h-3.5 w-3.5 text-brand-deep" /> Attribution & Channel
              </h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel:</span>
                <span className="font-semibold text-foreground">
                  {order.order_channel || (isManual ? "STORE" : "WEBSITE")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold text-foreground">
                  {order.order_source || "DIRECT_WEBSITE"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Origin:</span>
                <span className="font-semibold text-foreground">
                  {order.payment_verification_source || "PAYMENT_GATEWAY"}
                </span>
              </div>
              {order.employee_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee ID:</span>
                  <span className="font-mono text-foreground">{order.employee_id}</span>
                </div>
              )}
              {order.dealer_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dealer ID:</span>
                  <span className="font-mono text-foreground">{order.dealer_id}</span>
                </div>
              )}
              {order.manual_payment_ref && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manual Ref:</span>
                  <span className="font-mono text-foreground">{order.manual_payment_ref}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Order Items ({order.items?.length || 0})
            </h4>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Variant / Size</TableHead>
                    <TableHead className="text-center text-xs">Qty</TableHead>
                    <TableHead className="text-right text-xs">Unit Price</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items || []).map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">{it.product_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {it.size} {it.thickness ? `(${it.thickness})` : ""}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{it.qty}</TableCell>
                      <TableCell className="text-right text-xs font-mono tabular-nums">
                        {inr(it.unit_price)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold tabular-nums">
                        {inr(it.line_total || it.qty * it.unit_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Financials & Amounts */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-mono">{inr(order.amounts?.subtotal || 0)}</span>
            </div>
            {order.amounts?.discount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Discount:</span>
                <span className="font-mono">-{inr(order.amounts.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping:</span>
              <span className="font-mono">{inr(order.amounts?.shipping || 0)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
              <span>Grand Total:</span>
              <span className="font-mono text-brand-deep text-base">
                {inr(order.amounts?.total || 0)}
              </span>
            </div>
          </div>

          {/* Timeline Events */}
          {(order.events || []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Audit Timeline Events
              </h4>
              <div className="space-y-1 rounded-xl border border-border p-3 text-[11px]">
                {order.events.map((ev, i) => (
                  <div key={i} className="flex justify-between border-b border-border/40 pb-1 last:border-0">
                    <span className="font-medium text-foreground">{ev.type}: {ev.detail}</span>
                    <span className="text-muted-foreground">{fmtDateTime(ev.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Gateway Details */}
          {Boolean(rzpOrder) && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5 text-brand-deep" /> Payment Gateway
              </h4>
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5 text-xs">
                {Boolean(rzpOrder) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Razorpay Order ID:</span>
                    <span className="font-mono text-foreground text-[11px]">
                      {rzpOrder?.id || "—"}
                    </span>
                  </div>
                )}
                {Boolean(rzpPayment) ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment ID:</span>
                      <span className="font-mono text-foreground text-[11px]">
                        {rzpPayment?.payment_id || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method:</span>
                      <span className="capitalize font-medium text-foreground">
                        {rzpPayment?.method || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verified via:</span>
                      <span className="font-medium text-foreground">
                        {rzpPayment?.via || "—"}
                      </span>
                    </div>
                    {Boolean(rzpData.verified_at) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Verified at:</span>
                        <span className="text-foreground">
                          {fmtDateTime(String(rzpData.verified_at))}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-[11px]">Payment not yet captured or awaiting verification.</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between border-t border-border bg-muted/20 px-6 py-3">
          <div className="flex items-center gap-2">
            {order.fulfilment_status === "processing" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isTransitioning}
                onClick={() => onTransition("shipped")}
                className="h-8 text-xs"
              >
                Mark Shipped
              </Button>
            )}
            {order.fulfilment_status === "shipped" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isTransitioning}
                onClick={() => onTransition("delivered")}
                className="h-8 text-xs"
              >
                Mark Delivered
              </Button>
            )}
            {order.fulfilment_status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isTransitioning}
                onClick={() => onTransition("cancelled")}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
              >
                Cancel Order
              </Button>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
