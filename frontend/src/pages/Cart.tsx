import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
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
  const [refInput, setRefInput] = useState("");
  const { openDrawer } = useCheckoutDrawer();
  const { data: cart, isLoading } = useQuery({ queryKey: ["cart"], queryFn: () => apiGet<CartView>("/cart") });

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
                {cart.items.map((l) => (
                  <TableRow key={l.variant_id} data-testid={`cart-line-${l.sku}`}>
                    <TableCell>
                      <Link to={`/products/${l.product_slug}`} className="font-medium hover:text-brand-deep">{l.product_name}</Link>
                      <p className="text-xs text-muted-foreground">{[l.size, l.thickness, l.firmness].filter(Boolean).join(" · ")}</p>
                      
                      {/* Price breakdown: Selling Price, MRP, 40% OFF badge */}
                      <div className="mt-1 flex flex-wrap items-baseline gap-2 text-xs">
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

                      {!l.is_active && <p className="text-xs text-destructive mt-1">No longer available — remove to continue</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-xs" aria-label={`Decrease ${l.product_name}`} data-testid={`cart-dec-${l.sku}`} onClick={() => setQty.mutate({ variant_id: l.variant_id, qty: l.qty - 1 })}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center tabular-nums">{l.qty}</span>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label={`Increase ${l.product_name}`}
                          data-testid={`cart-inc-${l.sku}`}
                          disabled={l.qty >= Math.min(l.free_stock, 10)}
                          onClick={() => setQty.mutate({ variant_id: l.variant_id, qty: l.qty + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {l.qty >= l.free_stock && <p className="mt-1 text-xs text-brand-amber">Max available: {l.free_stock}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-bold text-foreground">{inr(l.line_total)}</div>
                      {l.qty > 1 && (
                        <div className="text-[11px] text-muted-foreground">{l.qty} × {inr(l.unit_price)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${l.product_name}`} data-testid={`cart-remove-${l.sku}`} onClick={() => remove.mutate(l.variant_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6">
              {cart.total_mrp && cart.total_mrp > cart.subtotal && (
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Total (before sale)</span>
                  <span className="line-through tabular-nums">{inr(cart.total_mrp)}</span>
                </div>
              )}
              {cart.total_discount && cart.total_discount > 0 && (
                <div className="flex justify-between text-sm text-[#2F5233] font-medium mb-2">
                  <span>Your savings (40% OFF)</span>
                  <span className="tabular-nums">−{inr(cart.total_discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                <span className="text-foreground font-semibold">Subtotal ({cart.item_count} items)</span>
                <span className="font-heading text-xl font-bold tabular-nums text-foreground" data-testid="cart-subtotal">{inr(cart.subtotal)}</span>
              </div>
              {cart.referral_discount > 0 && (
                <div className="mt-2 flex justify-between text-sm text-brand-leaf" data-testid="cart-discount">
                  <span>Referral discount</span>
                  <span className="tabular-nums">−{inr(cart.referral_discount)}</span>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">GST, shipping and discounts are recalculated server-side at checkout.</p>

              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold">Referral code</p>
                <div className="flex gap-2">
                  <Input
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                    placeholder={cart.referred_code ?? "Enter code"}
                    data-testid="cart-referral-input"
                  />
                  <Button variant="outline" onClick={() => applyRef.mutate(refInput || null)} disabled={applyRef.isPending} data-testid="cart-referral-apply">
                    Apply
                  </Button>
                </div>
                {cart.referral_status !== "none" && (
                  <p className={`mt-2 text-xs ${cart.referral_status === "valid" ? "text-brand-leaf" : "text-muted-foreground"}`} data-testid="cart-referral-note">
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
