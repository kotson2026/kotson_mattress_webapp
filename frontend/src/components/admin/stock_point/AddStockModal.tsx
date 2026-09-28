import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, PackagePlus, ArrowRight, Layers, Building2, Hash, FileText } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CatalogTreeCategory, CatalogTreeManualItem } from "@/lib/types";

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedVariantId?: string | null;
  preselectedManualItemId?: string | null;
}

export default function AddStockModal({
  isOpen,
  onClose,
  preselectedVariantId,
  preselectedManualItemId,
}: AddStockModalProps) {
  const qc = useQueryClient();

  const [itemType, setItemType] = useState<"CATALOG_VARIANT" | "MANUAL_ITEM">("CATALOG_VARIANT");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedManualId, setSelectedManualId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("10");
  const [supplier, setSupplier] = useState<string>("Kotson Kerala Plant");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const { data: tree } = useQuery<{ categories: CatalogTreeCategory[]; manual_items: CatalogTreeManualItem[] }>({
    queryKey: ["stock-point-catalog-tree"],
    queryFn: () => apiGet("/stock-point/catalog-tree"),
    enabled: isOpen,
  });

  const categories = tree?.categories || [];
  const manualItems = tree?.manual_items || [];

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      if (preselectedManualItemId) {
        setItemType("MANUAL_ITEM");
        setSelectedManualId(preselectedManualItemId);
      } else if (preselectedVariantId && categories.length > 0) {
        setItemType("CATALOG_VARIANT");
        // find category and product for this variant
        for (const cat of categories) {
          for (const prod of cat.products) {
            if (prod.variants.some((v) => v.id === preselectedVariantId)) {
              setSelectedCategory(cat.slug);
              setSelectedProduct(prod.id);
              setSelectedVariantId(preselectedVariantId);
              return;
            }
          }
        }
      } else if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0].slug);
        if (categories[0].products.length > 0) {
          setSelectedProduct(categories[0].products[0].id);
          if (categories[0].products[0].variants.length > 0) {
            setSelectedVariantId(categories[0].products[0].variants[0].id);
          }
        }
      }
    }
  }, [isOpen, preselectedVariantId, preselectedManualItemId, categories]);

  // Derived current products and variants
  const currentCatObj = categories.find((c) => c.slug === selectedCategory);
  const currentProducts = currentCatObj?.products || [];
  const currentProdObj = currentProducts.find((p) => p.id === selectedProduct);
  const currentVariants = currentProdObj?.variants || [];
  const currentVariantObj = currentVariants.find((v) => v.id === selectedVariantId);
  const currentManualObj = manualItems.find((m) => m.id === selectedManualId);

  const prevStock = itemType === "CATALOG_VARIANT"
    ? (currentVariantObj?.stock ?? 0)
    : (currentManualObj?.stock ?? 0);
  const addQty = Math.max(0, parseInt(quantity, 10) || 0);
  const newStock = prevStock + addQty;
  const currentUnit = itemType === "CATALOG_VARIANT"
    ? (currentVariantObj?.unit || "units")
    : (currentManualObj?.unit || "pieces");

  const receiveMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/stock-point/stock/receive", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-point-dashboard"] });
      qc.invalidateQueries({ queryKey: ["stock-point-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-point-catalog-tree"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(`Successfully received +${data?.transaction?.quantity_change || addQty} units. New balance: ${data?.new_quantity} units.`);
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to receive stock");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addQty <= 0) {
      toast.error("Please enter a valid quantity greater than zero.");
      return;
    }

    if (itemType === "CATALOG_VARIANT") {
      if (!selectedVariantId) {
        toast.error("Please select a variant / size.");
        return;
      }
      receiveMutation.mutate({
        item_type: "CATALOG_VARIANT",
        variant_id: selectedVariantId,
        quantity: addQty,
        supplier: supplier.trim() || undefined,
        reference_number: referenceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
    } else {
      if (!selectedManualId) {
        toast.error("Please select a manual stock item.");
        return;
      }
      receiveMutation.mutate({
        item_type: "MANUAL_ITEM",
        manual_stock_item_id: selectedManualId,
        quantity: addQty,
        supplier: supplier.trim() || undefined,
        reference_number: referenceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]"
        data-testid="add-stock-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7C9C59]/15 text-[#467065]">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Add / Receive Stock</h2>
              <p className="text-xs text-muted-foreground">Increments authoritative inventory & records auditable ledger entry</p>
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
          {/* Source Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#EBE7DF]">
            <button
              type="button"
              onClick={() => setItemType("CATALOG_VARIANT")}
              className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                itemType === "CATALOG_VARIANT"
                  ? "bg-white text-[#16241C] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Authoritative Catalogue Product
            </button>
            <button
              type="button"
              onClick={() => setItemType("MANUAL_ITEM")}
              className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                itemType === "MANUAL_ITEM"
                  ? "bg-white text-[#16241C] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Internal Manual Stock Item
            </button>
          </div>

          {itemType === "CATALOG_VARIANT" ? (
            <div className="space-y-3.5">
              {/* Category */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category *</Label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const catSlug = e.target.value;
                    setSelectedCategory(catSlug);
                    const catObj = categories.find((c) => c.slug === catSlug);
                    if (catObj && catObj.products.length > 0) {
                      setSelectedProduct(catObj.products[0].id);
                      if (catObj.products[0].variants.length > 0) {
                        setSelectedVariantId(catObj.products[0].variants[0].id);
                      }
                    } else {
                      setSelectedProduct("");
                      setSelectedVariantId("");
                    }
                  }}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9C59]"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product *</Label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setSelectedProduct(prodId);
                    const prodObj = currentProducts.find((p) => p.id === prodId);
                    if (prodObj && prodObj.variants.length > 0) {
                      setSelectedVariantId(prodObj.variants[0].id);
                    } else {
                      setSelectedVariantId("");
                    }
                  }}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9C59]"
                  required
                >
                  {currentProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant / Size */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size / Variant *</Label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9C59]"
                  required
                >
                  {currentVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.size} ({v.unit}) — Current Stock: {v.stock}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Authoritative unit for this product: <span className="font-semibold">{currentUnit}</span>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manual Stock Item *</Label>
              {manualItems.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  No manual stock items created yet. Use "+ Add Manual Stock Item" first.
                </p>
              ) : (
                <select
                  value={selectedManualId}
                  onChange={(e) => setSelectedManualId(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9C59]"
                  required
                >
                  <option value="">-- Select Manual Item --</option>
                  {manualItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.size}) — Current Stock: {m.stock} {m.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Quantity & Live Math Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity to Receive *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="mt-1.5 h-11 bg-white font-mono text-base font-bold"
                data-testid="receive-stock-quantity-input"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier / Source</Label>
              <Input
                type="text"
                placeholder="e.g. Kerala Factory Plant"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-1.5 h-11 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference / Challan #</Label>
              <Input
                type="text"
                placeholder="e.g. DC-2026-904"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="mt-1.5 h-11 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks / Batch Note</Label>
              <Input
                type="text"
                placeholder="e.g. Batch inspection passed"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1.5 h-11 bg-white"
              />
            </div>
          </div>

          {/* Authoritative Calculation Preview */}
          <div className="rounded-2xl border border-[#7C9C59]/40 bg-[#7C9C59]/10 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065] block">
              Authoritative Balance Preview:
            </span>
            <div className="mt-2 flex items-center justify-between font-mono text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Current Qty</span>
                <span className="font-bold text-base">{prevStock}</span>
              </div>
              <div className="text-muted-foreground font-sans">+</div>
              <div>
                <span className="text-xs text-muted-foreground block">Receiving</span>
                <span className="font-bold text-base text-[#467065]">+{addQty}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-[#467065]" />
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">New Balance</span>
                <span className="font-black text-lg text-[#16241C]">{newStock}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DDCF]/80">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-11 px-5">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={receiveMutation.isPending || addQty <= 0}
              className="rounded-xl h-11 px-6 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold"
              data-testid="confirm-add-stock-button"
            >
              {receiveMutation.isPending ? "Recording Receipt…" : "Confirm Stock Receipt"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
