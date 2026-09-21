import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Dashboard, Order, Product } from "@/lib/types";
import { fmtDateTime, inr } from "@/lib/format";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NAV = [
  { to: "/manager", label: "Fulfilment queue" },
  { to: "/manager/stock", label: "Stock & recount" },
  { to: "/manager/catalog", label: "Catalog (read-only)" },
];

function QueueView() {
  const qc = useQueryClient();
  const { data: dash } = useQuery({ queryKey: ["manager-dashboard"], queryFn: () => apiGet<Dashboard>("/admin/dashboard") });
  const { data: orders } = useQuery({ queryKey: ["manager-orders"], queryFn: () => apiGet<Order[]>("/admin/orders?payment=paid") });

  const transition = useMutation({
    mutationFn: (p: { id: string; to: string }) => apiPost(`/admin/orders/${p.id}/transition`, { to: p.to }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["manager-orders"] }); toast.success("Fulfilment updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transition not permitted"),
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3" data-testid="manager-stats">
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Paid orders</p><p className="mt-2 font-heading text-2xl font-black">{dash?.paid_orders ?? "—"}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Orders (7d)</p><p className="mt-2 font-heading text-2xl font-black">{dash?.orders_week ?? "—"}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Low-stock alerts</p><p className="mt-2 font-heading text-2xl font-black">{dash?.low_stock.length ?? "—"}</p></div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6" data-testid="manager-queue">
        <h2 className="font-heading text-lg font-bold">Paid orders awaiting fulfilment</h2>
        {(orders ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing in the queue. Verified paid orders appear here automatically.</p>
        ) : (
          <Table className="mt-4">
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Items</TableHead><TableHead>State</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Transition</TableHead></TableRow></TableHeader>
            <TableBody>
              {(orders ?? []).map((o) => (
                <TableRow key={o.id} data-testid={`manager-order-${o.order_number}`}>
                  <TableCell>
                    <p className="font-medium">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</p>
                  </TableCell>
                  <TableCell className="text-xs">{o.items.map((i) => `${i.product_name} ×${i.qty}`).join(", ")}</TableCell>
                  <TableCell><Badge variant="secondary">{o.fulfilment_status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{inr(o.amounts.total)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {["processing", "shipped", "delivered"].map((to) => (
                        <Button key={to} variant="outline" size="xs" onClick={() => transition.mutate({ id: o.id, to })} data-testid={`manager-order-${o.order_number}-${to}`}>
                          {to}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Managers can move orders through processing → shipped → delivered only. Cancellations, refunds, pricing, CMS and staff roles are
          not available in this workspace.
        </p>
      </section>
    </div>
  );
}

function StockView() {
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["manager-products"], queryFn: () => apiGet<Product[]>("/admin/products") });
  const [form, setForm] = useState({ variant_id: "", delta: "", reason: "" });

  const adjust = useMutation({
    mutationFn: () => apiPost("/admin/inventory/adjust", { variant_id: form.variant_id, delta: Number(form.delta), reason: form.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-products"] });
      setForm({ variant_id: "", delta: "", reason: "" });
      toast.success("Recount logged");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Adjustment rejected"),
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-card p-6" data-testid="manager-recount">
        <h2 className="font-heading text-lg font-bold">Stock recount</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto]">
          <div><Label>Variant id</Label><Input value={form.variant_id} onChange={(e) => setForm((f) => ({ ...f, variant_id: e.target.value }))} className="mt-1.5 min-h-11" data-testid="manager-adjust-variant-input" /></div>
          <div><Label>Delta</Label><Input value={form.delta} onChange={(e) => setForm((f) => ({ ...f, delta: e.target.value }))} inputMode="numeric" className="mt-1.5 min-h-11" data-testid="manager-adjust-delta-input" /></div>
          <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="mt-1.5 min-h-11" data-testid="manager-adjust-reason-input" /></div>
          <Button className="self-end min-h-11" onClick={() => adjust.mutate()} disabled={!form.variant_id || !form.delta || form.reason.length < 3} data-testid="manager-adjust-submit">Log recount</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Every adjustment records old/new value, actor, timestamp and reason, and never bypasses active reservations.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6" data-testid="manager-stock-table">
        <h2 className="font-heading text-lg font-bold">Stock levels</h2>
        <Table className="mt-4">
          <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Free</TableHead><TableHead>Id</TableHead></TableRow></TableHeader>
          <TableBody>
            {(products ?? []).flatMap((p) =>
              p.variants.map((v) => (
                <TableRow key={v.id} data-testid={`manager-stock-${v.sku}`}>
                  <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                  <TableCell className="text-xs">{p.name}</TableCell>
                  <TableCell className="text-xs">{[v.size, v.thickness, v.firmness].filter(Boolean).join(" · ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.reserved}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.free_stock}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">{v.id.slice(0, 8)}…</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function CatalogReadOnly() {
  const { data: products } = useQuery({ queryKey: ["manager-products"], queryFn: () => apiGet<Product[]>("/admin/products") });
  return (
    <section className="rounded-2xl border border-border bg-card p-6" data-testid="manager-catalog">
      <h2 className="font-heading text-lg font-bold">Catalog (read-only)</h2>
      <p className="mt-1 text-xs text-muted-foreground">Prices are visible but not editable in the manager workspace.</p>
      <Table className="mt-4">
        <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Variants</TableHead><TableHead className="text-right">From</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
        <TableBody>
          {(products ?? []).map((p) => (
            <TableRow key={p.id} data-testid={`manager-catalog-${p.slug}`}>
              <TableCell>{p.name}</TableCell>
              <TableCell className="text-xs">{p.category_slug}</TableCell>
              <TableCell className="tabular-nums">{p.variants.length}</TableCell>
              <TableCell className="text-right tabular-nums">{p.price_from !== null ? inr(p.price_from) : "—"}</TableCell>
              <TableCell><Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "active" : "inactive"}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export default function ManagerConsole() {
  return (
    <ConsoleLayout area="Manager" title="Operations & fulfilment" allowedRoles={["owner", "admin", "manager"]} nav={NAV}>
      <Routes>
        <Route index element={<QueueView />} />
        <Route path="stock" element={<StockView />} />
        <Route path="catalog" element={<CatalogReadOnly />} />
      </Routes>
    </ConsoleLayout>
  );
}
