import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  Film,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminReviewItem {
  id: string;
  user_id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  rating: number;
  feedback: string;
  media_urls?: string[];
  customer_display_name: string;
  is_verified_purchase: boolean;
  status: "pending" | "live" | "hidden";
  created_at: string;
  updated_at: string;
}

export default function ReviewModerationHub() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);

  // Fetch reviews
  const { data: rawReviews, isLoading, isError, refetch } = useQuery<AdminReviewItem[]>({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: () => apiGet<AdminReviewItem[]>(`/admin/reviews?status=${statusFilter}`),
  });

  const reviews = Array.isArray(rawReviews) ? rawReviews : [];

  // Moderate review mutation (LIVE or HIDE)
  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "LIVE" | "HIDE" }) =>
      apiPatch(`/admin/reviews/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Review marked as ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["product-reviews"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to moderate review"),
  });

  // Delete review mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success("Review deleted successfully and recorded in Audit Log");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["product-reviews"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete review"),
  });

  const handleDelete = (id: string, customerName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete the review from ${customerName}? This action is logged.`)) {
      deleteMutation.mutate(id);
    }
  };

  // Metrics
  const totalReviews = reviews.length;
  const liveCount = reviews.filter((r) => r.status === "live").length;
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const hiddenCount = reviews.filter((r) => r.status === "hidden").length;
  const avgScore =
    liveCount > 0
      ? (
          reviews
            .filter((r) => r.status === "live")
            .reduce((acc, r) => acc + r.rating, 0) / liveCount
        ).toFixed(1)
      : "5.0";

  // Filtered by search
  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.customer_display_name?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      r.feedback?.toLowerCase().includes(q) ||
      r.order_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6" data-testid="admin-review-moderation-hub">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-leaf">
            Owner Admin Console
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-0.5">
            Customer Reviews &amp; Moderation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative review governance. Moderation actions are recorded in the official Audit Log.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="rounded-xl border-border text-xs font-semibold h-9"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Total Reviews
          </span>
          <div className="font-heading text-2xl font-bold text-foreground mt-1 tabular-nums">
            {totalReviews}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Delivered purchases</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
            Live Reviews
          </span>
          <div className="font-heading text-2xl font-bold text-emerald-950 mt-1 tabular-nums">
            {liveCount}
          </div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">Publicly visible on PDP</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            Pending
          </span>
          <div className="font-heading text-2xl font-bold text-amber-950 mt-1 tabular-nums">
            {pendingCount}
          </div>
          <span className="text-[10px] text-amber-700 mt-0.5 block">Awaiting review</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Hidden
          </span>
          <div className="font-heading text-2xl font-bold text-foreground mt-1 tabular-nums">
            {hiddenCount}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Not shown to shoppers</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Avg Live Rating
          </span>
          <div className="font-heading text-2xl font-bold text-foreground mt-1 flex items-center gap-1.5 tabular-nums">
            <span>{avgScore}</span>
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Out of 5.0 stars</span>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: "all", label: `All (${totalReviews})` },
            { id: "live", label: `Live (${liveCount})` },
            { id: "pending", label: `Pending (${pendingCount})` },
            { id: "hidden", label: `Hidden (${hiddenCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                statusFilter === tab.id
                  ? "bg-brand-forest text-white border-brand-forest shadow-2xs"
                  : "bg-white text-foreground border-border hover:bg-muted"
              }`}
              data-testid={`filter-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-xl border-border text-xs"
            data-testid="search-reviews-input"
          />
        </div>
      </div>

      {/* Reviews Table View */}
      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-leaf" />
          <p className="mt-3 text-xs text-muted-foreground">Loading reviews...</p>
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-sm text-destructive">
          Failed to load reviews. Please refresh the page.
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center" data-testid="no-admin-reviews">
          <p className="text-sm font-semibold text-foreground">No reviews found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter !== "all"
              ? `There are no reviews with status '${statusFilter}'.`
              : "No customer reviews have been submitted yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">Rating</th>
                  <th className="py-3 px-4">Feedback</th>
                  <th className="py-3 px-3">Media</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReviews.map((r) => {
                  const media = Array.isArray(r.media_urls) ? r.media_urls : [];

                  return (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-muted/30"
                      data-testid={`admin-review-row-${r.id}`}
                    >
                      {/* Product */}
                      <td className="py-3.5 px-4 font-semibold text-foreground max-w-[180px] truncate">
                        {r.product_name || r.product_id}
                        {r.variant_id && (
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            {r.variant_id}
                          </span>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${
                                s <= r.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-[#D3DCD0]"
                              }`}
                            />
                          ))}
                        </div>
                      </td>

                      {/* Feedback */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-foreground/90 leading-relaxed">
                          {r.feedback || <span className="italic text-muted-foreground">No written text</span>}
                        </p>
                      </td>

                      {/* Media */}
                      <td className="py-3.5 px-3">
                        {media.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            {media.slice(0, 3).map((url, mIdx) => {
                              const isVideo =
                                url.endsWith(".mp4") ||
                                url.endsWith(".webm") ||
                                url.includes("video");

                              return (
                                <button
                                  key={mIdx}
                                  type="button"
                                  onClick={() => setLightboxMedia(url)}
                                  className="relative h-8 w-8 rounded-lg border border-border bg-muted overflow-hidden shrink-0 hover:opacity-80"
                                  title="Click to preview"
                                >
                                  {isVideo ? (
                                    <div className="flex h-full w-full items-center justify-center bg-black/20">
                                      <Film className="h-3.5 w-3.5 text-foreground" />
                                    </div>
                                  ) : (
                                    <img
                                      src={url}
                                      alt="Thumb"
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  )}
                                </button>
                              );
                            })}
                            {media.length > 3 && (
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                +{media.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground block">
                          {r.customer_display_name}
                        </span>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </td>

                      {/* Order Ref */}
                      <td className="py-3.5 px-3 font-mono text-[10px] text-muted-foreground">
                        {r.order_id?.slice(0, 8)}...
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                        {fmtDateTime(r.created_at)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold capitalize ${
                            r.status === "live"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : r.status === "hidden"
                              ? "border-neutral-300 bg-neutral-100 text-neutral-700"
                              : "border-amber-300 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status !== "live" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                moderateMutation.mutate({ id: r.id, status: "LIVE" })
                              }
                              disabled={moderateMutation.isPending}
                              className="h-7 px-2 text-[11px] font-semibold text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                              title="Make Publicly Visible on Storefront"
                              data-testid={`btn-live-${r.id}`}
                            >
                              <Eye className="mr-1 h-3 w-3" /> LIVE
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                moderateMutation.mutate({ id: r.id, status: "HIDE" })
                              }
                              disabled={moderateMutation.isPending}
                              className="h-7 px-2 text-[11px] font-semibold text-neutral-700 border-neutral-300 hover:bg-neutral-100 rounded-lg"
                              title="Hide from Storefront"
                              data-testid={`btn-hide-${r.id}`}
                            >
                              <EyeOff className="mr-1 h-3 w-3" /> HIDE
                            </Button>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(r.id, r.customer_display_name)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg"
                            title="Delete review permanently"
                            data-testid={`btn-delete-${r.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox for Admin Media Preview */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxMedia(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxMedia.endsWith(".mp4") ||
            lightboxMedia.endsWith(".webm") ||
            lightboxMedia.includes("video") ? (
              <video
                src={lightboxMedia}
                controls
                autoPlay
                className="max-h-[85vh] w-auto rounded-2xl"
              />
            ) : (
              <img
                src={lightboxMedia}
                alt="Enlarged review media"
                className="max-h-[85vh] w-auto object-contain rounded-2xl"
              />
            )}
            <button
              type="button"
              onClick={() => setLightboxMedia(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
