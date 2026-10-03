import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { PublicTracking } from "@/lib/crmTypes";
import { fmtDateTime } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");

  const track = useMutation({
    // Shipment-aware tracking: returns canonical milestones and labels courier updates.
    mutationFn: () =>
      apiGet<PublicTracking>(`/ops/track/${encodeURIComponent(orderNumber.trim())}`),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Track your order</h1>
        <p className="mt-2 text-muted-foreground">Enter your order number or ID to track delivery status.</p>

        <form
          className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (orderNumber.trim()) {
              track.mutate();
            }
          }}
        >
          <div>
            <Label htmlFor="track-number">Order number or ID</Label>
            <Input
              id="track-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="e.g. KS00027"
              required
              className="mt-1.5 min-h-11"
              data-testid="track-order-number-input"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="min-h-12"
            disabled={track.isPending || !orderNumber.trim()}
            data-testid="track-submit-button"
          >
            {track.isPending ? "Looking up…" : "Track order"}
          </Button>
        </form>

        {track.isError && (
          <p className="mt-4 text-sm text-destructive" data-testid="track-error">
            {track.error instanceof Error ? track.error.message : "No order found for that order number."}
          </p>
        )}

        {track.data?.order_number && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="track-result">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-heading text-2xl font-bold">{track.data.order_number}</p>
              <div className="flex gap-2">
                <Badge variant={track.data.payment_status === "paid" ? "default" : "outline"}>
                  Payment: {track.data.payment_status || "pending"}
                </Badge>
                <Badge variant="secondary">
                  {(track.data.fulfilment_status || "processing").replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
            {track.data.placed_at && (
              <p className="mt-1 text-xs text-muted-foreground">Placed {fmtDateTime(track.data.placed_at)}</p>
            )}
            <ul className="mt-4 space-y-1 text-sm">
              {(track.data.items || []).map((i, n) => (
                <li key={n} className="text-muted-foreground">
                  {i.product_name} × {i.qty}
                </li>
              ))}
            </ul>
            <ol className="mt-6 space-y-3 border-t border-border pt-4" data-testid="track-shipments">
              {!track.data.shipments || track.data.shipments.length === 0 ? (
                <li className="text-xs text-muted-foreground" data-testid="track-no-shipments">
                  No shipment has been created yet. You'll see dispatch milestones here once your order is packed.
                </li>
              ) : (
                track.data.shipments.map((s) => (
                  <li key={s.shipment_number} className="rounded-xl border border-border p-4" data-testid={`track-shipment-${s.shipment_number}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{s.shipment_number}</p>
                      <Badge variant="secondary" data-testid={`track-shipment-status-${s.shipment_number}`}>
                        {(s.status || "ready").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(s.items || []).map((i) => `${i.product_name} × ${i.qty}`).join(", ")}
                    </p>
                    {s.carrier && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.carrier}
                        {s.tracking_reference ? ` · ${s.tracking_reference}` : ""}
                      </p>
                    )}
                    {s.tracking_url && (
                      <a
                        href={s.tracking_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-block text-xs font-semibold text-brand-deep underline"
                        data-testid={`track-shipment-link-${s.shipment_number}`}
                      >
                        Open carrier tracking
                      </a>
                    )}
                    <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {(s.milestones || []).map((m, n) => (
                        <li key={n}>
                          <span className="font-medium text-foreground">{(m.status || "").replace(/_/g, " ")}</span>
                          {m.at ? ` · ${fmtDateTime(m.at)}` : ""}
                          {m.note ? ` · ${m.note}` : ""}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))
              )}
            </ol>
            {track.data.tracking_note && (
              <p className="mt-4 text-xs text-muted-foreground" data-testid="track-manual-note">
                {track.data.tracking_note}
              </p>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
