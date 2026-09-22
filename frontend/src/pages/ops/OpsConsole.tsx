import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTime, inr } from "@/lib/format";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DispatchQueue, DispatchRow, ReturnRequest, Shipment } from "@/lib/crmTypes";

const NAV = [
  { to: "/ops", label: "Dispatch Queue" },
  { to: "/ops/returns", label: "Returns & Trial" },
];

const OPS_ROLES = ["owner", "admin", "manager"];

function Panel({ title, children, testId, note }: { title: string; children: React.ReactNode; testId?: string; note?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SHIPMENT_FLOW = ["dispatched", "in_transit", "out_for_delivery", "delivered"] as const;

function OrderDispatchCard({ row }: { row: DispatchRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState("");
  const [ref, setRef] = useState("");
  const [url, setUrl] = useState("");

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
      }),
    onSuccess: () => {
      toast.success("Shipment created");
      setQty({});
      setCarrier("");
      setRef("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["ops-dispatch"] });
      qc.invalidateQueries({ queryKey: ["ops-shipments", row.order_id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create shipment"),
  });

  const move = useMutation({
    mutationFn: ({ sid, status }: { sid: string; status: string }) =>
      apiPatch(`/ops/shipments/${sid}/status`, { status, note: `Manual update to ${status}` }),
    onSuccess: () => {
      toast.success("Shipment updated");
      qc.invalidateQueries({ queryKey: ["ops-dispatch"] });
      qc.invalidateQueries({ queryKey: ["ops-shipments", row.order_id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transition rejected"),
  });

  const selectedCount = Object.values(qty).filter((q) => q > 0).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5" data-testid={`ops-order-${row.order_number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">{row.order_number}</h3>
          <p className="text-xs text-muted-foreground">
            {row.customer} · placed {fmtDateTime(row.placed_at)} · {inr(row.total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid={`ops-order-status-${row.order_number}`}>{row.fulfilment_status}</Badge>
          {row.fully_shipped && <Badge className="bg-brand-leaf">fully shipped</Badge>}
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => setOpen((o) => !o)} data-testid={`ops-order-toggle-${row.order_number}`}>
            {open ? "Hide" : "Manage"}
          </Button>
        </div>
      </div>

      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Shipped</TableHead>
            <TableHead>Pending</TableHead>
            {open && <TableHead>Ship now</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {row.items.map((i) => (
            <TableRow key={i.variant_id} data-testid={`ops-line-${i.sku}`}>
              <TableCell className="text-xs">
                {i.product_name}
                <div className="text-muted-foreground">{i.sku}</div>
              </TableCell>
              <TableCell>{i.ordered}</TableCell>
              <TableCell>{i.shipped}</TableCell>
              <TableCell>{i.pending}</TableCell>
              {open && (
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={i.pending}
                    className="min-h-11 w-20"
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

      {open && (
        <div className="mt-4 grid gap-4">
          <fieldset className="grid gap-3 rounded-xl border border-dashed border-border p-4">
            <legend className="px-1 text-sm font-semibold">Create a shipment (partial allowed)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`carrier-${row.order_number}`}>Carrier</Label>
                <Input id={`carrier-${row.order_number}`} className="min-h-11" value={carrier} onChange={(e) => setCarrier(e.target.value)} data-testid={`ops-carrier-${row.order_number}`} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ref-${row.order_number}`}>Tracking reference</Label>
                <Input id={`ref-${row.order_number}`} className="min-h-11" value={ref} onChange={(e) => setRef(e.target.value)} data-testid={`ops-tracking-ref-${row.order_number}`} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`url-${row.order_number}`}>Tracking URL</Label>
                <Input id={`url-${row.order_number}`} className="min-h-11" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-testid={`ops-tracking-url-${row.order_number}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Entered by staff and shown to the customer as a manual update — no courier API is connected.
            </p>
            <Button
              onClick={() => create.mutate()}
              disabled={selectedCount === 0 || create.isPending}
              className="min-h-11 w-fit"
              data-testid={`ops-create-shipment-${row.order_number}`}
            >
              {create.isPending ? "Creating…" : "Create shipment"}
            </Button>
          </fieldset>

          <div className="grid gap-2">
            <h4 className="text-sm font-semibold">Shipments ({shipments?.length ?? 0})</h4>
            {(shipments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No shipment yet.</p>
            ) : (
              (shipments ?? []).map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3" data-testid={`ops-shipment-${s.shipment_number}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {s.shipment_number} · <span data-testid={`ops-shipment-status-${s.shipment_number}`}>{s.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.items.map((i) => `${i.product_name} ×${i.qty}`).join(", ")}
                        {s.carrier ? ` · ${s.carrier}` : ""}
                        {s.tracking_reference ? ` · ${s.tracking_reference}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SHIPMENT_FLOW.map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          disabled={s.status === st || move.isPending}
                          onClick={() => move.mutate({ sid: s.id, status: st })}
                          data-testid={`ops-shipment-${s.shipment_number}-${st}`}
                        >
                          {st.replace(/_/g, " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {s.milestones.length > 0 && (
                    <ol className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      {s.milestones.map((m, i) => (
                        <li key={i}>
                          {m.status} · {fmtDateTime(m.at)}
                          {m.note ? ` · ${m.note}` : ""} {m.source === "manual" && "· manual"}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DispatchQueueView() {
  const { data, isLoading } = useQuery({ queryKey: ["ops-dispatch"], queryFn: () => apiGet<DispatchQueue>("/ops/dispatch-queue") });
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3" data-testid="ops-stats">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Awaiting movement</p>
          <p className="mt-2 font-heading text-2xl font-black" data-testid="ops-stat-queue">{data?.total ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock exceptions</p>
          <p className="mt-2 font-heading text-2xl font-black" data-testid="ops-stat-exceptions">{data?.stock_exceptions ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">captured payment without allocatable stock</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Courier integration</p>
          <p className="mt-2 font-heading text-lg font-black" data-testid="ops-stat-courier">Not connected</p>
          <p className="mt-1 text-xs text-muted-foreground">all tracking updates are manual</p>
        </div>
      </div>

      <Panel title="Dispatch queue" testId="ops-queue-panel" note="Only verified paid orders appear here — an unpaid order can never be dispatched.">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading queue…</p>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="ops-queue-empty">
            Nothing to dispatch — every paid order is delivered or closed.
          </p>
        ) : (
          <div className="grid gap-4">
            {data.rows.map((r) => (
              <OrderDispatchCard key={r.order_id} row={r} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReturnsView() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ops-returns"], queryFn: () => apiGet<{ total: number; rows: ReturnRequest[] }>("/ops/returns") });
  const patch = useMutation({
    mutationFn: ({ rid, status, restock }: { rid: string; status: string; restock?: boolean }) =>
      apiPatch(`/ops/returns/${rid}`, { status, restock: !!restock, note: `Moved to ${status}` }),
    onSuccess: () => {
      toast.success("Return updated");
      qc.invalidateQueries({ queryKey: ["ops-returns"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transition rejected"),
  });

  return (
    <Panel
      title={`Returns, trial & warranty (${data?.total ?? 0})`}
      testId="ops-returns-panel"
      note="Restock happens only on an inspected, approved return — never automatically. Owner/Admin only."
    >
      {!data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="ops-returns-empty">
          No return or trial requests yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {data.rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4" data-testid={`ops-return-${r.request_number}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {r.request_number} · {r.kind} · order {r.order_number}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    raised by {r.raised_by} ({r.raised_by_role}) · policy {r.policy_version}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" data-testid={`ops-return-status-${r.request_number}`}>{r.status}</Badge>
                  {r.restocked && <Badge className="bg-brand-leaf">restocked</Badge>}
                  {["approved", "received", "inspected", "rejected"].map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={r.status === st || patch.isPending}
                      onClick={() => patch.mutate({ rid: r.id, status: st })}
                      data-testid={`ops-return-${r.request_number}-${st}`}
                    >
                      {st}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    className="min-h-11"
                    disabled={r.restocked || r.status !== "inspected" || patch.isPending}
                    onClick={() => patch.mutate({ rid: r.id, status: "restocked", restock: true })}
                    data-testid={`ops-return-${r.request_number}-restock`}
                  >
                    Restock
                  </Button>
                </div>
              </div>
              {r.trail.length > 0 && (
                <ol className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  {r.trail.map((t, i) => (
                    <li key={i}>
                      {t.status} · {t.actor} · {fmtDateTime(t.at)}
                      {t.note ? ` · ${t.note}` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function OpsConsole() {
  return (
    <ConsoleLayout area="Order operations" title="Order Operations" allowedRoles={OPS_ROLES} nav={NAV}>
      <Routes>
        <Route index element={<DispatchQueueView />} />
        <Route path="returns" element={<ReturnsView />} />
      </Routes>
    </ConsoleLayout>
  );
}
