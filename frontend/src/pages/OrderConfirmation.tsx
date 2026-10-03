import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  RefreshCw,
  Phone,
  MessageCircle,
  Truck,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  Check,
  ShoppingBag,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Order } from "@/lib/types";
import { inr, fmtDateIST, fmtTimeIST } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReviewModal, { type ReviewTargetItem } from "@/components/account/ReviewModal";

export default function OrderConfirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t");
  const [reviewTarget, setReviewTarget] = useState<ReviewTargetItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll while payment is pending so webhook-confirmed payment reflects automatically
  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", id, token],
    queryFn: () => apiGet<Order>(`/orders/${id}${token ? `?t=${token}` : ""}`),
    refetchInterval: (q) => (q.state.data?.payment_status === "pending" ? 5000 : false),
    retry: false,
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const paymentStatus = (order?.payment_status || "pending").toLowerCase();
  const isPaid = paymentStatus === "paid";
  const isFailed = paymentStatus === "failed";
  const isPending = !isPaid && !isFailed;

  const rawFulfilment = (order?.fulfilment_status || (isPaid ? "processing" : "awaiting_payment")).toLowerCase();

  // Unified display status for Order
  const displayOrderStatus = (() => {
    if (isFailed) return "Payment Failed";
    if (rawFulfilment === "delivered") return "Delivered";
    if (rawFulfilment === "out_for_delivery") return "Out for Delivery";
    if (rawFulfilment === "shipped") return "Shipped";
    if (rawFulfilment === "processing") return "Processing";
    if (rawFulfilment === "cancelled") return "Cancelled";
    if (isPaid) return "Confirmed";
    return "Awaiting Payment";
  })();

  // 5-Stage Order Progress Tracker
  // Order Placed -> Payment Confirmed -> Processing -> Shipped -> Delivered
  const trackerStages = [
    { key: "placed", label: "Order Placed", done: true, current: isPending },
    {
      key: "payment",
      label: "Payment Confirmed",
      done: isPaid,
      current: isPaid && rawFulfilment !== "shipped" && rawFulfilment !== "delivered" && rawFulfilment !== "processing",
    },
    {
      key: "processing",
      label: "Processing",
      done: isPaid && ["processing", "shipped", "out_for_delivery", "delivered"].includes(rawFulfilment),
      current: isPaid && rawFulfilment === "processing",
    },
    {
      key: "shipped",
      label: "Shipped",
      done: ["shipped", "out_for_delivery", "delivered"].includes(rawFulfilment),
      current: rawFulfilment === "shipped" || rawFulfilment === "out_for_delivery",
    },
    {
      key: "delivered",
      label: "Delivered",
      done: rawFulfilment === "delivered",
      current: rawFulfilment === "delivered",
    },
  ];

  // Normalized financial values
  const subtotalPaise = Number(
    order?.amounts?.subtotal ??
    (order as any)?.subtotal_paise ??
    (order?.amounts as any)?.subtotal_sale_paise ??
    0
  );
  const totalCouponDiscountPaise = Number((order?.amounts as any)?.total_coupon_discount_paise || 0);
  const totalReferralDiscountPaise = Number((order?.amounts as any)?.total_referral_discount_paise || 0);
  const generalDiscountPaise = Number(order?.amounts?.discount ?? (order as any)?.discount_paise ?? 0);

  const couponDiscount = totalCouponDiscountPaise > 0 ? totalCouponDiscountPaise : (generalDiscountPaise > 0 && totalReferralDiscountPaise === 0 ? generalDiscountPaise : 0);
  const referralDiscount = totalReferralDiscountPaise > 0 ? totalReferralDiscountPaise : 0;

  const taxPaise = Number(order?.amounts?.tax ?? (order?.amounts as any)?.tax_paise ?? 0);
  const shippingPaise = Number(order?.amounts?.shipping ?? (order?.amounts as any)?.shipping_paise ?? 0);
  const totalPaise = Number(order?.amounts?.total ?? (order as any)?.total_paise ?? (order?.amounts as any)?.total_paise ?? 0);

  const dt = order?.created_at;
  const orderNumber = order?.order_number || "";

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#11291F]">
      <StorefrontHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading && (
          <div className="mx-auto max-w-3xl space-y-6 py-12">
            <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-[#E4E9E2]/60" />
            <div className="h-40 animate-pulse rounded-2xl bg-[#E4E9E2]/40" />
            <div className="h-64 animate-pulse rounded-2xl bg-[#E4E9E2]/40" />
          </div>
        )}

        {isError && (
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-dashed border-[#D3DCD0] bg-white p-12 text-center shadow-xs"
            data-testid="confirmation-not-found"
          >
            <AlertTriangle className="mx-auto h-10 w-10 text-[#467065]" />
            <h1 className="mt-4 font-serif text-2xl font-bold text-[#11291F]">Order Not Available</h1>
            <p className="mt-2 text-sm text-[#666666]">
              This order could not be loaded or may belong to another session. You can track your shipment anytime with your order ID.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/track-order"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-[#467065] hover:bg-[#11291F] px-4 text-xs font-semibold text-white transition-colors"
              >
                Track an Order
              </Link>
              <Link
                to="/collections"
                className="inline-flex h-9 items-center justify-center rounded-xl border border-[#D3DCD0] bg-white hover:bg-[#F0F3EF] px-4 text-xs font-medium text-[#11291F] transition-colors"
              >
                Browse Mattresses
              </Link>
            </div>
          </div>
        )}

        {order && (
          <div className="space-y-8">
            {/* ─────────────────────────────────────────────────────────────
                1. DYNAMIC PAGE HEADER
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E9E2] pb-6">
              <div className="flex items-start gap-4">
                {isPaid ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3E7] text-[#3E6B4B]">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </div>
                ) : isFailed ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                    <AlertTriangle className="h-7 w-7" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FBF8EF] text-amber-700 border border-amber-200">
                    <Clock className="h-6 w-6 animate-pulse" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#11291F]" data-testid="confirmation-heading">
                    {isPaid
                      ? "Order confirmed"
                      : isFailed
                      ? "Payment unsuccessful"
                      : "Order received — awaiting payment"}
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-[#666666] max-w-xl" data-testid="confirmation-status-note">
                    {isPaid
                      ? "Your payment has been successfully confirmed. We're preparing your order for the next step."
                      : isFailed
                      ? "We were unable to verify your payment. Please retry payment or contact our support team."
                      : "This order is saved, but no payment has been verified yet. If you just paid, confirmation may still be processing."}
                  </p>
                </div>
              </div>

              {/* Order Number & Placed Date Capsule */}
              <div className="flex flex-wrap items-center gap-2 sm:text-right">
                <div className="rounded-xl border border-[#E4E9E2] bg-white px-4 py-2.5 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#666666]">Order ID</p>
                  <p className="font-mono text-base font-bold text-[#11291F]" data-testid="confirmation-order-number">
                    #{order.order_number}
                  </p>
                  <p className="text-[10px] text-[#777777]">
                    Placed on {fmtDateIST(dt)}, {fmtTimeIST(dt)}
                  </p>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                2. ORDER SUMMARY BADGES BAR
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4E9E2] bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#666666]">Status Summary:</span>
                <Badge
                  variant={isPaid ? "default" : isFailed ? "destructive" : "outline"}
                  className={`text-xs font-medium px-2.5 py-1 ${
                    isPaid
                      ? "bg-[#EAF3E7] text-[#3E6B4B] border-transparent font-semibold"
                      : isFailed
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-[#FBF8EF] text-amber-800 border-amber-300"
                  }`}
                  data-testid="confirmation-payment-badge"
                >
                  Payment: {isPaid ? "Paid" : isFailed ? "Failed" : "Pending"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-[#F4F6F2] text-[#11291F] border border-[#E4E9E2] text-xs font-medium px-2.5 py-1 capitalize"
                  data-testid="confirmation-fulfilment-badge"
                >
                  Order: {displayOrderStatus}
                </Badge>
              </div>

              {/* Verification auto-refresh indicator */}
              {isPending && (
                <div className="flex items-center gap-2 text-xs text-amber-800">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  <span className="font-medium text-[11px]">Checking gateway confirmation automatically</span>
                </div>
              )}
            </div>

            {/* Stock exception banner if present */}
            {order.stock_exception && (
              <div
                className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
                data-testid="confirmation-stock-exception"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <p>
                  Your payment was captured but stock could not be allocated immediately. Our operations team is addressing this exception and will contact you directly with an immediate priority update.
                </p>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                3. ORDER PROGRESS TRACKER
                ───────────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-[#E4E9E2] bg-white p-5 sm:p-6 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#666666] mb-5">
                Order Progress
              </h2>
              <div className="relative">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                  {trackerStages.map((stage, idx) => {
                    const isDone = stage.done;
                    return (
                      <div key={stage.key} className="flex flex-col items-center text-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-2xs ${
                            isDone
                              ? "bg-[#467065] text-white ring-4 ring-[#EAF3E7]"
                              : stage.current
                              ? "bg-amber-100 text-amber-900 border-2 border-amber-400"
                              : "bg-[#F0F3EF] text-[#888888] border border-[#E4E9E2]"
                          }`}
                        >
                          {isDone ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                        </div>
                        <span
                          className={`mt-2 text-xs font-medium ${
                            isDone
                              ? "text-[#11291F] font-bold"
                              : stage.current
                              ? "text-amber-800 font-semibold"
                              : "text-[#888888]"
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Horizontal progress bar for desktop */}
                <div className="hidden sm:block absolute top-4 left-10 right-10 h-0.5 bg-[#E4E9E2] -z-0" />
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                4. MAIN 2-COLUMN LAYOUT (DESKTOP) / STACK (MOBILE)
                ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: ORDER ITEMS + DELIVERY ADDRESS */}
              <div className="lg:col-span-7 space-y-6">
                {/* YOUR ORDER ITEMS CARD */}
                <div className="rounded-2xl border border-[#E4E9E2] bg-white p-5 sm:p-6 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#E4E9E2] pb-3 mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#666666]">
                      Your Order ({order.items?.length || 0})
                    </h2>
                    <span className="text-xs text-[#777777]">Immutable purchase snapshot</span>
                  </div>

                  <ul className="divide-y divide-[#E4E9E2]" data-testid="confirmation-items">
                    {(order.items || []).map((i, idx) => {
                      const itemQty = Number(i.qty || (i as any).quantity || 1);
                      const itemLineTotal = Number(i.line_total ?? (i as any).line_total_paise ?? 0);
                      const itemUnitPrice = Number(
                        i.unit_price ??
                        (i as any).final_unit_price_paise ??
                        (itemQty > 0 ? Math.round(itemLineTotal / itemQty) : 0)
                      );
                      const itemImg = (i as any).image_url || (i as any).image;

                      return (
                        <li
                          key={i.variant_id || idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
                        >
                          <div className="flex items-start gap-3.5">
                            {itemImg ? (
                              <img
                                src={itemImg}
                                alt={i.product_name}
                                className="h-16 w-16 rounded-xl object-cover border border-[#E4E9E2] bg-[#F7F9F6] shrink-0"
                              />
                            ) : (
                              <div className="flex h-16 w-16 rounded-xl bg-[#F0F3EF] border border-[#E4E9E2] items-center justify-center shrink-0 text-[#467065]">
                                <ShoppingBag className="h-6 w-6" />
                              </div>
                            )}
                            <div className="space-y-1">
                              <p className="font-semibold text-sm text-[#11291F]">{i.product_name}</p>
                              <p className="text-xs text-[#666666]">
                                {[i.size, i.thickness, i.firmness, i.title].filter(Boolean).join(" · ")}
                              </p>
                              <p className="text-xs text-[#777777]">
                                SKU: <span className="font-mono">{i.sku || "—"}</span>
                              </p>
                              <p className="text-xs text-[#467065] font-medium">
                                Qty: {itemQty} × {inr(itemUnitPrice)}
                              </p>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                            <span className="font-serif font-bold text-base text-[#11291F] tabular-nums">
                              {inr(itemLineTotal)}
                            </span>

                            {/* Verified Product Review CTA if Delivered */}
                            {isPaid &&
                              order.status !== "CANCELLED" &&
                              (rawFulfilment === "delivered" || rawFulfilment === "completed") && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    setReviewTarget({
                                      orderId: order.id,
                                      orderNumber: order.order_number,
                                      orderItemId: i.variant_id || i.sku || i.product_id,
                                      productId: i.product_id,
                                      variantId: i.variant_id,
                                      productName: i.product_name,
                                      variantTitle: [i.size, i.thickness, i.firmness].filter(Boolean).join(" · "),
                                    })
                                  }
                                  className="h-8 rounded-lg bg-[#467065] hover:bg-[#11291F] text-white text-xs font-semibold shadow-2xs"
                                  data-testid={`btn-review-${i.product_id}`}
                                >
                                  <Star className="mr-1 h-3 w-3 fill-amber-300 text-amber-300" />
                                  Rate &amp; Review
                                </Button>
                              )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* DELIVERY ADDRESS CARD */}
                <div className="rounded-2xl border border-[#E4E9E2] bg-white p-5 sm:p-6 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-[#E4E9E2] pb-3 mb-3">
                    <Truck className="h-4 w-4 text-[#467065]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#666666]">
                      Delivery Address
                    </h2>
                  </div>
                  <address
                    className="not-italic text-xs text-[#555555] leading-relaxed space-y-1"
                    data-testid="confirmation-address"
                  >
                    <p className="font-semibold text-sm text-[#11291F]">
                      {order.address?.full_name || (order as any).shipping_address?.name || "Customer"}
                    </p>
                    <p>{order.address?.line1 || (order as any).shipping_address?.address_line1}</p>
                    {(order.address?.line2 || (order as any).shipping_address?.address_line2) && (
                      <p>{order.address?.line2 || (order as any).shipping_address?.address_line2}</p>
                    )}
                    <p>
                      {[order.address?.city, order.address?.state, order.address?.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="pt-1 text-[#11291F] font-medium">
                      Phone: {order.address?.phone || (order as any).shipping_address?.phone || "—"}
                    </p>
                  </address>
                </div>
              </div>

              {/* RIGHT COLUMN: PAYMENT SUMMARY + VERIFICATION + SUPPORT + ACTIONS */}
              <div className="lg:col-span-5 space-y-6">
                {/* PAYMENT SUMMARY CARD */}
                <div className="rounded-2xl border border-[#E4E9E2] bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#666666] border-b border-[#E4E9E2] pb-3">
                    Payment Summary
                  </h2>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#666666]">
                      <dt>Subtotal</dt>
                      <dd className="tabular-nums font-medium text-[#11291F]">{inr(subtotalPaise)}</dd>
                    </div>

                    {referralDiscount > 0 && (
                      <div className="flex justify-between text-emerald-800">
                        <dt>Referral Discount</dt>
                        <dd className="tabular-nums font-medium">−{inr(referralDiscount)}</dd>
                      </div>
                    )}

                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-emerald-800">
                        <dt>Coupon Discount</dt>
                        <dd className="tabular-nums font-medium">−{inr(couponDiscount)}</dd>
                      </div>
                    )}

                    <div className="flex justify-between text-[#666666]">
                      <dt>GST / Taxes</dt>
                      <dd className="tabular-nums text-[#11291F]">
                        {taxPaise > 0 ? inr(taxPaise) : "Included"}
                      </dd>
                    </div>

                    <div className="flex justify-between text-[#666666]">
                      <dt>Shipping</dt>
                      <dd className="tabular-nums text-[#3E6B4B] font-semibold">
                        {shippingPaise > 0 ? inr(shippingPaise) : "Free Delivery"}
                      </dd>
                    </div>

                    <div className="flex justify-between border-t border-[#E4E9E2] pt-3 text-sm font-bold text-[#11291F]">
                      <dt>{isPaid ? "Total Paid" : "Amount Payable"}</dt>
                      <dd className="font-serif text-lg tabular-nums text-[#11291F]" data-testid="confirmation-total">
                        {inr(totalPaise)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* PAYMENT VERIFICATION CARD */}
                {isPending ? (
                  <div className="rounded-2xl border border-amber-200 bg-[#FDFBF7] p-5 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Clock className="h-4 w-4 animate-spin" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Payment Verification</h3>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#11291F]">Waiting for gateway confirmation</p>
                      <p className="mt-1 text-xs text-[#666666] leading-relaxed">
                        Your payment status will update automatically once our payment partner confirms your payment.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="w-full bg-[#11291F] hover:bg-[#467065] text-white text-xs font-semibold h-9 rounded-xl shadow-2xs gap-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                      {isRefreshing ? "Checking Status..." : "Refresh Status"}
                    </Button>
                  </div>
                ) : isPaid ? (
                  <div className="rounded-2xl border border-emerald-200 bg-[#F4F9F4] p-5 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 text-[#3E6B4B]">
                      <ShieldCheck className="h-5 w-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Payment Confirmed ✓</h3>
                    </div>
                    <p className="text-xs text-[#555555] leading-relaxed">
                      Your payment was securely verified and credited to your order. We are now preparing your items for delivery.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertTriangle className="h-5 w-5" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Payment Failed</h3>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      Your payment attempt could not be verified by the gateway. If money was debited from your bank account, Razorpay will automatically reverse it within 3-5 business days.
                    </p>
                  </div>
                )}

                {/* DEDICATED SUPPORT CARD */}
                <div className="rounded-2xl border border-[#E4E9E2] bg-white p-5 shadow-2xs space-y-3 text-xs">
                  <div className="space-y-1">
                    <h3 className="font-bold text-[#11291F]">Need help with your order?</h3>
                    <p className="text-[#666666]">Our concierge team is here to help with any questions.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <a
                      href="tel:8009800936"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E4E9E2] bg-[#FAFBF9] hover:bg-[#F0F3EF] px-3 py-2 text-xs font-semibold text-[#11291F] transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#467065]" />
                      <span>8009800936</span>
                    </a>
                    <a
                      href={`https://wa.me/918009800936?text=Hi%20Kotson%2C%20I%20need%20help%20with%20my%20order%20${encodeURIComponent(orderNumber)}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                      <span>WhatsApp Us</span>
                    </a>
                  </div>
                </div>

                {/* PRIMARY & SECONDARY ACTIONS */}
                <div className="space-y-2 pt-2">
                  <Link
                    to={`/track-order?order=${encodeURIComponent(orderNumber)}`}
                    className="flex w-full h-11 items-center justify-center rounded-xl bg-[#467065] hover:bg-[#11291F] text-white text-xs font-semibold shadow-xs gap-2 transition-colors"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Track Order
                  </Link>

                  <Link
                    to="/collections"
                    className="flex w-full h-10 items-center justify-center rounded-xl border border-[#D3DCD0] bg-white text-[#11291F] hover:bg-[#F0F3EF] text-xs font-medium transition-colors"
                    data-testid="confirmation-continue-link"
                  >
                    Continue Shopping
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Review Modal for Verified Product Ratings */}
            <ReviewModal
              isOpen={Boolean(reviewTarget)}
              onClose={() => setReviewTarget(null)}
              target={reviewTarget}
            />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
