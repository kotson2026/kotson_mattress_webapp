import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Dealer, DealerOrder } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DealerCatalog {
  org: string;
  terms_status: string;
  note: string;
  products: { slug: string; name: string; tagline: string; variants: { id: string; sku: string; size: string; quote_only: boolean; free_stock: number }[] }[];
}

export default function DealerConsole() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [form, setForm] = useState({ org_name: "", gstin: "", territory: "", phone: "" });
  const [lines, setLines] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const { data: dealer, isError: noDealer } = useQuery({
    queryKey: ["dealer-me"],
    queryFn: () => apiGet<Dealer>("/dealer/me"),
    enabled: !!me,
    retry: false,
  });
  const approved = dealer?.status === "approved";

  const { data: catalog } = useQuery({
    queryKey: ["dealer-catalog"],
    queryFn: () => apiGet<DealerCatalog>("/dealer/catalog"),
    enabled: approved,
    retry: false,
  });
  const { data: orders } = useQuery({
    queryKey: ["dealer-orders"],
    queryFn: () => apiGet<DealerOrder[]>("/dealer/orders"),
    enabled: !!dealer,
  });

  const apply = useMutation({
    mutationFn: () => apiPost("/dealer/apply", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dealer-me"] }); toast.success("Application submitted for owner approval"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not apply"),
  });

  const requestQuote = useMutation({
    mutationFn: () =>
      apiPost("/dealer/orders", {
        items: Object.entries(lines).filter(([, q]) => q > 0).map(([variant_id, qty]) => ({ variant_id, qty })),
        note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-orders"] });
      setLines({});
      setNote("");
      toast.success("Quote request submitted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit quote request"),
  });

  if (isLoading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!me) {
    return (
      <div className="min-h-svh">
        <StorefrontHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
          <h1 className="font-heading text-3xl font-black">Dealer portal</h1>
          <p className="mt-2 text-muted-foreground">Sign in with your business account to apply or manage your dealership.</p>
          <Link to="/login" className={buttonVariants({ size: "lg" }) + " mt-6"} data-testid="dealer-login-link">Sign in</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Dealer portal</h1>

        {(!dealer || noDealer) && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="dealer-apply-form">
            <h2 className="font-heading text-lg font-bold">Apply for a dealer account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Applications are reviewed by the owner. Pricing, margins, credit and tax terms are configured per dealer after approval — no
              terms are assumed.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><Label>Organisation name</Label><Input value={form.org_name} onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} className="mt-1.5 min-h-11" data-testid="dealer-org-input" /></div>
              <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} className="mt-1.5 min-h-11" data-testid="dealer-gstin-input" /></div>
              <div><Label>Territory</Label><Input value={form.territory} onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))} className="mt-1.5 min-h-11" data-testid="dealer-territory-input" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5 min-h-11" data-testid="dealer-phone-input" /></div>
            </div>
            <Button className="mt-4 min-h-11" onClick={() => apply.mutate()} disabled={form.org_name.length < 2 || form.gstin.length < 10 || apply.isPending} data-testid="dealer-apply-submit">
              Submit application
            </Button>
          </section>
        )}

        {dealer && (
          <>
            <section className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="dealer-profile">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading text-xl font-bold">{dealer.org_name}</h2>
                <Badge variant={approved ? "default" : "outline"} data-testid="dealer-status-badge">{dealer.status}</Badge>
                <Badge variant="outline">terms: {dealer.terms_status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                GSTIN {dealer.gstin} · Territory {dealer.territory} · {dealer.phone}
              </p>
              {!approved && (
                <p className="mt-3 rounded-xl bg-brand-amber/10 p-4 text-sm text-brand-amber" data-testid="dealer-pending-note">
                  Your application is pending owner approval. The assigned catalog and pricing appear here once approved.
                </p>
              )}
            </section>

            {approved && catalog && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-6" data-testid="dealer-catalog">
                <h2 className="font-heading text-lg font-bold">Assigned catalog</h2>
                <p className="mt-1 text-xs text-muted-foreground">{catalog.note}</p>
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Size</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Available</TableHead><TableHead>Qty</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {catalog.products.flatMap((p) =>
                      p.variants.map((v) => (
                        <TableRow key={v.id} data-testid={`dealer-line-${v.sku}`}>
                          <TableCell className="text-xs">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                          <TableCell className="text-xs">{v.size}</TableCell>
                          <TableCell><Badge variant="outline">quote only</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">{v.free_stock}</TableCell>
                          <TableCell>
                            <Input
                              inputMode="numeric"
                              value={lines[v.id] ?? ""}
                              onChange={(e) => setLines((l) => ({ ...l, [v.id]: Number(e.target.value) || 0 }))}
                              className="min-h-11 w-20"
                              data-testid={`dealer-qty-${v.sku}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes for this quote request…" className="mt-4" data-testid="dealer-note-input" />
                <Button className="mt-3 min-h-11" onClick={() => requestQuote.mutate()} disabled={Object.values(lines).every((q) => !q) || requestQuote.isPending} data-testid="dealer-quote-submit">
                  Request quote
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dealer orders use a separate channel with server-side pricing and never combine with retail referral discounts.
                </p>
              </section>
            )}

            <section className="mt-6 rounded-2xl border border-border bg-card p-6" data-testid="dealer-orders">
              <h2 className="font-heading text-lg font-bold">Your quote requests & orders</h2>
              {(orders ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Submitted</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead>Pricing</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(orders ?? []).map((o) => (
                      <TableRow key={o.id} data-testid={`dealer-order-${o.id}`}>
                        <TableCell className="text-xs">{fmtDateTime(o.created_at)}</TableCell>
                        <TableCell className="text-xs">{o.items.map((i) => `${i.sku} ×${i.qty}`).join(", ")}</TableCell>
                        <TableCell><Badge variant="outline">{o.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-xs">{o.pricing_status.replace(/_/g, " ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
