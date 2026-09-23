import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Store, CreditCard, UserCheck, AlertCircle } from "lucide-react";
import type { Product, Variant } from "@/lib/types";

interface ManualItemRow {
  productId: string;
  variantId: string;
  qty: number;
  unitPricePaise: number;
  discountPaise: number;
}

interface AddManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (order: any) => void;
}

export default function AddManualSaleModal({ isOpen, onClose, onSuccess }: AddManualSaleModalProps) {
  const qc = useQueryClient();

  // Customer form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isStorePickup, setIsStorePickup] = useState(true);
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560001");

  // Attribution
  const [salesSource, setSalesSource] = useState("WALK_IN");
  const [orderChannel, setOrderChannel] = useState("STORE");
  const [employeeId, setEmployeeId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");

  // Items
  const [items, setItems] = useState<ManualItemRow[]>([
    { productId: "", variantId: "", qty: 1, unitPricePaise: 0, discountPaise: 0 },
  ]);

  // Fetch catalog for product/variant pickers
  const { data: products } = useQuery<Product[]>({
    queryKey: ["catalog-products-for-manual-sale"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
    enabled: isOpen,
  });

  // Flat lookup of variants
  const variantsMap = useMemo(() => {
    const map = new Map<string, Variant>();
    (products || []).forEach((p) => {
      (p.variants || []).forEach((v) => {
        map.set(v.id, v);
      });
    });
    return map;
  }, [products]);

  // Add line item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: "", variantId: "", qty: 1, unitPricePaise: 0, discountPaise: 0 },
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item
  const handleUpdateItem = (index: number, field: keyof ManualItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const current = { ...copy[index], [field]: value };

      if (field === "productId") {
        // Find first variant for this product
        const prod = products?.find((p) => p.id === value);
        const firstVar = prod?.variants?.[0];
        if (firstVar) {
          current.variantId = firstVar.id;
          current.unitPricePaise = firstVar.price;
        } else {
          current.variantId = "";
          current.unitPricePaise = 0;
        }
      } else if (field === "variantId") {
        const v = variantsMap.get(value);
        if (v) {
          current.unitPricePaise = v.price;
        }
      }

      copy[index] = current;
      return copy;
    });
  };

  // Calculated totals
  const subtotalPaise = useMemo(() => {
    return items.reduce((sum, it) => sum + it.qty * (it.unitPricePaise || 0), 0);
  }, [items]);

  const discountPaise = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.discountPaise || 0), 0);
  }, [items]);

  const totalPaise = Math.max(0, subtotalPaise - discountPaise);

  // Mutation to create manual sale
  const createSaleMutation = useMutation({
    mutationFn: (payload: any) => apiPost("/admin/orders/manual", payload),
    onSuccess: (data: any) => {
      toast.success(`Manual sale recorded successfully! Order #${data.order_number}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-sales-summary"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record manual sale");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      toast.error("Please fill in Customer Name, Phone, and Email");
      return;
    }

    // Validate items
    const validItems = items.filter((it) => it.productId && it.variantId && it.qty > 0);
    if (validItems.length === 0) {
      toast.error("Please select at least one valid product and variant");
      return;
    }

    const payload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim(),
      sales_source: salesSource,
      order_channel: orderChannel,
      employee_id: employeeId.trim() || null,
      dealer_id: dealerId.trim() || null,
      source_note: sourceNote.trim() || null,
      sale_date: saleDate,
      payment_method: paymentMethod,
      manual_payment_ref: paymentRef.trim() || null,
      manual_payment_remarks: paymentRemarks.trim() || null,
      shipping_address: isStorePickup
        ? {
            full_name: customerName.trim(),
            phone: customerPhone.trim(),
            line1: "Store Carry-out / In-store Pickup",
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
          }
        : {
            full_name: customerName.trim(),
            phone: customerPhone.trim(),
            line1: addressLine.trim() || "Delivery Address",
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
          },
      items: validItems.map((it) => ({
        product_id: it.productId,
        variant_id: it.variantId,
        qty: it.qty,
        unit_price: it.unitPricePaise,
        discount: it.discountPaise,
      })),
    };

    createSaleMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-brand-leaf/10 p-2 text-brand-leaf">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">Record Manual Sale</h3>
              <p className="text-xs text-muted-foreground">
                In-store walk-in, employee assisted, or dealer counter order with immediate inventory deduction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Customer Information */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5 text-brand-deep" /> Customer Details
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Customer Name *</Label>
                <Input
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Mobile Number *</Label>
                <Input
                  required
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Email Address *</Label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. ramesh@gmail.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            {/* Delivery / Store Pickup Choice */}
            <div className="pt-1">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={isStorePickup}
                    onChange={(e) => setIsStorePickup(e.target.checked)}
                    className="rounded border-input text-brand-deep"
                  />
                  <span>Store Carry-Out / Direct Handover (No shipping needed)</span>
                </label>
              </div>

              {!isStorePickup && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Delivery Address</Label>
                    <Input
                      placeholder="Street address / apartment"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">State / Pincode</Label>
                    <div className="mt-1 flex gap-1.5">
                      <Input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="h-8 text-xs w-24"
                      />
                      <Input
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        className="h-8 text-xs w-20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Sales Attribution & Dates */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Attribution & Sale Date
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs">Sales Source</Label>
                <select
                  value={salesSource}
                  onChange={(e) => setSalesSource(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="WALK_IN">Walk-in / In-Store</option>
                  <option value="EMPLOYEE_ASSISTED">Employee Assisted</option>
                  <option value="DEALER">Dealer Counter</option>
                  <option value="PHONE_ORDER">Phone Order</option>
                  <option value="OTHER">Other Manual</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Channel</Label>
                <select
                  value={orderChannel}
                  onChange={(e) => setOrderChannel(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="STORE">STORE (Physical Counter)</option>
                  <option value="WEBSITE">WEBSITE</option>
                  <option value="PORTAL">PORTAL</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Sale Date</Label>
                <Input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Staff / Dealer ID (Opt)</Label>
                <Input
                  placeholder="e.g. EMP-04 / DLR-101"
                  value={employeeId || dealerId}
                  onChange={(e) => {
                    if (salesSource === "DEALER") setDealerId(e.target.value);
                    else setEmployeeId(e.target.value);
                  }}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Product Line Items */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Products & Variants
              </h4>
              <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Product
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => {
                const prod = products?.find((p) => p.id === it.productId);
                const selectedVar = variantsMap.get(it.variantId);
                const isOutOfStock = selectedVar && selectedVar.free_stock <= 0;
                const exceedsStock = selectedVar && it.qty > selectedVar.free_stock;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-border bg-muted/20 p-2.5 text-xs"
                  >
                    {/* Product Selector */}
                    <div className="sm:col-span-4">
                      <select
                        value={it.productId}
                        onChange={(e) => handleUpdateItem(idx, "productId", e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none"
                      >
                        <option value="">-- Select Product --</option>
                        {(products || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Variant Selector */}
                    <div className="sm:col-span-3">
                      <select
                        disabled={!it.productId}
                        value={it.variantId}
                        onChange={(e) => handleUpdateItem(idx, "variantId", e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none"
                      >
                        <option value="">-- Select Size / Variant --</option>
                        {(prod?.variants || []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.size} {v.thickness ? `(${v.thickness})` : ""} — {inr(v.price)} [Stock: {v.free_stock}]
                          </option>
                        ))}
                      </select>
                      {exceedsStock && (
                        <p className="mt-0.5 text-[10px] text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Exceeds free stock ({selectedVar?.free_stock})
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-1">
                      <Input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => handleUpdateItem(idx, "qty", parseInt(e.target.value, 10) || 1)}
                        className="h-8 text-xs text-center"
                      />
                    </div>

                    {/* Unit Price (editable) */}
                    <div className="sm:col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-[11px] text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={(it.unitPricePaise / 100).toFixed(0)}
                          onChange={(e) =>
                            handleUpdateItem(
                              idx,
                              "unitPricePaise",
                              Math.round(parseFloat(e.target.value || "0") * 100)
                            )
                          }
                          className="h-8 pl-5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="sm:col-span-2 flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-foreground text-xs">
                        {inr(it.qty * it.unitPricePaise)}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Payment & Financial Provenance */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 text-brand-deep" /> Payment & Settlement
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="CASH">CASH (Physical Cash Handover)</option>
                  <option value="UPI">UPI (Store QR / PhonePe / GPay)</option>
                  <option value="CARD">CARD (POS Machine / Swipe)</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
                  <option value="OTHER">Other Manual Method</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Txn Reference / Card Slip #</Label>
                <Input
                  placeholder="e.g. UPI-998811 or Slip-4401"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Remarks / Memo</Label>
                <Input
                  placeholder="e.g. Cash collected by store manager"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Verification Source will be recorded as:{" "}
              <strong className="text-foreground">ADMIN_RECORDED</strong> (Audit provenance preserved).
            </p>
          </div>

          {/* Order Summary Strip */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({items.reduce((acc, it) => acc + it.qty, 0)} units):</span>
              <span className="font-mono">{inr(subtotalPaise)}</span>
            </div>
            {discountPaise > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discounts:</span>
                <span className="font-mono text-destructive">- {inr(discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/80 pt-2 font-heading text-sm font-bold text-foreground">
              <span>Net Total Payable:</span>
              <span className="font-mono text-base text-brand-deep">{inr(totalPaise)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createSaleMutation.isPending}
              className="min-w-32 bg-brand-deep hover:bg-brand-deep/90 text-white"
            >
              {createSaleMutation.isPending ? "Creating Sale..." : "Record Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
