import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, SlidersHorizontal, ArrowRight, AlertTriangle } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItem } from "@/lib/types";

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export default function AdjustStockModal({ isOpen, onClose, item }: AdjustStockModalProps) {
  const qc = useQueryClient();

  const [correctQuantity, setCorrectQuantity] = useState<string>(
    item ? String(item.available_quantity) : "0"
  );
  const [reason, setReason] = useState<string>("");

  React.useEffect(() => {
    if (item) {
      setCorrectQuantity(String(item.available_quantity));
      setReason("");
    }
  }, [item]);

  const currentQty = item?.available_quantity ?? 0;
  const targetQty = Math.max(0, parseInt(correctQuantity, 10) || 0);
  const delta = targetQty - currentQty;

  const adjustMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/stock-point/stock/adjust", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-point-dashboard"] });
      qc.invalidateQueries({ queryKey: ["stock-point-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-point-catalog-tree"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(
        `Stock adjusted for ${item?.product_name}. Balance updated: ${data?.new_quantity} units (${data?.delta >= 0 ? "+" : ""}${data?.delta}).`
      );
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to adjust stock");
    },
  });

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      toast.error("Please enter a mandatory detailed reason for stock adjustment (min 3 characters).");
      return;
    }
    adjustMutation.mutate({
      item_type: item.item_type,
      variant_id: item.variant_id,
      manual_stock_item_id: item.manual_stock_item_id,
      correct_quantity: targetQty,
      reason: reason.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]"
        data-testid="adjust-stock-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Physical Stock Adjustment</h2>
              <p className="text-xs text-muted-foreground">Audited count reconciliation — never silently overwrites</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-[#E3DDCF]/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Target Item Header */}
          <div className="rounded-2xl border border-border/80 bg-white p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {item.category}
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-border">
                {item.sku}
              </span>
            </div>
            <h3 className="font-bold text-sm text-[#16241C]">{item.product_name}</h3>
            <p className="text-xs text-muted-foreground">
              Size / Variant: <span className="font-semibold text-foreground">{item.size}</span> ({item.unit})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current System Qty</Label>
              <Input
                type="text"
                disabled
                value={`${currentQty} ${item.unit}`}
                className="mt-1.5 h-11 bg-muted/40 font-mono font-bold text-base"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correct Physical Qty *</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={correctQuantity}
                onChange={(e) => setCorrectQuantity(e.target.value)}
                required
                className="mt-1.5 h-11 bg-white font-mono font-bold text-base"
                data-testid="adjust-stock-target-input"
              />
            </div>
          </div>

          {/* Audit Math Difference Preview */}
          <div
            className={`rounded-2xl border p-4 transition-all ${
              delta === 0
                ? "border-border bg-white"
                : delta < 0
                ? "border-red-200 bg-red-50/50"
                : "border-[#7C9C59]/40 bg-[#7C9C59]/10"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ledger Adjustment Impact:
            </span>
            <div className="mt-2 flex items-center justify-between font-mono text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Previous</span>
                <span className="font-bold text-base">{currentQty}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground block">Delta</span>
                <span
                  className={`font-black text-base ${
                    delta < 0 ? "text-red-600" : delta > 0 ? "text-[#467065]" : "text-muted-foreground"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">New Authoritative</span>
                <span className="font-black text-lg text-[#16241C]">{targetQty}</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Mandatory Adjustment Reason *
            </Label>
            <Textarea
              placeholder="e.g. Physical inventory audit discrepancy, damaged during warehouse forklift handling, or returned sample reconciliation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="mt-1.5 bg-white resize-none"
              data-testid="adjust-stock-reason-input"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              This reason is permanently attached to the audit ledger and cannot be erased.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DDCF]/80">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-11 px-5">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustMutation.isPending || delta === 0 || !reason.trim()}
              className="rounded-xl h-11 px-6 bg-[#16241C] hover:bg-[#25392d] text-white font-bold"
              data-testid="confirm-adjust-stock-button"
            >
              {adjustMutation.isPending ? "Recording Adjustment…" : "Confirm Stock Adjustment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
