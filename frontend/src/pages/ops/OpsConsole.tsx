import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
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
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
  ShieldCheck,
  FileText,
  BadgeAlert,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTime, inr } from "@/lib/format";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DataTablePagination from "@/components/ui/DataTablePagination";
import type { DispatchQueue, DispatchRow, ReturnRequest, Shipment } from "@/lib/crmTypes";

const NAV = [
  { to: "/ops", label: "Outbound Dispatch Hub" },
  { to: "/ops/returns", label: "Returns & 100-Night Trial" },
  { to: "/ops/carriers", label: "Carriers & Hub" },
];

const OPS_ROLES = ["owner", "admin", "manager"];

const SHIPMENT_FLOW = ["dispatched", "in_transit", "out_for_delivery", "delivered"] as const;

function Panel({
  title,
  children,
  testId,
  note,
  action,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-xs" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-forest">{title}</h2>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// --------------------------------------------------------------------------------
// Printable Packing Slip & Shipping Label Modal
// --------------------------------------------------------------------------------
function PackingSlipModal({
  open,
  onClose,
  row,
  carrier,
  refNumber,
}: {
  open: boolean;
  onClose: () => void;
  row: DispatchRow;
  carrier?: string;
  refNumber?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white text-stone-900 border-stone-200">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl font-heading font-bold text-brand-forest">
            <span>Kotson Luxury Mattress Manifest</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs border-brand-forest/30"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" /> Print Label
            </Button>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Official warehouse dispatch manifest and barcode shipping label.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-stone-200 pb-3">
            <div>
              <p className="font-heading text-lg font-extrabold tracking-wider text-brand-forest">KOTSON MATTRESS</p>
              <p className="text-[11px] text-stone-500">Premium Botanical Organic Sleep Systems</p>
              <p className="text-[10px] text-stone-400">GSTIN: 07AAAFK8920C1Z4 · FSS/ISO Certified Facility</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded bg-brand-forest px-2 py-0.5 font-mono text-xs font-bold text-white">
                EXPEDITED LOGISTICS
              </span>
              <p className="mt-1 font-mono text-xs font-bold">{row.order_number}</p>
              <p className="text-[10px] text-stone-500">{fmtDateTime(row.placed_at)}</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-white p-3 border border-stone-200">
              <p className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">SHIP FROM (Origin Hub):</p>
              <p className="font-bold text-stone-800 mt-1">Kotson Fulfillment Central</p>
              <p className="text-stone-600">Sector 18 Logistics Park, Gate 4</p>
              <p className="text-stone-600">Gurugram, Haryana - 122015</p>
              <p className="text-stone-500 text-[11px]">Phone: +91 124 492 8800</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-stone-200">
              <p className="font-bold text-brand-forest uppercase tracking-wider text-[10px]">DELIVER TO (Consignee):</p>
              <p className="font-bold text-stone-800 mt-1">{row.customer || "Valued Customer"}</p>
              <p className="text-stone-600">Standard Residence Delivery</p>
              <p className="text-stone-600">Verified Paid Order · Fragile / Heavy Foam</p>
              <p className="text-stone-500 text-[11px]">Order Value: {inr(row.total)}</p>
            </div>
          </div>

          {/* Package & Courier Barcode Area */}
          <div className="flex flex-wrap items-center justify-between rounded-lg bg-white p-3 border border-stone-200 gap-3">
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-semibold">Assigned Carrier</p>
              <p className="font-bold text-brand-forest text-sm">{carrier || "BlueDart Surface Logistics"}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-semibold">AWB Tracking #</p>
              <p className="font-mono font-bold text-sm text-stone-800">{refNumber || "AWB-KOTSON-PENDING"}</p>
            </div>
            <div className="text-center font-mono text-[9px] tracking-widest text-stone-700 bg-stone-100 px-3 py-1.5 rounded border border-stone-300">
              <div className="text-xs font-black tracking-normal">|||| | ||||| || |||| |||| |||</div>
              *{row.order_number}*
            </div>
          </div>

          {/* Items breakdown */}
          <div className="rounded-lg bg-white p-3 border border-stone-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Package Contents:</p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-[10px] uppercase">
                  <th className="py-1">SKU</th>
                  <th className="py-1">Product Description</th>
                  <th className="py-1 text-right">Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {row.items.map((i) => (
                  <tr key={i.variant_id}>
                    <td className="py-1 font-mono text-[11px] text-stone-600">{i.sku}</td>
                    <td className="py-1 font-medium text-stone-800">{i.product_name}</td>
                    <td className="py-1 text-right font-bold">{i.ordered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Handling alerts */}
          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
            <span className="flex items-center gap-1 text-brand-forest font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> 10-Year Warranty Card Enclosed
            </span>
            <span>Handle with Care · Keep Dry · Do Not Puncture Poly-wrap</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------------
// Order Dispatch Card Component
// --------------------------------------------------------------------------------
function OrderDispatchCard({ row }: { row: DispatchRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState("BlueDart Express");
  const [ref, setRef] = useState("");
  const [url, setUrl] = useState("");
  const [pkgWeight, setPkgWeight] = useState("28.5");
  const [pkgType, setPkgType] = useState("Cylindrical Roll-Pack");
  const [slipOpen, setSlipOpen] = useState(false);

  const { data: shipments } = useQuery({
    queryKey: ["ops-shipments", row.order_id],
    queryFn: () => apiGet<Shipment[]>(`/ops/orders/${row.order_id}/shipments`),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost(`/ops/orders/${row.order_id}/shipments`, {
        items: Object.entries(qty)
          .filter(([, q]) => q > 0)
          .map(([variant_id, q]) => ({ variant_id, qty: q })),
        carrier: carrier || null,
        tracking_reference: ref || null,
        tracking_url: url || null,
        note: `Weight: ${pkgWeight}kg | Box: ${pkgType}`,
      }),
    onSuccess: () => {
      toast.success("Shipment successfully created & AWB logged!");
      setQty({});
      setRef("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["ops-dispatch"] });
      qc.invalidateQueries({ queryKey: ["ops-shipments", row.order_id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create shipment"),
  });

  const move = useMutation({
    mutationFn: ({ sid, status }: { sid: string; status: string }) =>
      apiPatch(`/ops/shipments/${sid}/status`, { status, note: `Manual carrier update to ${status}` }),
    onSuccess: () => {
      toast.success("Shipment milestone updated");
      qc.invalidateQueries({ queryKey: ["ops-dispatch"] });
      qc.invalidateQueries({ queryKey: ["ops-shipments", row.order_id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transition rejected"),
  });

  const selectedCount = Object.values(qty).filter((q) => q > 0).length;

  const handleCarrierPreset = (presetName: string) => {
    setCarrier(presetName);
    const sampleAwb = `${presetName.slice(0, 3).toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`;
    setRef(sampleAwb);
    if (presetName.toLowerCase().includes("bluedart")) {
      setUrl(`https://www.bluedart.com/tracking?handler=t&awb=${sampleAwb}`);
    } else if (presetName.toLowerCase().includes("delhivery")) {
      setUrl(`https://www.delhivery.com/track/package/${sampleAwb}`);
    } else if (presetName.toLowerCase().includes("dtdc")) {
      setUrl(`https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${sampleAwb}`);
    } else {
      setUrl(`https://track.kotson.in/v1/${sampleAwb}`);
    }
  };

  // Pre-fill ship qty to pending when opened if not set
  const initShipQty = () => {
    const initial: Record<string, number> = {};
    for (const item of row.items) {
      if (item.pending > 0) initial[item.variant_id] = item.pending;
    }
    setQty(initial);
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "delivered":
        return <Badge className="bg-brand-leaf text-brand-forest font-semibold">Delivered</Badge>;
      case "dispatched":
      case "in_transit":
        return <Badge className="bg-sky-100 text-sky-800 border-sky-300">In Transit</Badge>;
      case "out_for_delivery":
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300">Out For Delivery</Badge>;
      case "stock_exception":
        return <Badge variant="destructive">Stock Exception</Badge>;
      default:
        return <Badge variant="outline" className="border-brand-forest/20 text-brand-forest">{st}</Badge>;
    }
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-brand-forest/30"
      data-testid={`ops-order-${row.order_number}`}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold text-brand-forest">{row.order_number}</span>
              <div data-testid={`ops-order-status-${row.order_number}`}>{getStatusBadge(row.fulfilment_status)}</div>
              {row.fully_shipped && (
                <Badge className="bg-brand-leaf/20 text-brand-forest border-brand-leaf/40 font-medium">
                  Fully Shipped
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Customer: <span className="font-medium text-foreground">{row.customer || "Guest Checkout"}</span> · Placed{" "}
              {fmtDateTime(row.placed_at)} · Total Value: <span className="font-medium text-foreground">{inr(row.total)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 min-h-10 text-xs border-brand-forest/20 hover:bg-brand-leaf/10 hover:text-brand-forest"
              onClick={() => setSlipOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" /> Packing Slip
            </Button>
            <Button
              size="sm"
              variant={open ? "secondary" : "default"}
              className={`min-h-10 gap-1.5 font-medium ${
                open ? "" : "bg-brand-forest text-white hover:bg-brand-forest/90"
              }`}
              onClick={() => {
                if (!open) initShipQty();
                setOpen((o) => !o);
              }}
              data-testid={`ops-order-toggle-${row.order_number}`}
            >
              {open ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Close Panel
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" /> Fulfill & Dispatch
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="mt-4 rounded-xl border border-border/80 overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold text-brand-forest">Mattress / Item SKU</TableHead>
                <TableHead className="text-xs font-semibold text-center">Ordered</TableHead>
                <TableHead className="text-xs font-semibold text-center">Shipped</TableHead>
                <TableHead className="text-xs font-semibold text-center text-amber-700">Pending</TableHead>
                {open && <TableHead className="text-xs font-semibold text-right">Ship in this Batch</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.items.map((i) => (
                <TableRow key={i.variant_id} data-testid={`ops-line-${i.sku}`}>
                  <TableCell className="text-xs">
                    <p className="font-medium text-foreground">{i.product_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{i.sku}</p>
                  </TableCell>
                  <TableCell className="text-center font-medium">{i.ordered}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{i.shipped}</TableCell>
                  <TableCell className="text-center font-bold text-amber-700">{i.pending}</TableCell>
                  {open && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={i.pending}
                        className="ml-auto min-h-9 w-20 text-center font-bold"
                        value={qty[i.variant_id] ?? ""}
                        disabled={i.pending === 0}
                        onChange={(e) => setQty((q) => ({ ...q, [i.variant_id]: Number(e.target.value) }))}
                        data-testid={`ops-ship-qty-${i.sku}`}
                        aria-label={`Quantity to ship for ${i.product_name}`}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Expanded Dispatch & Courier Assignment Box */}
        {open && (
          <div className="mt-5 space-y-5 rounded-xl border border-brand-forest/20 bg-brand-forest/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-forest/10 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-brand-forest" />
                <h4 className="font-heading text-sm font-bold text-brand-forest">
                  Courier Assignment & Waybill Generator
                </h4>
              </div>
              <span className="text-xs text-muted-foreground">Select courier preset or input custom AWB</span>
            </div>

            {/* Quick Courier Presets */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Courier Partner
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["BlueDart Express", "Delhivery Heavy", "DTDC Prime", "Shadowfax Express", "Custom Carrier"].map(
                  (cp) => (
                    <Button
                      key={cp}
                      type="button"
                      size="xs"
                      variant={carrier === cp ? "default" : "outline"}
                      className={`min-h-8 text-xs ${
                        carrier === cp ? "bg-brand-forest text-white" : "border-border hover:border-brand-forest"
                      }`}
                      onClick={() => handleCarrierPreset(cp)}
                    >
                      {cp}
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Shipment Form Fields */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`carrier-${row.order_number}`} className="text-xs">
                  Carrier Name
                </Label>
                <Input
                  id={`carrier-${row.order_number}`}
                  className="min-h-10 bg-background"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  data-testid={`ops-carrier-${row.order_number}`}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`ref-${row.order_number}`} className="text-xs">
                  Tracking AWB Number
                </Label>
                <Input
                  id={`ref-${row.order_number}`}
                  className="min-h-10 font-mono bg-background"
                  value={ref}
                  placeholder="e.g. BD-892019482"
                  onChange={(e) => setRef(e.target.value)}
                  data-testid={`ops-tracking-ref-${row.order_number}`}
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Packaging Format</Label>
                <select
                  value={pkgType}
                  onChange={(e) => setPkgType(e.target.value)}
                  className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="Cylindrical Roll-Pack">Cylindrical Roll-Pack</option>
                  <option value="Flat Cartoned Heavy-Duty">Flat Cartoned Heavy-Duty</option>
                  <option value="Protective Bio-Wrap Bundle">Protective Bio-Wrap Bundle</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Package Weight (KG)</Label>
                <Input
                  className="min-h-10 bg-background"
                  value={pkgWeight}
                  onChange={(e) => setPkgWeight(e.target.value)}
                  placeholder="28.5"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 grid gap-1.5">
                <Label htmlFor={`url-${row.order_number}`} className="text-xs">
                  Tracking URL
                </Label>
                <Input
                  id={`url-${row.order_number}`}
                  className="min-h-10 bg-background font-mono text-xs"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.bluedart.com/tracking?awb=…"
                  data-testid={`ops-tracking-url-${row.order_number}`}
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => create.mutate()}
                  disabled={selectedCount === 0 || create.isPending}
                  className="min-h-10 w-full bg-brand-forest text-white hover:bg-brand-forest/90 font-medium"
                  data-testid={`ops-create-shipment-${row.order_number}`}
                >
                  {create.isPending ? "Generating Label…" : "Create & Dispatch"}
                </Button>
              </div>
            </div>

            {/* Manifest note */}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-leaf" />
              Manifest updates are logged with audit timestamps and immediately reflected on the customer's tracking
              portal.
            </p>

            {/* Created Shipments for this order */}
            <div className="mt-4 border-t border-brand-forest/10 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-heading text-sm font-bold text-brand-forest">
                  Active Shipments for Order ({shipments?.length ?? 0})
                </h4>
              </div>

              {(shipments ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
                  No shipments dispatched yet for this order.
                </p>
              ) : (
                <div className="grid gap-3">
                  {(shipments ?? []).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-background p-4 shadow-2xs"
                      data-testid={`ops-shipment-${s.shipment_number}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-brand-forest">{s.shipment_number}</span>
                            <Badge variant="outline" className="border-brand-forest/30 font-semibold uppercase text-[10px]">
                              <span data-testid={`ops-shipment-status-${s.shipment_number}`}>{s.status}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Carrier: <span className="font-medium text-foreground">{s.carrier || "Standard"}</span> ·
                            AWB: <span className="font-mono font-medium text-foreground">{s.tracking_reference || "N/A"}</span>
                            {s.tracking_url && (
                              <a
                                href={s.tracking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-0.5 text-brand-forest hover:underline"
                              >
                                View Carrier Tracking <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Lines: {s.items.map((i) => `${i.product_name} ×${i.qty}`).join(", ")}
                          </p>
                        </div>

                        {/* Milestone Stepper Buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {SHIPMENT_FLOW.map((st) => (
                            <Button
                              key={st}
                              size="xs"
                              variant={s.status === st ? "default" : "outline"}
                              className={`min-h-8 text-xs ${
                                s.status === st
                                  ? "bg-brand-forest text-white"
                                  : "border-border hover:border-brand-forest"
                              }`}
                              disabled={s.status === st || move.isPending}
                              onClick={() => move.mutate({ sid: s.id, status: st })}
                              data-testid={`ops-shipment-${s.shipment_number}-${st}`}
                            >
                              {st.replace(/_/g, " ")}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Milestones log */}
                      {s.milestones.length > 0 && (
                        <div className="mt-3 rounded-lg bg-muted/30 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Milestone Audit Trail
                          </p>
                          <ol className="space-y-1 text-xs text-muted-foreground">
                            {s.milestones.map((m, i) => (
                              <li key={i} className="flex items-center justify-between text-[11px]">
                                <span>
                                  <strong className="text-foreground">{m.status}</strong> · {m.actor || "Staff"}
                                  {m.note ? ` · "${m.note}"` : ""}
                                </span>
                                <span className="font-mono text-stone-400">{fmtDateTime(m.at)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <PackingSlipModal
        open={slipOpen}
        onClose={() => setSlipOpen(false)}
        row={row}
        carrier={carrier}
        refNumber={ref}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------
// Dispatch Queue View
// --------------------------------------------------------------------------------
function DispatchQueueView() {
  const [filter, setFilter] = useState<"all" | "pending" | "in_transit" | "delivered">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ["ops-dispatch"],
    queryFn: () => apiGet<DispatchQueue>("/ops/dispatch-queue"),
  });

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => {
      const matchSearch =
        !search ||
        r.order_number.toLowerCase().includes(search.toLowerCase()) ||
        (r.customer && r.customer.toLowerCase().includes(search.toLowerCase())) ||
        r.items.some((i) => i.sku.toLowerCase().includes(search.toLowerCase()) || i.product_name.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      if (filter === "pending") {
        return r.fulfilment_status === "processing" || !r.fully_shipped;
      }
      if (filter === "in_transit") {
        return r.fulfilment_status === "dispatched" || r.fulfilment_status === "in_transit";
      }
      if (filter === "delivered") {
        return r.fulfilment_status === "delivered";
      }
      return true;
    });
  }, [data?.rows, search, filter]);

  const total = filteredRows.length;
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6">
      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="ops-stats">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Awaiting Movement</p>
            <Clock className="h-4 w-4 text-brand-forest" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-brand-forest" data-testid="ops-stat-queue">
            {data?.total ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Orders verified & paid, pending dispatch</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock Exceptions</p>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-destructive" data-testid="ops-stat-exceptions">
            {data?.stock_exceptions ?? "0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Payment captured without allocatable stock</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Carrier Integration</p>
            <Truck className="h-4 w-4 text-brand-leaf" />
          </div>
          <p className="mt-2 font-heading text-lg font-black text-brand-forest" data-testid="ops-stat-courier">
            Active Multi-Carrier
          </p>
          <p className="mt-1 text-xs text-muted-foreground">BlueDart · Delhivery · DTDC Waybills</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dispatch SLA Target</p>
            <ShieldCheck className="h-4 w-4 text-brand-leaf" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-brand-forest">24 Hours</p>
          <p className="mt-1 text-xs text-muted-foreground">99.4% SLA adherence across all zones</p>
        </div>
      </div>

      {/* Main Queue Panel */}
      <Panel
        title="Outbound Dispatch Queue"
        testId="ops-queue-panel"
        note="Verified paid orders routed to warehouse fulfillment. Only paid orders may be packed and dispatched."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search order #, customer, SKU…"
                className="pl-8 text-xs min-h-9 w-60 bg-background"
              />
            </div>
            <div className="flex rounded-lg border border-border bg-background p-0.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "pending", label: "Ready to Pack" },
                  { id: "in_transit", label: "In Transit" },
                  { id: "delivered", label: "Delivered" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilter(tab.id);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filter === tab.id
                      ? "bg-brand-forest text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading dispatch queue…</div>
        ) : total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center" data-testid="ops-queue-empty">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium text-foreground">Nothing to dispatch</p>
            <p className="text-xs text-muted-foreground">
              Every paid order is either fully delivered or no orders match the current filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedRows.map((r) => (
              <OrderDispatchCard key={r.order_id} row={r} />
            ))}

            <div className="mt-6 border-t border-border pt-4">
              <DataTablePagination
                totalItems={total}
                currentPage={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Returns & 100-Night Sleep Trial View
// --------------------------------------------------------------------------------
function ReturnsView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [activeReturn, setActiveReturn] = useState<ReturnRequest | null>(null);
  const [qcNotes, setQcNotes] = useState("Foam integrity 100% intact, cover sanitized, approved for restock");

  const { data } = useQuery({
    queryKey: ["ops-returns"],
    queryFn: () => apiGet<{ total: number; rows: ReturnRequest[] }>("/ops/returns"),
  });

  const patch = useMutation({
    mutationFn: ({ rid, status, restock }: { rid: string; status: string; restock?: boolean }) =>
      apiPatch(`/ops/returns/${rid}`, { status, restock: !!restock, note: `Moved to ${status} via Return Ops Console` }),
    onSuccess: () => {
      toast.success("Return status updated");
      qc.invalidateQueries({ queryKey: ["ops-returns"] });
      setQcModalOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transition rejected"),
  });

  const allRows = data?.rows ?? [];
  const filteredRows = allRows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "requested") return r.status === "requested";
    if (filter === "approved") return r.status === "approved";
    if (filter === "inspected") return r.status === "inspected";
    if (filter === "restocked") return r.restocked;
    return true;
  });

  const total = filteredRows.length;
  const paginated = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenQc = (r: ReturnRequest) => {
    setActiveReturn(r);
    setQcModalOpen(true);
  };

  return (
    <div className="grid gap-6">
      {/* Return KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active Return Requests</p>
            <RotateCcw className="h-4 w-4 text-brand-forest" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-brand-forest">{data?.total ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">100-Night Trial & Warranty claims</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Awaiting QC Inspection</p>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-amber-700">
            {allRows.filter((r) => r.status === "received").length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Physical units received at return hub</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inventory Recovered</p>
            <CheckCircle2 className="h-4 w-4 text-brand-leaf" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-brand-forest">
            {allRows.filter((r) => r.restocked).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Restocked after sanitized quality pass</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trial Return Rate</p>
            <ShieldCheck className="h-4 w-4 text-brand-leaf" />
          </div>
          <p className="mt-2 font-heading text-3xl font-black text-brand-forest">2.1%</p>
          <p className="mt-1 text-xs text-muted-foreground">Well under the 5% industry comfort threshold</p>
        </div>
      </div>

      <Panel
        title={`Returns, 100-Night Sleep Trial & Reverse Logistics (${data?.total ?? 0})`}
        testId="ops-returns-panel"
        note="Restock occurs exclusively on inspected, approved returns with audited inventory ledger updates. Owner / Admin verified."
        action={
          <div className="flex rounded-lg border border-border bg-background p-0.5">
            {[
              { id: "all", label: "All Returns" },
              { id: "requested", label: "Requested" },
              { id: "approved", label: "Pickup Scheduled" },
              { id: "inspected", label: "Inspected" },
              { id: "restocked", label: "Restocked" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilter(tab.id);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? "bg-brand-forest text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center" data-testid="ops-returns-empty">
            <RotateCcw className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium text-foreground">No return requests match filter</p>
            <p className="text-xs text-muted-foreground">
              Customer returns and trial claims raised by CRM or support appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginated.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-border bg-background p-5 shadow-xs transition-all hover:border-brand-forest/30"
                data-testid={`ops-return-${r.request_number}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-brand-forest">{r.request_number}</span>
                      <Badge variant="outline" className="border-brand-forest/30 uppercase text-[10px] font-bold">
                        {r.kind.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Order Ref:</span>
                      <span className="font-medium text-xs text-foreground">{r.order_number}</span>
                    </div>

                    <p className="text-xs font-medium text-foreground">
                      Reason: <span className="font-normal text-muted-foreground">{r.reason}</span>
                    </p>

                    <p className="text-[11px] text-muted-foreground">
                      Initiated by: {r.raised_by} ({r.raised_by_role || "Support"}) · Policy Version: {r.policy_version} · Logged {fmtDateTime(r.created_at)}
                    </p>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-semibold" data-testid={`ops-return-status-${r.request_number}`}>
                      {r.status}
                    </Badge>
                    {r.restocked && (
                      <Badge className="bg-brand-leaf text-brand-forest font-semibold">Restocked to Inventory</Badge>
                    )}

                    {["approved", "received", "inspected", "rejected"].map((st) => (
                      <Button
                        key={st}
                        size="xs"
                        variant="outline"
                        className={`min-h-9 text-xs hover:border-brand-forest ${
                          r.status === st ? "border-brand-forest bg-brand-forest/10 font-bold" : ""
                        }`}
                        disabled={r.status === st || patch.isPending}
                        onClick={() => patch.mutate({ rid: r.id, status: st })}
                        data-testid={`ops-return-${r.request_number}-${st}`}
                      >
                        {st === "approved" ? "Approve Pickup" : st}
                      </Button>
                    ))}

                    {/* Restock Button */}
                    <Button
                      size="xs"
                      className="min-h-9 bg-brand-forest text-white hover:bg-brand-forest/90 font-medium"
                      disabled={r.restocked || r.status !== "inspected" || patch.isPending}
                      onClick={() => handleOpenQc(r)}
                      data-testid={`ops-return-${r.request_number}-restock`}
                    >
                      QC & Restock
                    </Button>
                  </div>
                </div>

                {/* Audit Trail */}
                {r.trail.length > 0 && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Reverse Logistics Trail
                    </p>
                    <ol className="space-y-1 text-xs text-muted-foreground">
                      {r.trail.map((t, i) => (
                        <li key={i} className="flex items-center justify-between text-[11px]">
                          <span>
                            <strong className="text-foreground">{t.status}</strong> · {t.actor}
                            {t.note ? ` · "${t.note}"` : ""}
                          </span>
                          <span className="font-mono text-stone-400">{fmtDateTime(t.at)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 border-t border-border pt-4">
              <DataTablePagination
                totalItems={total}
                currentPage={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        )}
      </Panel>

      {/* QC & Restock Modal */}
      {activeReturn && (
        <Dialog open={qcModalOpen} onOpenChange={setQcModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-brand-forest">
                Quality Control & Restock Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Authorize inspected mattress units for re-addition into active warehouse inventory.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p>
                  <strong>Return ID:</strong> {activeReturn.request_number}
                </p>
                <p>
                  <strong>Order ID:</strong> {activeReturn.order_number}
                </p>
                <p>
                  <strong>Claim Reason:</strong> {activeReturn.reason}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <Label className="font-bold">Sanitization & Rebound Inspection Criteria</Label>
                <div className="space-y-1.5 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-leaf" /> Latex / Foam compression rebound verified
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-leaf" /> Organic cotton encasement washed & UV-sanitized
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-leaf" /> Re-boxed into sealed warehouse inventory packaging
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="qc-notes" className="text-xs">
                  Inspector Notes & Remarks
                </Label>
                <Input
                  id="qc-notes"
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="min-h-10 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setQcModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-brand-forest text-white hover:bg-brand-forest/90 font-medium"
                  onClick={() =>
                    patch.mutate({
                      rid: activeReturn.id,
                      status: "restocked",
                      restock: true,
                    })
                  }
                  disabled={patch.isPending}
                >
                  {patch.isPending ? "Restocking…" : "Confirm Restock"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------
// Carriers & Hub View
// --------------------------------------------------------------------------------
function CarriersHubView() {
  const carriers = [
    {
      name: "BlueDart Express",
      badge: "Air & Surface Express",
      status: "Active Integration",
      awbFormat: "9-digit numeric AWB",
      cutoffTime: "4:30 PM Daily",
      trackingUrl: "https://www.bluedart.com/tracking",
      notes: "Preferred carrier for metro and Tier-1 heavy roll-packed shipments.",
    },
    {
      name: "Delhivery Heavy Logistics",
      badge: "Heavy & Bulky Cargo",
      status: "Active Integration",
      awbFormat: "12-digit numeric AWB",
      cutoffTime: "5:00 PM Daily",
      trackingUrl: "https://www.delhivery.com/track",
      notes: "Equipped for multi-box king size mattress sets and hydraulic bed frames.",
    },
    {
      name: "DTDC Prime",
      badge: "Pan-India Surface",
      status: "Active Integration",
      awbFormat: "Alpha-numeric (e.g. D12345678)",
      cutoffTime: "3:30 PM Daily",
      trackingUrl: "https://www.dtdc.in/tracking",
      notes: "Covers 19,000+ PIN codes across North-East and deep-tier towns.",
    },
    {
      name: "Shadowfax Last-Mile",
      badge: "Hyperlocal & Reverse Pickups",
      status: "Active Integration",
      awbFormat: "SFX- prefix barcode",
      cutoffTime: "6:00 PM Daily",
      trackingUrl: "https://track.shadowfax.in",
      notes: "Specialized in 100-Night Sleep Trial reverse doorstep pickups.",
    },
  ];

  return (
    <div className="grid gap-6">
      <Panel title="Logistics Carrier Network & SLA Config" testId="ops-carriers-panel">
        <p className="text-xs text-muted-foreground mb-4">
          Integrated carrier partners configured for Kotson outbound shipments and reverse trial pickups.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {carriers.map((c) => (
            <div key={c.name} className="rounded-xl border border-border bg-background p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-brand-forest">{c.name}</h3>
                <Badge className="bg-brand-leaf/20 text-brand-forest border-brand-leaf/40 text-[10px]">
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.notes}</p>
              <div className="rounded-lg bg-muted/40 p-2 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Type:</span>
                  <span className="font-medium text-foreground">{c.badge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AWB Format:</span>
                  <span className="font-mono text-foreground">{c.awbFormat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily Pickup Cutoff:</span>
                  <span className="font-semibold text-brand-forest">{c.cutoffTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Warehouse & Fulfillment Hub Origin" testId="ops-hub-panel">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-forest" />
              <h4 className="font-heading font-bold text-sm text-brand-forest">Central Fulfillment Hub 01</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Sector 18 Logistics Complex, Gate 4, Gurugram, Haryana - 122015
            </p>
            <p className="text-xs text-muted-foreground">
              Capacity: 450 Roll-packed mattresses/day · 2 automated vacuum press sealers
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-forest" />
              <h4 className="font-heading font-bold text-sm text-brand-forest">South India Distribution Hub 02</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Hosur Industrial Estate, Phase 2, Krishnagiri, Tamil Nadu - 635126
            </p>
            <p className="text-xs text-muted-foreground">
              Servicing Bengaluru, Chennai, Hyderabad & Kerala with next-day dispatch.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------------------------
// Main Ops Console Component
// --------------------------------------------------------------------------------
export default function OpsConsole() {
  return (
    <ConsoleLayout area="Order operations" title="Order Operations & Logistics Hub" allowedRoles={OPS_ROLES} nav={NAV}>
      <Routes>
        <Route index element={<DispatchQueueView />} />
        <Route path="returns" element={<ReturnsView />} />
        <Route path="carriers" element={<CarriersHubView />} />
      </Routes>
    </ConsoleLayout>
  );
}
