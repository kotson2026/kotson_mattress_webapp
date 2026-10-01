import React, { useState } from "react";
import { Star, Upload, X, Film, Image as ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

export interface ReviewTargetItem {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantTitle?: string;
  existingReview?: {
    id: string;
    rating: number;
    feedback: string;
    media_urls?: string[];
  } | null;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReviewTargetItem | null;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(target?.existingReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(target?.existingReview?.feedback || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(target?.existingReview?.media_urls || []);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when target changes
  React.useEffect(() => {
    if (target?.existingReview) {
      setRating(target.existingReview.rating || 5);
      setFeedback(target.existingReview.feedback || "");
      setMediaUrls(target.existingReview.media_urls || []);
    } else {
      setRating(5);
      setFeedback("");
      setMediaUrls([]);
    }
  }, [target]);

  if (!target) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 50MB limit`);
          continue;
        }

        const ext = file.name.split(".").pop();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `reviews/${target.orderId}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("kotson-media")
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
          });

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("kotson-media")
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          uploaded.push(publicUrlData.publicUrl);
        }
      }

      if (uploaded.length > 0) {
        setMediaUrls((prev) => [...prev, ...uploaded]);
        toast.success(`Uploaded ${uploaded.length} media file(s)`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload media");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please select a star rating between 1 and 5");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/reviews", {
        order_id: target.orderId,
        order_item_id: target.orderItemId,
        product_id: target.productId,
        variant_id: target.variantId || null,
        rating,
        feedback: feedback.trim(),
        media_urls: mediaUrls,
      });

      toast.success(target.existingReview ? "Review updated successfully!" : "Review submitted! Thank you for your feedback.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review. Genuine delivery verification required.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" data-testid="review-modal">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#467065]">
            <span>Verified Purchase Review</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#467065]" />
            <span>Order #{target.orderNumber}</span>
          </div>
          <DialogTitle className="font-heading text-xl font-bold text-[#11291F] mt-1">
            {target.existingReview ? "Edit Your Review" : "Rate & Review Product"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#666666]">
            {target.productName} {target.variantTitle ? `(${target.variantTitle})` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Star Rating Selection (1-5 REQUIRED) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider">
              Overall Rating <span className="text-rose-500">*</span>
            </Label>
            <div className="flex items-center gap-2 pt-1" data-testid="star-rating-selector">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform focus:outline-none"
                    data-testid={`star-${star}`}
                    aria-label={`${star} star`}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        filled ? "fill-amber-400 text-amber-400" : "text-[#D3DCD0]"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-sm font-bold text-[#11291F]">
                {rating === 5 && "Excellent (5/5)"}
                {rating === 4 && "Very Good (4/5)"}
                {rating === 3 && "Good (3/5)"}
                {rating === 2 && "Fair (2/5)"}
                {rating === 1 && "Poor (1/5)"}
              </span>
            </div>
          </div>

          {/* Written Feedback */}
          <div className="space-y-1.5">
            <Label htmlFor="review-feedback" className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider">
              Your Review &amp; Experience
            </Label>
            <Textarea
              id="review-feedback"
              rows={4}
              placeholder="How does the mattress feel? Comfort, edge support, spinal alignment, breathability..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="resize-none rounded-xl border-[#CBD6C7] text-sm focus:border-[#467065] focus:ring-1 focus:ring-[#467065]"
              data-testid="review-feedback-input"
            />
            <p className="text-[11px] text-[#777777]">
              Safe customer display name will be used (e.g. First name + last initial). Your email and phone are never exposed.
            </p>
          </div>

          {/* Photo & Video Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider">
              Add Photos or Video (Optional)
            </Label>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {mediaUrls.map((url, idx) => {
                const isVideo = url.endsWith(".mp4") || url.endsWith(".webm") || url.includes("video");
                return (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl border border-[#E4E9E2] bg-[#F7F9F6] overflow-hidden"
                  >
                    {isVideo ? (
                      <div className="flex h-full w-full items-center justify-center bg-black/10">
                        <Film className="h-6 w-6 text-[#467065]" />
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt="Review upload preview"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white opacity-80 hover:opacity-100 transition-opacity"
                      aria-label="Remove media"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              <label
                className={`relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-[#CBD6C7] hover:border-[#467065] bg-[#F8FAF7] hover:bg-[#F0F4EF] cursor-pointer transition-colors ${
                  isUploading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#467065]" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-[#467065] mb-1" />
                    <span className="text-[10px] font-semibold text-[#467065]">Upload</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={handleFileUpload}
                  className="sr-only"
                  disabled={isUploading}
                  data-testid="review-media-input"
                />
              </label>
            </div>
            <p className="text-[11px] text-[#777777]">
              Supported: JPG, PNG, WEBP, MP4, WEBM (up to 50MB)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4E9E2]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-[#CBD6C7] text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="rounded-xl bg-[#467065] hover:bg-[#11291F] text-white text-xs font-semibold px-6 shadow-sm"
              data-testid="submit-review-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : target.existingReview ? (
                "Update Review"
              ) : (
                "Submit Verified Review"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
