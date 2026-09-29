import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package, AlertCircle } from "lucide-react";
import type { Order } from "@/lib/types";
import { fmtDate, inr } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyOrdersIllustration from "./EmptyOrdersIllustration";

interface OrdersPanelProps {
  orders: Order[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export default function OrdersPanel({
  orders,
  isLoading,
  isError,
  onRetry,
}: OrdersPanelProps) {
  // Loading State
  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 md:p-12">
        <div className="space-y-4">
          <div className="h-6 w-36 rounded-md bg-[#F4F6F2] animate-pulse" />
          <div className="h-16 w-full rounded-xl bg-[#F8FAF7] animate-pulse" />
          <div className="h-16 w-full rounded-xl bg-[#F8FAF7] animate-pulse" />
        </div>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 md:p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-bold text-[#2D2D2D]">
          Unable to load orders
        </h3>
        <p className="mt-1 text-sm text-[#666666]">
          We encountered an issue loading your past orders. Please try again.
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="mt-4 rounded-xl border-[#CBD6C7] text-sm"
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  const orderList = orders ?? [];

  // Empty Orders State (Matches Reference Design Perfectly)
  if (orderList.length === 0) {
    return (
      <div
        className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 sm:p-12 md:p-16 text-center shadow-[0_1px_4px_rgba(70,112,101,0.02)]"
        data-testid="account-orders-empty"
      >
        <div className="mx-auto flex justify-center">
          <EmptyOrdersIllustration className="w-32 h-32 sm:w-36 sm:h-36" />
        </div>

        <h2 className="mt-3 font-heading text-2xl sm:text-[28px] font-bold text-[#2D2D2D]">
          No orders yet
        </h2>
        <p className="mt-1.5 text-sm sm:text-base text-[#666666]">
          Your Kotson orders will appear here.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            to="/collections"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#467065] px-7 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3B5F56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#467065] focus-visible:ring-offset-2"
            data-testid="account-start-shopping-cta"
          >
            <span>Start shopping</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Populated Orders State (Responsive Table & Stacked Cards)
  return (
    <div
      className="rounded-[20px] border border-[#E4E9E2] bg-white p-6 sm:p-8 md:p-10 shadow-[0_1px_4px_rgba(70,112,101,0.02)]"
      data-testid="account-orders-list"
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[#2D2D2D]">
          Order History ({orderList.length})
        </h2>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[#E9EFE7]">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E9EFE7] bg-[#F7F9F6] text-xs font-semibold uppercase tracking-wider text-[#666666]">
              <th className="py-3.5 px-5">Order #</th>
              <th className="py-3.5 px-4">Date Placed</th>
              <th className="py-3.5 px-4">Payment</th>
              <th className="py-3.5 px-4">Fulfilment</th>
              <th className="py-3.5 px-4 text-right">Total</th>
              <th className="py-3.5 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9EFE7]">
            {orderList.map((o) => (
              <tr
                key={o.id}
                data-testid={`account-order-${o.order_number}`}
                className="transition-colors hover:bg-[#F9FAF8]"
              >
                <td className="py-4 px-5 font-semibold text-[#2D2D2D]">
                  <Link
                    to={`/order/confirmation/${o.id}`}
                    className="hover:text-[#467065] hover:underline"
                  >
                    {o.order_number}
                  </Link>
                </td>
                <td className="py-4 px-4 text-sm text-[#666666]">
                  {fmtDate(o.created_at)}
                </td>
                <td className="py-4 px-4">
                  <Badge
                    variant={o.payment_status === "paid" ? "default" : "outline"}
                    className={
                      o.payment_status === "paid"
                        ? "bg-[#EAF3E7] text-[#3E6B4B] border-transparent font-medium"
                        : "border-[#D3DCD0] text-[#666666]"
                    }
                  >
                    {o.payment_status}
                  </Badge>
                </td>
                <td className="py-4 px-4 text-sm text-[#444444] capitalize">
                  {o.fulfilment_status.replace(/_/g, " ")}
                </td>
                <td className="py-4 px-4 text-right font-medium text-[#2D2D2D] tabular-nums">
                  {inr(o.amounts.total)}
                </td>
                <td className="py-4 px-5 text-right">
                  <Link
                    to={`/order/confirmation/${o.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#467065] hover:underline"
                  >
                    <span>View details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="space-y-4 md:hidden">
        {orderList.map((o) => (
          <div
            key={o.id}
            data-testid={`account-order-mobile-${o.order_number}`}
            className="rounded-xl border border-[#E9EFE7] bg-[#FAFAF8] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#2D2D2D]">
                #{o.order_number}
              </span>
              <span className="text-xs text-[#777777]">
                {fmtDate(o.created_at)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <Badge
                variant={o.payment_status === "paid" ? "default" : "outline"}
                className={
                  o.payment_status === "paid"
                    ? "bg-[#EAF3E7] text-[#3E6B4B] border-transparent"
                    : "border-[#D3DCD0] text-[#666666]"
                }
              >
                {o.payment_status}
              </Badge>
              <span className="text-[#555555] capitalize">
                {o.fulfilment_status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#E9EFE7] pt-2.5">
              <span className="font-bold text-[#2D2D2D] tabular-nums text-sm">
                {inr(o.amounts.total)}
              </span>
              <Link
                to={`/order/confirmation/${o.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#467065]"
              >
                <span>View details</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
