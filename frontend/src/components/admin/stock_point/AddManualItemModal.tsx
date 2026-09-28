import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Layers, PlusCircle } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddManualItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddManualItemModal({ isOpen, onClose }: AddManualItemModalProps) {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Marketing & Display");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState("pieces");
  const [initialQuantity, setInitialQuantity] = useState("5");
  const [remarks, setRemarks] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/stock-point/manual-items", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-point-dashboard"] });
      qc.invalidateQueries({ queryKey: ["stock-point-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-point-catalog-tree"] });
      toast.success(`Manual stock item "${data?.item?.name}" created successfully.`);
      setName("");
      setSize("");
      setRemarks("");
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to create manual stock item");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter item name");
      return;
    }
    const qty = parseInt(initialQuantity, 10) || 0;
    createMutation.mutate({
      name: name.trim(),
      category: category.trim(),
      size: size.trim() || undefined,
      unit: unit.trim() || "pieces",
      initial_quantity: Math.max(0, qty),
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]"
        data-testid="add-manual-item-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Add Manual Stock Item</h2>
              <p className="text-xs text-muted-foreground">Internal physical inventory only — not listed on storefront</p>
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
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item Name *</Label>
            <Input
              type="text"
              placeholder="e.g. Showroom Latex Core Demo Block"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1.5 h-11 bg-white font-medium"
              data-testid="manual-item-name-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category / Type *</Label>
              <Input
                type="text"
                placeholder="e.g. Marketing & Display"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="mt-1.5 h-11 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size / Spec</Label>
              <Input
                type="text"
                placeholder="e.g. 24 × 24 × 4 in"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="mt-1.5 h-11 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit</Label>
              <Input
                type="text"
                placeholder="e.g. pieces, sets, blocks"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1.5 h-11 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Quantity *</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                required
                className="mt-1.5 h-11 bg-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks / Internal Note</Label>
            <Textarea
              placeholder="e.g. Demo display units for dealer showrooms"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="mt-1.5 bg-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DDCF]/80">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-11 px-5">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="rounded-xl h-11 px-6 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold"
            >
              {createMutation.isPending ? "Saving Item…" : "Save Manual Item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
