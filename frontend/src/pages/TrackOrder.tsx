import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import type { TrackOut } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  const track = useMutation({
    mutationFn: () => apiPost<TrackOut>("/track-order", { order_number: orderNumber, email }),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Track your order</h1>
        <p className="mt-2 text-muted-foreground">Enter your order number and the email used at checkout.</p>

        <form
          className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            track.mutate();
          }}
        >
          <div>
            <Label htmlFor="track-number">Order number</Label>
            <Input id="track-number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="KS00001" required className="mt-1.5 min-h-11" data-testid="track-order-number-input" />
          </div>
          <div>
            <Label htmlFor="track-email">Email</Label>
            <Input id="track-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 min-h-11" data-testid="track-email-input" />
          </div>
          <Button type="submit" size="lg" className="min-h-12" disabled={track.isPending} data-testid="track-submit-button">
            {track.isPending ? "Looking up…" : "Track order"}
          </Button>
        </form>

        {track.isError && (
          <p className="mt-4 text-sm text-destructive" data-testid="track-error">
            No order found for that order number and email.
          </p>
        )}

        {track.data && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="track-result">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-heading text-2xl font-bold">{track.data.order_number}</p>
              <div className="flex gap-2">
                <Badge variant={track.data.payment_status === "paid" ? "default" : "outline"}>Payment: {track.data.payment_status}</Badge>
                <Badge variant="secondary">{track.data.fulfilment_status.replace(/_/g, " ")}</Badge>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Placed {fmtDateTime(track.data.placed_at)}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {track.data.items.map((i, n) => (
                <li key={n} className="text-muted-foreground">{i.product_name} × {i.qty}</li>
              ))}
            </ul>
            <ol className="mt-6 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              {track.data.events.map((e, n) => (
                <li key={n}>
                  <span className="font-medium text-foreground">{e.type.replace(/_/g, " ")}</span> — {e.detail} · {fmtDateTime(e.at)}
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
