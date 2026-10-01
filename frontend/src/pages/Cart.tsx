import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { CartView } from "@/lib/types";
import { inr } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

export default function Cart() {
  const qc = useQueryClient();
  const [refInput, setRefInput] = useState(() => {
    return sessionStorage.getItem("kotson_ref") || localStorage.getItem("kotson_ref") || "";
  });
  const { openDrawer } = useCheckoutDrawer();
  const { data: cart, isLoading } = useQuery({ queryKey: ["cart"], queryFn: () => apiGet<CartView>("/cart") });

  useEffect(() => {
    if (cart?.referred_code && !refInput) {
      setRefInput(cart.referred_code);
    }
  }, [cart?.referred_code]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["cart"] });

  const setQty = useMutation({
    mutationFn: (p: { variant_id: string; qty: number }) => apiPatch("/cart/items", p),
    onSuccess: () => {
      refresh();
      toast.success("Cart updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update cart"),
  });

  const remove = useMutation({
    mutationFn: (variant_id: string) => apiDelete(`/cart/items/${variant_id}`),
    onSuccess: refresh,
  });

  const applyRef = useMutation({
    mutationFn: (code: string | null) => apiPost("/cart/referral", { code }),
    onSuccess: () => {
      refresh();
      toast.success("Referral code updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not apply code"),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Your cart</h1>

        {isLoading && <div className="mt-8 h-48 animate-pulse rounded-2xl bg-brand-sand" />}

        {cart && cart.items.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center" data-testid="cart-empty">
            <p className="font-heading text-lg font-semibold">Your cart is empty</p>
            <Link to="/collections" className="mt-4 inline-block text-brand-deep underline" data-testid="cart-empty-shop-link">
              Browse the collection
            </Link>
          </div>
        )}

        {cart && cart.items.length > 0 && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <Table data-testid="cart-lines">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((l) => {
                  const isCustom = Boolean(l.is_custom);
                  const customDims = l.custom_dimensions
                    ? `${l.custom_dimensions.length} × ${l.custom_dimensions.breadth} × ${l.custom_dimensions.thickness} in`
                    : l.size;
                  const customOptionsSummary = l.custom_options && Array.isArray(l.custom_options)
                    ? l.custom_options.map((o: any) => `${o.option_label || o.option_name}: ${o.value_label || o.value_name}`).join(" · ")
                    : null;
                  const targetId = l.custom_configuration_id || l.variant_id;

                  return (
                    <TableRow key={targetId} data-testid={`cart-line-${l.sku}`}>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/products/${l.product_slug}`} className="font-medium hover:text-brand-deep">
                            {l.product_name}
                          </Link>
                          {isCustom && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#467065]/10 text-[#467065]">
                              Custom Size
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isCustom ? customDims : [l.size, l.thickness, l.firmness].filter(Boolean).join(" · ")}
                        </p>

                        {customOptionsSummary && (
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                            {customOptionsSummary}
                          </p>
                        )}

                        {isCustom && (
                          <div className="mt-1">
                            <Link
                              to={`/customizable-products/customize/${l.product_slug}${
                                l.custom_configuration_id ? `?configId=${l.custom_configuration_id}` : ""
                              }`}
                              className="inline-flex items-center text-xs font-semibold text-[#467065] hover:underline"
                            >
                              Edit Customization
                            </Link>
                          </div>
                        )}
                        
                        {/* Price breakdown: Selling Price, MRP, 40% OFF badge */}
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-2 text-xs">
                          <span className="font-bold text-foreground">{inr(l.unit_price)}</span>
                          {l.mrp && l.mrp > l.unit_price && (
                            <>
                              <span className="text-muted-foreground/75 line-through">{inr(l.mrp)}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F2EA] text-[#2F5233] border border-[#2F5233]/20">
                                {l.discount_percent ? `${Math.round(l.discount_percent)}% OFF` : "40% OFF"}
                              </span>
                            </>
                          )}
                        </div>

                        {l.referral_discount && l.referral_discount > 0 ? (
                          <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                            Referral Discount: −{inr(l.referral_discount)}
                          </div>
                        ) : null}

                        {!l.is_active && <p className="text-xs text-destructive mt-1">No longer available — remove to continue</p>}
                      </TableCell>
                      <TableCell>
                        {isCustom ? (
                          <span className="text-xs font-semibold text-muted-foreground">Qty: {l.qty}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="icon-xs" 
                              aria-label={`Decrease ${l.product_name}`} 
                              data-testid={`cart-dec-${l.sku}`} 
                              disabled={l.qty <= 1 || setQty.isPending}
                              onClick={() => setQty.mutate({ variant_id: l.variant_id, qty: Math.max(1, l.qty - 1) })}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center tabular-nums">{l.qty}</span>
                            <Button
                              variant="outline"
                              size="icon-xs"
                              aria-label={`Increase ${l.product_name}`}
                              data-testid={`cart-inc-${l.sku}`}
                              disabled={setQty.isPending || (l.free_stock ? l.qty >= Math.min(l.free_stock, 10) : false)}
                              onClick={() => setQty.mutate({ variant_id: l.variant_id, qty: l.qty + 1 })}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {!isCustom && l.qty >= l.free_stock && <p className="mt-1 text-xs text-brand-amber">Max available: {l.free_stock}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-bold text-foreground">{inr(l.line_total)}</div>
                        {l.qty > 1 && (
                          <div className="text-[11px] text-muted-foreground">{l.qty} × {inr(l.unit_price)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${l.product_name}`} data-testid={`cart-remove-${l.sku}`} onClick={() => remove.mutate(targetId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-bold mb-4">Price Summary</h2>
              {(() => {
                const totalMrp = cart.total_mrp && cart.total_mrp > cart.subtotal ? cart.total_mrp : Math.round(cart.subtotal * 1.4);
                const kotsonDiscount = Math.max(0, totalMrp - cart.subtotal);
                const sellingPrice = cart.subtotal;
                const refDiscount = cart.referral_discount || 0;
                const couponDiscount = cart.coupon_discount || 0;
                const finalPayable = cart.final_total !== undefined ? cart.final_total : Math.max(0, sellingPrice - refDiscount - couponDiscount);
                const totalSavings = kotsonDiscount + refDiscount + couponDiscount;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>MRP</span>
                      <span className="tabular-nums font-semibold">{inr(totalMrp)}</span>
                    </div>
                    {kotsonDiscount > 0 && (
                      <div className="flex justify-between text-[#2F5233] font-medium">
                        <span>Kotson Product Discount</span>
                        <span className="tabular-nums">−{inr(kotsonDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-dashed border-border/70 pt-2 text-foreground">
                      <span>Selling Price</span>
                      <span className="tabular-nums">{inr(sellingPrice)}</span>
                    </div>
                    {refDiscount > 0 && (
                      <div className="flex justify-between text-[#2F5233] font-semibold" data-testid="cart-discount">
                        <span>Referral Discount</span>
                        <span className="tabular-nums">−{inr(refDiscount)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-[#2F5233] font-semibold" data-testid="cart-coupon-discount">
                        <span>Coupon Discount ({cart.coupon_code})</span>
                        <span className="tabular-nums">−{inr(couponDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                      <span>FINAL AMOUNT TO PAY</span>
                      <span className="font-heading text-2xl text-foreground tabular-nums" data-testid="cart-subtotal">
                        {inr(finalPayable)}
                      </span>
                    </div>
                    {totalSavings > 0 && (
                      <div className="flex justify-between text-xs font-bold text-[#2F5233] bg-[#2F5233]/10 px-3 py-1.5 rounded-lg mt-2">
                        <span>Total Savings</span>
                        <span className="tabular-nums">{inr(totalSavings)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="mt-3 text-xs text-muted-foreground">GST, shipping and discounts are recalculated server-side at checkout.</p>


              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold">Referral code</p>
                {cart.referred_code ? (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-mono font-bold">{cart.referred_code} ✓ Applied</span>
                    <button
                      onClick={() => {
                        setRefInput("");
                        try {
                          sessionStorage.removeItem("kotson_ref");
                          localStorage.removeItem("kotson_ref");
                        } catch {}
                        applyRef.mutate(null);
                      }}
                      className="text-xs text-rose-600 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                      placeholder="Enter referral code"
                      data-testid="cart-referral-input"
                    />
                    <Button variant="outline" onClick={() => applyRef.mutate(refInput || null)} disabled={applyRef.isPending} data-testid="cart-referral-apply">
                      Apply
                    </Button>
                  </div>
                )}
                {cart.referral_status !== "none" && (
                  <p className={`mt-2 text-xs ${cart.referral_status === "valid" ? "text-emerald-700 font-medium" : "text-muted-foreground"}`} data-testid="cart-referral-note">
                    {cart.referral_note}
                  </p>
                )}
              </div>

              <button
                onClick={openDrawer}
                className={buttonVariants({ size: "lg" }) + " mt-6 flex w-full min-h-12"}
                data-testid="cart-checkout-link"
              >
                Proceed to checkout
              </button>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
