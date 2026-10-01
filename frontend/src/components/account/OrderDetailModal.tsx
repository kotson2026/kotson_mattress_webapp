import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Truck, Package, CheckCircle2, Star, ExternalLink, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types";
import { fmtDate, inr } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";
import ReviewModal, { type ReviewTargetItem } from "./ReviewModal";

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onReviewSubmitted?: () => void;
}

// ORDER STATUS FLOW: Confirmed → Processing → Shipped → Out for Delivery → Delivered
const FLOW_STEPS = [
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onReviewSubmitted,
}: OrderDetailModalProps) {
  const [reviewTarget, setReviewTarget] = useState<ReviewTargetItem | null>(null);

  // Fetch real shipments for this order (strictly existing data, no fake tracking)
  const { data: shipments } = useQuery({
    queryKey: ["order-shipments", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("order_id", order.id);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!order?.id && isOpen,
  });

  // Fetch customer's existing reviews for this order
  const { data: reviews, refetch: refetchReviews } = useQuery({
    queryKey: ["order-reviews", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("order_id", order.id);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!order?.id && isOpen,
  });

  if (!order) return null;

  const rawFulfilment = (order.fulfilment_status || "").toLowerCase();
  const isPaid = order.payment_status === "paid";
  const isCancelled = order.status === "CANCELLED" || rawFulfilment === "cancelled";
  const isRefunded = order.payment_status === "refunded";

  // Genuine delivery validation
  const isDelivered =
    isPaid &&
    !isCancelled &&
    !isRefunded &&
    (rawFulfilment === "delivered" || rawFulfilment === "completed");

  // Determine current active step in flow:
  // Confirmed (0), Processing (1), Shipped (2), Out for Delivery (3), Delivered (4)
  let currentStepIndex = 0;
  if (isDelivered) {
    currentStepIndex = 4;
  } else if (rawFulfilment === "out_for_delivery") {
    currentStepIndex = 3;
  } else if (rawFulfilment === "shipped" || rawFulfilment === "dispatched") {
    currentStepIndex = 2;
  } else if (rawFulfilment === "processing" || isPaid) {
    currentStepIndex = 1;
  }

  const handleOpenReview = (item: any) => {
    const existing = reviews?.find(
      (r: any) =>
        r.order_item_id === (item.variant_id || item.sku || item.product_id) ||
        r.product_id === item.product_id ||
        r.variant_id === item.variant_id
    );

    setReviewTarget({
      orderId: order.id,
      orderNumber: order.order_number,
      orderItemId: item.variant_id || item.sku || item.product_id,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      variantTitle: [item.size, item.thickness, item.firmness, item.title].filter(Boolean).join(" · "),
      existingReview: existing
        ? {
            id: existing.id,
            rating: existing.rating,
            feedback: existing.feedback,
            media_urls: existing.media_urls || [],
          }
        : null,
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" data-testid="order-detail-modal">
          <DialogHeader className="border-b border-[#E4E9E2] pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065]">
                  Order Details
                </span>
                <DialogTitle className="font-heading text-2xl font-bold text-[#11291F]">
                  #{order.order_number}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#666666] mt-0.5">
                  Placed on {fmtDate(order.created_at)}
                </DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isPaid ? "default" : "outline"}
                  className={
                    isPaid
                      ? "bg-[#EAF3E7] text-[#3E6B4B] border-transparent font-medium"
                      : "border-[#D3DCD0] text-[#666666]"
                  }
                  data-testid="order-payment-status"
                >
                  Payment: {order.payment_status}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-[#F4F6F2] text-[#11291F] font-medium capitalize"
                  data-testid="order-fulfilment-status"
                >
                  {rawFulfilment.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* ─────────────────────────────────────────────────────────────
                ORDER STATUS FLOW: Confirmed → Processing → Shipped → Out for Delivery → Delivered
                ───────────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-[#E4E9E2] bg-[#F7F9F6] p-4.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#666666] block mb-3">
                Tracking &amp; Shipment Status
              </span>

              {isCancelled ? (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 text-xs font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>This order has been cancelled.</span>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {FLOW_STEPS.map((step, idx) => {
                      const isComplete = currentStepIndex >= idx;
                      const isCurrent = currentStepIndex === idx;
                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1 text-center relative z-10">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                              isComplete
                                ? "bg-[#467065] text-white ring-2 ring-[#467065]/20"
                                : "bg-[#E4E9E2] text-[#888888]"
                            }`}
                          >
                            {isComplete ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                          </div>
                          <span
                            className={`mt-2 text-[11px] font-semibold ${
                              isCurrent
                                ? "text-[#11291F] font-bold"
                                : isComplete
                                ? "text-[#467065]"
                                : "text-[#888888]"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Connecting line */}
                  <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-[#E4E9E2] -z-0" />
                </div>
              )}

              {/* Real Shipment Details (Only if genuine shipment exists) */}
              {shipments && shipments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#E4E9E2] space-y-2">
                  {shipments.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E4E9E2] bg-white p-3 text-xs"
                      data-testid={`shipment-${s.shipment_number}`}
                    >
                      <div>
                        <div className="font-semibold text-[#11291F] flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-[#467065]" />
                          <span>{s.carrier || "Courier Express"}</span>
                          {s.tracking_reference && (
                            <span className="font-mono text-[#666666]">({s.tracking_reference})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#777777] mt-0.5">
                          Status: <span className="font-medium text-[#11291F] capitalize">{s.status || "In transit"}</span>
                        </div>
                      </div>

                      {s.tracking_url && (
                        <a
                          href={s.tracking_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#467065] hover:underline"
                        >
                          <span>Track Package</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                PURCHASED PRODUCTS & VERIFIED REVIEW CTAS
                ───────────────────────────────────────────────────────────── */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#666666] mb-3">
                Purchased Items ({order.items.length})
              </h4>

              <div className="divide-y divide-[#E4E9E2] rounded-xl border border-[#E4E9E2] bg-white overflow-hidden">
                {order.items.map((item, idx) => {
                  const existingReview = reviews?.find(
                    (r: any) =>
                      r.order_item_id === (item.variant_id || item.sku || item.product_id) ||
                      r.product_id === item.product_id ||
                      r.variant_id === item.variant_id
                  );

                  return (
                    <div
                      key={idx}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-[#FAFBF9]"
                      data-testid={`order-item-${item.product_id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-[#11291F]">
                            {item.product_name}
                          </p>
                          {existingReview && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                              <Star className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" /> Reviewed ({existingReview.rating}★)
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#666666]">
                          {[item.size, item.thickness, item.firmness, item.title].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-[#777777]">
                          Qty: {item.qty} × {inr(Math.round(item.line_total / (item.qty || 1)))} · SKU: {item.sku || "—"}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5">
                        <span className="font-heading font-bold text-sm text-[#11291F] tabular-nums">
                          {inr(item.line_total)}
                        </span>

                        {/* ONLY when genuinely DELIVERED show "Rate & Review Product" */}
                        {isDelivered && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenReview(item)}
                            className="h-8 rounded-lg bg-[#467065] hover:bg-[#11291F] text-white text-xs font-semibold shadow-2xs"
                            data-testid={`btn-review-${item.product_id}`}
                          >
                            <Star className="mr-1.5 h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                            {existingReview ? "Edit Your Review" : "Rate & Review Product"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                AMOUNTS & ADDRESS
                ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-[#E4E9E2] bg-[#FAFBF9] p-3.5 space-y-1.5">
                <span className="font-bold text-[#666666] uppercase tracking-wider text-[10px] block">
                  Delivery Address
                </span>
                <p className="font-semibold text-[#11291F]">{order.address?.full_name}</p>
                <p className="text-[#666666] leading-relaxed">
                  {order.address?.line1}
                  {order.address?.line2 ? `, ${order.address.line2}` : ""}
                  <br />
                  {order.address?.city}, {order.address?.state} {order.address?.pincode}
                  <br />
                  Phone: {order.address?.phone}
                </p>
              </div>

              <div className="rounded-xl border border-[#E4E9E2] bg-[#FAFBF9] p-3.5 space-y-1.5">
                <span className="font-bold text-[#666666] uppercase tracking-wider text-[10px] block">
                  Payment Summary
                </span>
                <div className="flex justify-between text-[#666666]">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">{inr(order.amounts?.subtotal || 0)}</span>
                </div>
                {order.amounts?.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="tabular-nums">−{inr(order.amounts.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#11291F] pt-1.5 border-t border-[#E4E9E2]">
                  <span>Total Paid:</span>
                  <span className="tabular-nums">{inr(order.amounts?.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verified Product Review Submission Modal */}
      <ReviewModal
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        target={reviewTarget}
        onSuccess={() => {
          refetchReviews();
          if (onReviewSubmitted) onReviewSubmitted();
        }}
      />
    </>
  );
}
