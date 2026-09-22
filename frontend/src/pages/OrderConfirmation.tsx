import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Order } from "@/lib/types";
import { fmtDateTime, inr } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";

export default function OrderConfirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t");

  // Polls while payment is still pending so a webhook-confirmed payment appears without a reload.
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id, token],
    queryFn: () => apiGet<Order>(`/orders/${id}${token ? `?t=${token}` : ""}`),
    refetchInterval: (q) => (q.state.data?.payment_status === "pending" ? 5000 : false),
    retry: false,
  });

  const paid = order?.payment_status === "paid";

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {isLoading && <div className="h-64 animate-pulse rounded-2xl bg-brand-sand" />}

        {isError && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center" data-testid="confirmation-not-found">
            <h1 className="font-heading text-2xl font-bold">Order not available</h1>
            <p className="mt-2 text-muted-foreground">This order may belong to another account. Try tracking it instead.</p>
            <Link to="/track-order" className="mt-4 inline-block text-brand-deep underline">Track an order</Link>
          </div>
        )}

        {order && (
          <>
            <div className="flex items-start gap-4">
              {paid ? (
                <CheckCircle2 className="mt-1 h-8 w-8 shrink-0 text-brand-leaf" aria-hidden="true" />
              ) : (
                <Clock className="mt-1 h-8 w-8 shrink-0 text-brand-amber" aria-hidden="true" />
              )}
              <div>
                <h1 className="font-heading text-3xl font-black tracking-tight" data-testid="confirmation-heading">
                  {paid ? "Payment confirmed" : "Order received — awaiting payment"}
                </h1>
                <p className="mt-2 text-muted-foreground" data-testid="confirmation-status-note">
                  {paid
                    ? "We verified your payment with the provider on our server. Your order is now being processed."
                    : "This order is saved, but no payment has been verified yet. If you just paid, confirmation may still be processing — this page updates automatically."}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order number</p>
                  <p className="font-heading text-2xl font-bold" data-testid="confirmation-order-number">{order.order_number}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={paid ? "default" : "outline"} data-testid="confirmation-payment-badge">
                    Payment: {order.payment_status}
                  </Badge>
                  <Badge variant="secondary" data-testid="confirmation-fulfilment-badge">
                    Fulfilment: {order.fulfilment_status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Placed {fmtDateTime(order.created_at)}</p>

              {order.stock_exception && (
                <div className="mt-4 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4" data-testid="confirmation-stock-exception">
                  <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm">
                    Your payment was captured but stock could not be allocated. This is flagged as a high-priority exception — our team will
                    contact you with a documented refund or replacement. Fulfilment is on hold.
                  </p>
                </div>
              )}

              <ul className="mt-6 divide-y divide-border" data-testid="confirmation-items">
                {order.items.map((i) => (
                  <li key={i.variant_id} className="flex justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{i.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[i.size, i.thickness, i.firmness].filter(Boolean).join(" · ")} · SKU {i.sku} · Qty {i.qty}
                      </p>
                    </div>
                    <span className="tabular-nums">{inr(i.line_total)}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{inr(order.amounts.subtotal)}</dd></div>
                {order.amounts.discount > 0 && (
                  <div className="flex justify-between text-brand-leaf"><dt>Referral discount</dt><dd className="tabular-nums">−{inr(order.amounts.discount)}</dd></div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">GST</dt>
                  <dd className="tabular-nums">{order.amounts.tax_status === "final" ? inr(order.amounts.tax) : "Pending owner configuration"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="tabular-nums">{order.amounts.shipping_status === "final" ? inr(order.amounts.shipping) : "Pending owner configuration"}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-heading text-lg font-bold">
                  <dt>Total</dt><dd className="tabular-nums" data-testid="confirmation-total">{inr(order.amounts.total)}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-border pt-4 text-sm">
                <p className="font-semibold">Delivery address</p>
                <address className="mt-1 not-italic text-muted-foreground" data-testid="confirmation-address">
                  {order.address.full_name}<br />
                  {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}<br />
                  {order.address.city}, {order.address.state} {order.address.pincode}<br />
                  {order.address.phone}
                </address>
              </div>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Transactional emails are pending a mail provider — your live status always remains available here and on{" "}
              <Link to="/track-order" className="text-brand-deep underline">Track order</Link>.
            </p>
            <Link to="/collections" className="mt-6 inline-block text-brand-deep underline" data-testid="confirmation-continue-link">
              Continue shopping
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
