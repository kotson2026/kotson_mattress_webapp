import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Search,
  Percent,
  IndianRupee,
  Calendar,
  Layers,
  Sparkles,
  Power,
  Info,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface CouponItem {
  id: string;
  code: string;
  title?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value_paise?: number;
  max_discount_paise?: number;
  usage_limit?: number | null;
  used_count?: number;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  applicable_product_ids?: string[] | null;
  stackable_with_referral?: boolean;
  created_at?: string;
}

export default function CouponManagementHub() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "percentage" | "fixed">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formMaxDiscount, setFormMaxDiscount] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formProductScope, setFormProductScope] = useState<"ALL" | "SELECTED">("ALL");
  const [formSelectedProducts, setFormSelectedProducts] = useState<string[]>([]);
  const [formStackableReferral, setFormStackableReferral] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch Coupons
  const { data: coupons = [], isLoading, isError } = useQuery<CouponItem[]>({
    queryKey: ["admin-coupons"],
    queryFn: () => apiGet<CouponItem[]>("/admin/coupons"),
  });

  // Fetch Products for product-specific coupons
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["catalog-products"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
  });

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormTitle("");
    setFormDiscountType("percentage");
    setFormDiscountValue("");
    setFormMinOrder("");
    setFormMaxDiscount("");
    setFormUsageLimit("");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormProductScope("ALL");
    setFormSelectedProducts([]);
    setFormStackableReferral(false);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: CouponItem) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormTitle(coupon.title || "");
    setFormDiscountType(coupon.discount_type);
    setFormDiscountValue(String(coupon.discount_value));
    setFormMinOrder(coupon.min_order_value_paise ? String(coupon.min_order_value_paise / 100) : "");
    setFormMaxDiscount(coupon.max_discount_paise ? String(coupon.max_discount_paise / 100) : "");
    setFormUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setFormValidFrom(coupon.valid_from ? coupon.valid_from.substring(0, 16) : "");
    setFormValidUntil(coupon.valid_until ? coupon.valid_until.substring(0, 16) : "");
    const prods = Array.isArray(coupon.applicable_product_ids) ? coupon.applicable_product_ids : [];
    if (prods.length > 0) {
      setFormProductScope("SELECTED");
      setFormSelectedProducts(prods);
    } else {
      setFormProductScope("ALL");
      setFormSelectedProducts([]);
    }
    setFormStackableReferral(Boolean(coupon.stackable_with_referral));
    setFormIsActive(coupon.is_active);
    setIsModalOpen(true);
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const code = formCode.trim().toUpperCase();
      if (!code) throw new Error("Coupon code is required");
      const val = parseFloat(formDiscountValue);
      if (isNaN(val) || val <= 0) throw new Error("Please enter a valid discount value");

      const payload = {
        code,
        title: formTitle.trim() || code,
        discount_type: formDiscountType,
        discount_value: val,
        min_order_value_paise: formMinOrder ? Math.round(parseFloat(formMinOrder) * 100) : 0,
        max_discount_paise: formMaxDiscount ? Math.round(parseFloat(formMaxDiscount) * 100) : null,
        usage_limit: formUsageLimit ? parseInt(formUsageLimit, 10) : null,
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
        applicable_product_ids: formProductScope === "SELECTED" ? formSelectedProducts : [],
        stackable_with_referral: formStackableReferral,
        is_active: formIsActive,
      };

      if (editingCoupon) {
        return apiPut(`/admin/coupons/${editingCoupon.id}`, payload);
      } else {
        return apiPost("/admin/coupons", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success(editingCoupon ? "Coupon updated successfully" : "Coupon created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save coupon");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return apiPut(`/admin/coupons/${id}`, { is_active });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiDelete(`/admin/coupons/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete coupon");
    },
  });

  // Filtered List
  const filtered = coupons.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const codeMatch = c.code.toLowerCase().includes(q);
      const titleMatch = (c.title || "").toLowerCase().includes(q);
      if (!codeMatch && !titleMatch) return false;
    }
    if (filterType !== "ALL" && c.discount_type !== filterType) return false;
    if (filterStatus === "ACTIVE" && !c.is_active) return false;
    if (filterStatus === "INACTIVE" && c.is_active) return false;
    return true;
  });

  // Metrics
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalRedeemed = coupons.reduce((acc, c) => acc + (c.used_count || 0), 0);
  const productSpecificCoupons = coupons.filter(
    (c) => Array.isArray(c.applicable_product_ids) && c.applicable_product_ids.length > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#11291F]">Coupons & Discounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage percentage and flat discount codes, applicability rules, and usage thresholds.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-[#11291F] hover:bg-[#1E3A2C] text-white font-medium flex items-center gap-2 shadow-xs"
        >
          <Plus size={16} />
          <span>Create Coupon</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Tag size={15} className="text-[#11291F]" />
            <span>Total Coupons</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalCoupons}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Power size={15} className="text-emerald-600" />
            <span>Active Codes</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{activeCoupons}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Sparkles size={15} className="text-amber-600" />
            <span>Redemptions</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalRedeemed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Layers size={15} className="text-blue-600" />
            <span>Product-Specific</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{productSpecificCoupons}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search coupon code or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
          <select
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="ALL">All Types</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Flat Amount (₹)</option>
          </select>
        </div>
      </div>

      {/* Coupon Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Code & Title</TableHead>
              <TableHead className="font-semibold text-xs">Discount</TableHead>
              <TableHead className="font-semibold text-xs">Scope</TableHead>
              <TableHead className="font-semibold text-xs">Validity</TableHead>
              <TableHead className="font-semibold text-xs">Redemptions</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  Loading coupons...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  No coupons found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const applicableCount = Array.isArray(c.applicable_product_ids)
                  ? c.applicable_product_ids.length
                  : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-mono font-bold text-sm tracking-wide text-[#11291F]">
                        {c.code}
                      </div>
                      {c.title && c.title !== c.code && (
                        <div className="text-xs text-muted-foreground">{c.title}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold text-xs text-foreground">
                        {c.discount_type === "percentage" ? (
                          <>
                            <Percent size={13} className="text-emerald-700" />
                            <span>{c.discount_value}% OFF</span>
                          </>
                        ) : (
                          <>
                            <IndianRupee size={13} className="text-emerald-700" />
                            <span>{c.discount_value} FLAT</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {c.min_order_value_paise ? `Min: ${inr(c.min_order_value_paise / 100)}` : "No min order"}
                        {c.discount_type === "percentage" && c.max_discount_paise && (
                          ` • Max: ${inr(c.max_discount_paise / 100)}`
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {applicableCount === 0 ? (
                        <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                          All Products
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px] font-medium bg-blue-50 text-blue-700 border-blue-200">
                          {applicableCount} {applicableCount === 1 ? "Product" : "Products"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">
                        {c.valid_until ? (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-muted-foreground" />
                            {new Date(c.valid_until).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No Expiry</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {c.used_count || 0}
                        {c.usage_limit ? (
                          <span className="text-muted-foreground font-normal"> / {c.usage_limit}</span>
                        ) : (
                          <span className="text-muted-foreground font-normal"> (unlimited)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleStatusMutation.mutate({ id: c.id, is_active: !c.is_active })}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          c.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.is_active ? "bg-emerald-600" : "bg-slate-400"
                          }`}
                        />
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditModal(c)}
                        >
                          <Edit3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (window.confirm(`Delete coupon "${c.code}"?`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl border border-border my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground">
                  {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure discount rule, product eligibility, and usage restrictions.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="mt-5 space-y-4"
            >
              {/* Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Coupon Code *</Label>
                  <Input
                    placeholder="e.g. FESTIVE15"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    className="mt-1 font-mono uppercase h-10"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Title / Description</Label>
                  <Input
                    placeholder="e.g. 15% Festive Sale Discount"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="mt-1 h-10"
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Discount Type *</Label>
                  <select
                    value={formDiscountType}
                    onChange={(e: any) => setFormDiscountType(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="percentage">Percentage (% Discount)</option>
                    <option value="fixed">Flat Amount (₹ Off Order)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">
                    {formDiscountType === "percentage" ? "Discount Percentage (%) *" : "Flat Discount (₹) *"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max={formDiscountType === "percentage" ? 100 : undefined}
                    placeholder={formDiscountType === "percentage" ? "e.g. 15" : "e.g. 500"}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    className="mt-1 h-10"
                    required
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Minimum Order Value (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 2999 (0 for no min)"
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(e.target.value)}
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">
                    Max Discount Cap (₹) {formDiscountType !== "percentage" && "(N/A for flat)"}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 2000 (optional cap)"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    disabled={formDiscountType !== "percentage"}
                    className="mt-1 h-10"
                  />
                </div>
              </div>

              {/* Applicable Products */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold">Applicable Products *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={formProductScope === "ALL"}
                      onChange={() => setFormProductScope("ALL")}
                      className="accent-[#11291F]"
                    />
                    <span>All Products (Storewide)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={formProductScope === "SELECTED"}
                      onChange={() => setFormProductScope("SELECTED")}
                      className="accent-[#11291F]"
                    />
                    <span>Selected Products Only</span>
                  </label>
                </div>

                {formProductScope === "SELECTED" && (
                  <div className="mt-2 p-3 rounded-lg border border-border bg-muted/20 max-h-40 overflow-y-auto space-y-1.5">
                    {products.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Loading products list...</p>
                    ) : (
                      products.map((p) => {
                        const checked = formSelectedProducts.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1.5 rounded-md"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormSelectedProducts([...formSelectedProducts, p.id]);
                                } else {
                                  setFormSelectedProducts(formSelectedProducts.filter((id) => id !== p.id));
                                }
                              }}
                              className="accent-[#11291F] rounded"
                            />
                            <span className="font-medium">{p.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Usage Limit & Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
                <div>
                  <Label className="text-xs font-semibold">Total Usage Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited if blank"
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(e.target.value)}
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valid From</Label>
                  <Input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="mt-1 h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valid Until (Expiry)</Label>
                  <Input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="mt-1 h-10 text-xs"
                  />
                </div>
              </div>

              {/* Checkboxes: Active & Stackable */}
              <div className="flex flex-col gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="accent-[#11291F] rounded"
                  />
                  <span>Coupon is Active (can be redeemed by customers)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formStackableReferral}
                    onChange={(e) => setFormStackableReferral(e.target.checked)}
                    className="accent-[#11291F] rounded"
                  />
                  <span>Allow stacking with Referral discounts</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-[#11291F] hover:bg-[#1E3A2C] text-white min-w-28"
                >
                  {saveMutation.isPending ? "Saving..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
