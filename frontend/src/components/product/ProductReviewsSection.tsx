import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, CheckCircle, ShieldCheck, Film, Image as ImageIcon, ChevronDown, Filter } from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/format";

interface ReviewItem {
  id: string;
  rating: number;
  feedback: string;
  media_urls?: string[];
  customer_display_name: string;
  is_verified_purchase: boolean;
  created_at: string;
  variant_id?: string;
  product_name?: string;
}

interface ProductReviewsData {
  reviews: ReviewItem[];
  total_count: number;
  average_rating: number;
  distribution: Record<number, number>;
}

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
}

export default function ProductReviewsSection({
  productId,
  productName,
}: ProductReviewsSectionProps) {
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);
  const [activeMediaPreview, setActiveMediaPreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ProductReviewsData>({
    queryKey: ["product-reviews", productId],
    queryFn: () => apiGet<ProductReviewsData>(`/catalog/products/${encodeURIComponent(productId)}/reviews`),
    enabled: !!productId,
  });

  const reviews = data?.reviews || [];
  const totalCount = data?.total_count || 0;
  const avgRating = data?.average_rating || 0;
  const distribution = data?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const filteredReviews = selectedStarFilter
    ? reviews.filter((r) => r.rating === selectedStarFilter)
    : reviews;

  return (
    <section
      id="customer-reviews-section"
      className="mt-20 border-t border-border pt-16 pb-12 scroll-mt-24"
      aria-label="Verified Customer Reviews"
      data-testid="pdp-reviews-section"
    >
      <div className="mx-auto max-w-[1400px]">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-xs font-bold tracking-widest uppercase text-brand-leaf mb-2">
            AUTHENTIC CUSTOMER EXPERIENCES
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-brand-deep uppercase">
            VERIFIED REVIEWS
          </h2>
          <div className="mt-4 h-1 w-16 rounded-full bg-brand-leaf/40" />
        </div>

        {/* Aggregate Ratings & Breakdown Card */}
        <div className="rounded-3xl border border-border bg-[#F7F9F6] p-6 sm:p-8 md:p-10 mb-10 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left: Big Score & Stars */}
            <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-8">
              <div className="font-heading text-5xl sm:text-6xl font-black text-brand-deep tabular-nums">
                {totalCount > 0 ? avgRating.toFixed(1) : "5.0"}
              </div>

              <div className="flex items-center gap-1.5 my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(totalCount > 0 ? avgRating : 5)
                        ? "fill-amber-400 text-amber-400"
                        : "text-[#D3DCD0]"
                    }`}
                  />
                ))}
              </div>

              <p className="text-sm font-semibold text-brand-deep">
                Based on {totalCount} {totalCount === 1 ? "review" : "verified reviews"}
              </p>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-leaf font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>100% Genuine Delivered Purchases</span>
              </div>
            </div>

            {/* Right: Star Distribution Bars */}
            <div className="md:col-span-8 space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star] || 0;
                const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                const isSelected = selectedStarFilter === star;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setSelectedStarFilter(isSelected ? null : star)
                    }
                    className={`w-full flex items-center gap-3 text-xs p-1.5 rounded-lg transition-colors text-left ${
                      isSelected
                        ? "bg-brand-leaf/10 ring-1 ring-brand-leaf font-bold"
                        : "hover:bg-white/60"
                    }`}
                    data-testid={`filter-star-${star}`}
                  >
                    <span className="w-10 font-semibold text-brand-deep flex items-center gap-1 shrink-0">
                      {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline" />
                    </span>

                    <div className="flex-1 h-2.5 rounded-full bg-[#E5E9E2] overflow-hidden">
                      <div
                        className="h-full bg-brand-leaf rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <span className="w-12 text-right tabular-nums text-muted-foreground shrink-0">
                      {percentage}% ({count})
                    </span>
                  </button>
                );
              })}

              {selectedStarFilter && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedStarFilter(null)}
                    className="text-xs text-brand-forest font-semibold underline hover:text-brand-deep"
                  >
                    Clear Filter ({selectedStarFilter} Stars)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews List */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-brand-sand/40 animate-pulse" />
            <div className="h-32 rounded-2xl bg-brand-sand/40 animate-pulse" />
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center" data-testid="no-reviews-state">
            <ShieldCheck className="mx-auto h-10 w-10 text-brand-leaf/60 mb-3" />
            <h3 className="font-heading text-lg font-bold text-brand-deep">
              {selectedStarFilter
                ? `No ${selectedStarFilter}-star reviews yet`
                : "No customer reviews yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              {selectedStarFilter
                ? "Try selecting another star rating or clearing the filter."
                : "Genuine customer reviews appear here only after verified purchases are delivered."}
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="reviews-list">
            {filteredReviews.map((review) => {
              const media = Array.isArray(review.media_urls) ? review.media_urls : [];

              return (
                <article
                  key={review.id}
                  className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-xs"
                  data-testid={`review-card-${review.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {/* Rating Stars */}
                      <div className="flex items-center gap-1 mb-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-[#D3DCD0]"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Reviewer Display Name & Verified Badge */}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-brand-deep">
                          {review.customer_display_name}
                        </span>

                        {review.is_verified_purchase && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200"
                            data-testid="badge-verified-purchase"
                          >
                            <ShieldCheck className="h-3 w-3 text-emerald-700" />
                            Verified Purchase
                          </span>
                        )}
                      </div>
                    </div>

                    <time
                      dateTime={review.created_at}
                      className="text-xs text-muted-foreground"
                    >
                      {fmtDate(review.created_at)}
                    </time>
                  </div>

                  {/* Feedback text */}
                  {review.feedback && (
                    <p className="mt-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-line" data-testid="review-feedback-text">
                      {review.feedback}
                    </p>
                  )}

                  {/* Media Gallery (Images & Videos) */}
                  {media.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {media.map((url, mIdx) => {
                        const isVideo =
                          url.endsWith(".mp4") ||
                          url.endsWith(".webm") ||
                          url.includes("video");

                        return (
                          <div
                            key={mIdx}
                            className="relative group h-20 w-20 sm:h-24 sm:w-24 rounded-xl border border-border bg-[#F7F9F6] overflow-hidden cursor-pointer"
                            onClick={() => setActiveMediaPreview(url)}
                          >
                            {isVideo ? (
                              <div className="flex h-full w-full items-center justify-center bg-black/10">
                                <Film className="h-6 w-6 text-brand-deep" />
                              </div>
                            ) : (
                              <img
                                src={url}
                                alt={`Customer review media ${mIdx + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                loading="lazy"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Media Preview */}
      {activeMediaPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveMediaPreview(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {activeMediaPreview.endsWith(".mp4") ||
            activeMediaPreview.endsWith(".webm") ||
            activeMediaPreview.includes("video") ? (
              <video
                src={activeMediaPreview}
                controls
                autoPlay
                className="max-h-[85vh] w-auto rounded-2xl"
              />
            ) : (
              <img
                src={activeMediaPreview}
                alt="Enlarged review media"
                className="max-h-[85vh] w-auto object-contain rounded-2xl"
              />
            )}
            <button
              type="button"
              onClick={() => setActiveMediaPreview(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
