import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  Truck,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Building,
  Users,
  HelpCircle,
  ShoppingBag,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CatalogTreeCategory, CatalogTreeManualItem } from "@/lib/types";

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessDispatch?: (dispatch: any) => void;
}

interface DispatchLineItem {
  id: string;
  item_type: "CATALOG_VARIANT" | "MANUAL_ITEM";
  variant_id?: string;
  manual_stock_item_id?: string;
  product_name: string;
  size: string;
  unit: string;
  stock: number;
  quantity: number;
}

export default function DispatchModal({ isOpen, onClose, onSuccessDispatch }: DispatchModalProps) {
  const qc = useQueryClient();

  const [dispatchType, setDispatchType] = useState<
    "ONLINE_ORDER" | "OFFLINE_ORDER" | "DEALER" | "FRIENDS_INTERNAL" | "OTHER"
  >("ONLINE_ORDER");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [packageContents, setPackageContents] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // Line items in this package
  const [items, setItems] = useState<DispatchLineItem[]>([]);

  // Item selector in progress
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedManualId, setSelectedManualId] = useState<string>("");
  const [addSourceType, setAddSourceType] = useState<"CATALOG" | "MANUAL">("CATALOG");
  const [itemQty, setItemQty] = useState<string>("1");

  // Fetch catalog tree
  const { data: tree } = useQuery<{ categories: CatalogTreeCategory[]; manual_items: CatalogTreeManualItem[] }>({
    queryKey: ["stock-point-catalog-tree"],
    queryFn: () => apiGet("/stock-point/catalog-tree"),
    enabled: isOpen,
  });

  const categories = tree?.categories || [];
  const manualItems = tree?.manual_items || [];

  // Online orders search query
  const { data: searchOrderData, isFetching: isSearchingOrders } = useQuery({
    queryKey: ["stock-point-order-search", orderSearchQuery],
    queryFn: () => apiGet<any>(`/stock-point/orders/search?q=${encodeURIComponent(orderSearchQuery)}`),
    enabled: dispatchType === "ONLINE_ORDER" && orderSearchQuery.trim().length >= 2,
    staleTime: 5000,
  });

  const foundOrders = searchOrderData?.orders || [];

  // Initialize selector defaults when tree loads
  useEffect(() => {
    if (isOpen && categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].slug);
      if (categories[0].products.length > 0) {
        setSelectedProduct(categories[0].products[0].id);
        if (categories[0].products[0].variants.length > 0) {
          setSelectedVariantId(categories[0].products[0].variants[0].id);
        }
      }
    }
  }, [isOpen, categories]);

  // Auto-generate package contents description when items change
  useEffect(() => {
    if (items.length > 0) {
      const summary = items
        .map((it) => `${it.quantity} × ${it.product_name} (${it.size} ${it.unit})`)
        .join(", ");
      setPackageContents(summary);
    }
  }, [items]);

  const currentCatObj = categories.find((c) => c.slug === selectedCategory);
  const currentProducts = currentCatObj?.products || [];
  const currentProdObj = currentProducts.find((p) => p.id === selectedProduct);
  const currentVariants = currentProdObj?.variants || [];
  const currentVariantObj = currentVariants.find((v) => v.id === selectedVariantId);
  const currentManualObj = manualItems.find((m) => m.id === selectedManualId);

  // Add Item to Package
  const handleAddItem = () => {
    const qty = parseInt(itemQty, 10) || 0;
    if (qty <= 0) {
      toast.error("Please enter a quantity greater than zero.");
      return;
    }

    if (addSourceType === "CATALOG") {
      if (!currentVariantObj || !currentProdObj) {
        toast.error("Please select a valid catalogue product variant.");
        return;
      }
      if (qty > currentVariantObj.stock) {
        toast.error(
          `Cannot add ${qty} units. Only ${currentVariantObj.stock} units currently available in stock!`
        );
        return;
      }

      // Check if already in items list
      const existingIdx = items.findIndex((it) => it.variant_id === currentVariantObj.id);
      if (existingIdx >= 0) {
        const updated = [...items];
        const newTotalQty = updated[existingIdx].quantity + qty;
        if (newTotalQty > currentVariantObj.stock) {
          toast.error(
            `Total quantity would be ${newTotalQty}, but only ${currentVariantObj.stock} units are in stock.`
          );
          return;
        }
        updated[existingIdx].quantity = newTotalQty;
        setItems(updated);
      } else {
        setItems((prev) => [
          ...prev,
          {
            id: `line-${Date.now()}-${Math.random()}`,
            item_type: "CATALOG_VARIANT",
            variant_id: currentVariantObj.id,
            product_name: currentProdObj.name,
            size: currentVariantObj.size,
            unit: currentVariantObj.unit,
            stock: currentVariantObj.stock,
            quantity: qty,
          },
        ]);
      }
    } else {
      if (!currentManualObj) {
        toast.error("Please select a valid manual stock item.");
        return;
      }
      if (qty > currentManualObj.stock) {
        toast.error(
          `Cannot add ${qty} units. Only ${currentManualObj.stock} units currently available in stock!`
        );
        return;
      }
      const existingIdx = items.findIndex((it) => it.manual_stock_item_id === currentManualObj.id);
      if (existingIdx >= 0) {
        const updated = [...items];
        const newTotalQty = updated[existingIdx].quantity + qty;
        if (newTotalQty > currentManualObj.stock) {
          toast.error(
            `Total quantity would be ${newTotalQty}, but only ${currentManualObj.stock} units are in stock.`
          );
          return;
        }
        updated[existingIdx].quantity = newTotalQty;
        setItems(updated);
      } else {
        setItems((prev) => [
          ...prev,
          {
            id: `line-${Date.now()}-${Math.random()}`,
            item_type: "MANUAL_ITEM",
            manual_stock_item_id: currentManualObj.id,
            product_name: currentManualObj.name,
            size: currentManualObj.size,
            unit: currentManualObj.unit,
            stock: currentManualObj.stock,
            quantity: qty,
          },
        ]);
      }
    }

    setItemQty("1");
    toast.success("Item added to package");
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Auto-fill from an online order
  const handleSelectOrder = (o: any) => {
    setSelectedOrderId(o.order_id);
    setReferenceNumber(o.order_number);
    setRemarks(`Online order fulfillment for ${o.customer_name} (${o.city})`);

    // Match order items with catalog variants
    const newItems: DispatchLineItem[] = [];
    for (const orderLine of o.items) {
      // Find variant in tree
      let matchedVar: any = null;
      let matchedProdName: string = orderLine.product_name;
      let matchedUnit = "inches";

      for (const cat of categories) {
        for (const p of cat.products) {
          const v = p.variants.find((v) => v.id === orderLine.variant_id);
          if (v) {
            matchedVar = v;
            matchedProdName = p.name;
            matchedUnit = v.unit;
            break;
          }
        }
        if (matchedVar) break;
      }

      if (matchedVar) {
        newItems.push({
          id: `ord-line-${matchedVar.id}`,
          item_type: "CATALOG_VARIANT",
          variant_id: matchedVar.id,
          product_name: matchedProdName,
          size: matchedVar.size,
          unit: matchedUnit,
          stock: matchedVar.stock,
          quantity: orderLine.qty || 1,
        });
      }
    }

    if (newItems.length > 0) {
      setItems(newItems);
      toast.success(`Loaded ${newItems.length} items from order #${o.order_number}`);
    } else {
      toast.info(`Selected order #${o.order_number}. Add items manually.`);
    }
  };

  const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);

  // Dispatch Mutation
  const dispatchMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/stock-point/dispatch", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["stock-point-inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-point-dashboard"] });
      qc.invalidateQueries({ queryKey: ["stock-point-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-point-dispatches"] });
      qc.invalidateQueries({ queryKey: ["stock-point-catalog-tree"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });

      const d = data?.dispatch;
      toast.success(`Dispatch Recorded: ${d?.dispatch_number}. ${d?.total_units} units deducted from Stock Point.`);
      if (onSuccessDispatch) {
        onSuccessDispatch(d);
      }
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to confirm dispatch. Check available stock.");
      setShowConfirm(false);
    },
  });

  if (!isOpen) return null;

  const handleInitiateConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Please add at least one item to the package.");
      return;
    }

    // Client-side verification
    for (const it of items) {
      if (it.quantity > it.stock) {
        toast.error(
          `Insufficient stock for ${it.product_name} (${it.size}). Only ${it.stock} available, tried to dispatch ${it.quantity}.`
        );
        return;
      }
    }
    setShowConfirm(true);
  };

  const handleFinalSubmit = () => {
    const payload = {
      dispatch_type: dispatchType,
      reference_number: referenceNumber.trim() || undefined,
      order_id: selectedOrderId || undefined,
      package_contents: packageContents.trim() || undefined,
      remarks: remarks.trim() || undefined,
      idempotency_key: `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      items: items.map((it) => ({
        item_type: it.item_type,
        variant_id: it.variant_id,
        manual_stock_item_id: it.manual_stock_item_id,
        quantity: it.quantity,
      })),
    };
    dispatchMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]"
        data-testid="pack-deliver-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#16241C] text-[#FAF8F5]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Pack / Deliver Product</h2>
              <p className="text-xs text-muted-foreground">
                Stock deduction from Stock Point warehouse with audit trail
              </p>
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

        {!showConfirm ? (
          <form onSubmit={handleInitiateConfirm} className="mt-5 space-y-4">
            {/* 1. Dispatch Type */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dispatch Classification *
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1.5">
                {[
                  { id: "ONLINE_ORDER", label: "Online Order", icon: ShoppingBag },
                  { id: "OFFLINE_ORDER", label: "Offline Order", icon: Package },
                  { id: "DEALER", label: "Dealer", icon: Building },
                  { id: "FRIENDS_INTERNAL", label: "Internal", icon: Users },
                  { id: "OTHER", label: "Other", icon: HelpCircle },
                ].map((type) => {
                  const Icon = type.icon;
                  const isSelected = dispatchType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setDispatchType(type.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-[#7C9C59] bg-[#7C9C59]/15 text-[#16241C] shadow-sm ring-1 ring-[#7C9C59]"
                          : "border-border bg-white text-muted-foreground hover:bg-[#EBE7DF]"
                      }`}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Online Order Autocomplete / Search */}
            {dispatchType === "ONLINE_ORDER" && (
              <div className="rounded-2xl border border-border/80 bg-white p-4 space-y-2.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Search Online Ecommerce Order</span>
                  {selectedOrderId && (
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                      Order Linked: #{referenceNumber}
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by order number (e.g. KT-ORD-), customer name or phone…"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-xs"
                  />
                </div>
                {isSearchingOrders && <p className="text-xs text-muted-foreground">Searching orders…</p>}
                {foundOrders.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                    {foundOrders.map((ord: any) => (
                      <div
                        key={ord.order_id}
                        onClick={() => handleSelectOrder(ord)}
                        className="flex items-center justify-between p-2 rounded-xl border border-border/60 hover:bg-[#FAF8F5] cursor-pointer text-xs transition-colors"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#16241C]">{ord.order_number}</span>
                          <span className="text-muted-foreground ml-2">({ord.customer_name})</span>
                          <div className="text-[11px] text-muted-foreground">
                            {ord.items.length} item(s) • {ord.city}
                          </div>
                        </div>
                        <Button type="button" size="xs" variant="outline">
                          Select & Load
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reference Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reference / Order Number
                </Label>
                <Input
                  type="text"
                  placeholder={
                    dispatchType === "DEALER"
                      ? "e.g. DL-VJA-2026-09"
                      : dispatchType === "ONLINE_ORDER"
                      ? "e.g. KT-ORDER-1021"
                      : "e.g. INV-OFFLINE-490"
                  }
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="mt-1.5 h-11 bg-white font-mono"
                  data-testid="dispatch-reference-input"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Dispatch Remarks
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Sent via BlueDart / Delivered to Hyderabad client"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1.5 h-11 bg-white"
                  data-testid="dispatch-remarks-input"
                />
              </div>
            </div>

            {/* 2. Package Contents & Added Items */}
            <div className="rounded-2xl border border-[#E3DDCF] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#16241C] flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-[#7C9C59]" />
                  Package Contents ({items.length} products / {totalUnits} total units)
                </span>
                <span className="text-[11px] text-muted-foreground">Multi-item bundle supported</span>
              </div>

              {items.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  No products added to package yet. Select products below and click "+ Add Product".
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-[#FAF8F5] text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#16241C]">{it.product_name}</div>
                        <div className="text-muted-foreground text-[11px]">
                          Size: <span className="font-semibold text-foreground">{it.size}</span> ({it.unit}) • Available in stock:{" "}
                          <span className="font-mono font-bold">{it.stock}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-white border border-border px-2.5 py-1 rounded-lg font-mono font-bold text-sm">
                          <span>Qty:</span>
                          <span className="text-[#467065]">{it.quantity}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Package description string (editable) */}
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Package Contents Summary Label *
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. 1 × Ortho Therapy Mattress, 2 × Standard Classic Pillows"
                  value={packageContents}
                  onChange={(e) => setPackageContents(e.target.value)}
                  className="mt-1 h-9 text-xs bg-[#FAF8F5]"
                  data-testid="package-contents-summary-input"
                />
              </div>
            </div>

            {/* 3. Add Item to Package Form */}
            <div className="rounded-2xl border border-dashed border-[#7C9C59]/60 bg-[#7C9C59]/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#467065] flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add Product to Package
                </span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAddSourceType("CATALOG")}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                      addSourceType === "CATALOG" ? "bg-[#7C9C59] text-white" : "text-muted-foreground"
                    }`}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSourceType("MANUAL")}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                      addSourceType === "MANUAL" ? "bg-[#7C9C59] text-white" : "text-muted-foreground"
                    }`}
                  >
                    Manual Item
                  </button>
                </div>
              </div>

              {addSourceType === "CATALOG" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Category</Label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        const slug = e.target.value;
                        setSelectedCategory(slug);
                        const c = categories.find((cat) => cat.slug === slug);
                        if (c && c.products.length > 0) {
                          setSelectedProduct(c.products[0].id);
                          if (c.products[0].variants.length > 0) {
                            setSelectedVariantId(c.products[0].variants[0].id);
                          }
                        }
                      }}
                      className="mt-1 w-full h-9 px-2 rounded-xl border border-border bg-white text-xs"
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Product</Label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setSelectedProduct(pid);
                        const p = currentProducts.find((prod) => prod.id === pid);
                        if (p && p.variants.length > 0) {
                          setSelectedVariantId(p.variants[0].id);
                        }
                      }}
                      className="mt-1 w-full h-9 px-2 rounded-xl border border-border bg-white text-xs"
                    >
                      {currentProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Size / Variant</Label>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="mt-1 w-full h-9 px-2 rounded-xl border border-border bg-white text-xs"
                    >
                      {currentVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.size} ({v.unit}) — Stock: {v.stock}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Manual Stock Item</Label>
                  <select
                    value={selectedManualId}
                    onChange={(e) => setSelectedManualId(e.target.value)}
                    className="mt-1 w-full h-9 px-2 rounded-xl border border-border bg-white text-xs"
                  >
                    <option value="">-- Select Manual Item --</option>
                    {manualItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.size}) — Stock: {m.stock} {m.unit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <div className="w-28">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="mt-1 h-9 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-5 h-9 bg-white hover:bg-[#7C9C59] hover:text-white border-[#7C9C59]/40 text-xs font-bold"
                  data-testid="add-item-to-package-button"
                >
                  + Add Item To Package
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DDCF]/80">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-11 px-5">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={items.length === 0}
                className="rounded-xl h-11 px-6 bg-[#16241C] hover:bg-[#25392d] text-white font-bold"
                data-testid="proceed-to-dispatch-confirm"
              >
                Review & Confirm Dispatch ({totalUnits} units)
              </Button>
            </div>
          </form>
        ) : (
          /* Confirmation Screen */
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                Confirm Warehouse Dispatch?
              </div>
              <p className="text-xs text-emerald-800">
                You are about to dispatch <span className="font-bold">{totalUnits} total units</span> across{" "}
                <span className="font-bold">{items.length} product(s)</span> for{" "}
                <span className="font-bold">{dispatchType.replace("_", " ")}</span>.
              </p>
            </div>

            {/* Deductions Preview */}
            <div className="rounded-2xl border border-border bg-white p-4 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Authoritative Stock Balance Changes:
              </span>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#FAF8F5]">
                    <div>
                      <span className="font-bold text-[#16241C]">{it.product_name}</span>{" "}
                      <span className="text-muted-foreground">({it.size} {it.unit})</span>
                    </div>
                    <div className="font-mono text-xs">
                      <span>Available: {it.stock}</span>
                      <span className="text-red-600 font-bold ml-2">-{it.quantity}</span>
                      <span className="text-muted-foreground ml-2">→</span>
                      <span className="font-black text-[#16241C] ml-2">{it.stock - it.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-white p-3 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground font-semibold">Reference: </span>
                <span className="font-mono">{referenceNumber || "DIRECT"}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Package: </span>
                <span>{packageContents}</span>
              </div>
              {remarks && (
                <div>
                  <span className="text-muted-foreground font-semibold">Remarks: </span>
                  <span>{remarks}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DDCF]/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={dispatchMutation.isPending}
                className="rounded-xl h-11 px-5"
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                onClick={handleFinalSubmit}
                disabled={dispatchMutation.isPending}
                className="rounded-xl h-11 px-6 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold"
                data-testid="final-confirm-dispatch-button"
              >
                {dispatchMutation.isPending ? "Executing Stock Deduction…" : "Confirm & Dispatch Now"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
