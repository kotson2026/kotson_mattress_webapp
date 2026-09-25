import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { CartView, CheckoutConfig, CheckoutStartOut } from "@/lib/types";
import { inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import type { RazorpayResponse } from "@/lib/razorpay.d";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-checkout-js")) return resolve(true);
    const s = document.createElement("script");
    s.id = "razorpay-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const EMPTY_ADDRESS = { full_name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export default function Checkout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [refInput, setRefInput] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (me) {
      setAddress((a) => ({
        ...a,
        full_name: a.full_name || me.name || "",
        email: a.email || me.email || "",
        phone: a.phone || me.phone || "",
      }));
    }
  }, [me]);

  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: () => apiGet<CartView>("/cart") });
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => apiGet<CheckoutConfig>("/checkout/config") });

  // Browser sends ONLY ids/qty/address/referral — amounts come back from the server.
  const place = useMutation({
    mutationFn: () =>
      apiPost<CheckoutStartOut>("/checkout/start", {
        address: {
          full_name: address.full_name.trim(),
          phone: address.phone.trim(),
          email: (address.email || me?.email || "").trim(),
          line1: address.line1.trim(),
          line2: address.line2.trim() || undefined,
          city: address.city.trim(),
          state: address.state.trim(),
          pincode: address.pincode.trim(),
        },
        referral_code: refInput.trim() || undefined,
      }),
    onSuccess: async (out) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      const t = out.guest_access_token ? `?t=${out.guest_access_token}` : "";
      const gatewayReady = out.gateway.state === "ready_test" || out.gateway.state === "ready_live";
      if (gatewayReady && out.gateway.rzp_order_id && out.gateway.key_id) {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          toast.error("Could not load Razorpay — your order is saved as awaiting payment");
          navigate(`/order/confirmation/${out.order_id}${t}`);
          return;
        }
        const rzp = new window.Razorpay({
          key: out.gateway.key_id,
          amount: out.amounts.total,
          currency: "INR",
          name: "Kotson Mattress",
          description: `Order ${out.order_number}`,
          order_id: out.gateway.rzp_order_id,
          prefill: { name: address.full_name, email: address.email, contact: address.phone },
          theme: { color: "#467065" },
          handler: async (res: RazorpayResponse) => {
            try {
              await apiPost("/checkout/verify", res);
              toast.success("Payment verified");
            } catch {
              toast.info("Verification is processing — the webhook will reconcile automatically");
            } finally {
              navigate(`/order/confirmation/${out.order_id}${t}`);
            }
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment window closed — your order is saved as awaiting payment");
              navigate(`/order/confirmation/${out.order_id}${t}`);
            },
          },
        });
        rzp.open();
      } else if (out.gateway.state === "pending_keys") {
        toast.info("Order saved — payment gateway keys are pending, so no payment was taken");
        navigate(`/order/confirmation/${out.order_id}${t}`);
      } else {
        toast.error(out.gateway.detail ?? "Could not start payment — retry shortly");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not place order"),
  });

  const submit = () => {
    if (!cart || cart.items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    const fullName = address.full_name.trim();
    if (!fullName || fullName.length < 2) {
      toast.error("Please enter your full name (at least 2 characters)");
      document.getElementById("co-name")?.focus();
      return;
    }

    const phone = address.phone.trim();
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      document.getElementById("co-phone")?.focus();
      return;
    }

    const emailToUse = (address.email || me?.email || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailToUse || !emailRegex.test(emailToUse)) {
      toast.error("Please enter a valid email address");
      document.getElementById("co-email")?.focus();
      return;
    }

    const line1 = address.line1.trim();
    if (!line1 || line1.length < 5) {
      toast.error("Please enter your delivery street address (at least 5 characters)");
      document.getElementById("co-line1")?.focus();
      return;
    }

    const city = address.city.trim();
    if (!city || city.length < 2) {
      toast.error("Please enter your city");
      document.getElementById("co-city")?.focus();
      return;
    }

    const state = address.state.trim();
    if (!state || state.length < 2) {
      toast.error("Please enter your state");
      document.getElementById("co-state")?.focus();
      return;
    }

    const pincode = address.pincode.trim();
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pincode || !pinRegex.test(pincode)) {
      toast.error("Please enter a valid 6-digit Indian PIN code (e.g. 560001)");
      document.getElementById("co-pin")?.focus();
      return;
    }

    setPlacing(true);
    place.mutate(undefined, { onSettled: () => setPlacing(false) });
  };

  const set = (k: keyof typeof EMPTY_ADDRESS) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Checkout</h1>

        {config?.mode === "test" && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-4 py-2 text-xs font-semibold text-brand-amber" data-testid="test-mode-badge">
            ⚡ Razorpay Test Mode — no live charges
          </div>
        )}

        {config?.state === "pending_keys" && (
          <div className="mt-4 rounded-2xl border border-brand-amber/40 bg-brand-amber/5 p-4 text-sm" data-testid="gateway-pending-note">
            <strong className="text-brand-amber">Payment gateway pending.</strong> Razorpay test keys are not configured yet. You can place the
            order — it will be saved as <em>Awaiting payment</em>; no payment will be taken until the owner enables the gateway.
          </div>
        )}

        {!cart || cart.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center" data-testid="checkout-empty">
            <p className="font-heading text-lg font-semibold">Nothing to check out</p>
            <Link to="/collections" className="mt-3 inline-block text-brand-deep underline">Browse the collection</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <section aria-label="Delivery details" className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-bold">Delivery details</h2>
              {!me && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Checking out as guest — <Link to="/login" className="text-brand-deep underline">sign in</Link> to keep your order history.
                </p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="co-name">Full name <span className="text-destructive">*</span></Label>
                  <Input id="co-name" placeholder="e.g. Rahul Sharma" value={address.full_name} onChange={set("full_name")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-name-input" />
                </div>
                <div>
                  <Label htmlFor="co-phone">Phone <span className="text-destructive">*</span></Label>
                  <Input id="co-phone" placeholder="e.g. 9876543210" value={address.phone} onChange={set("phone")} inputMode="tel" required minLength={10} className="mt-1.5 min-h-11" data-testid="checkout-phone-input" />
                </div>
                <div>
                  <Label htmlFor="co-email">Email <span className="text-destructive">*</span></Label>
                  <Input id="co-email" type="email" placeholder="e.g. rahul@example.com" value={address.email} onChange={set("email")} required className="mt-1.5 min-h-11" data-testid="checkout-email-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-line1">Address line 1 <span className="text-destructive">*</span></Label>
                  <Input id="co-line1" placeholder="e.g. Flat 402, Green Valley Apts, MG Road" value={address.line1} onChange={set("line1")} required minLength={5} className="mt-1.5 min-h-11" data-testid="checkout-line1-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-line2">Address line 2 <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="co-line2" placeholder="e.g. Landmark / Near Metro" value={address.line2} onChange={set("line2")} className="mt-1.5 min-h-11" data-testid="checkout-line2-input" />
                </div>
                <div>
                  <Label htmlFor="co-city">City <span className="text-destructive">*</span></Label>
                  <Input id="co-city" placeholder="e.g. Bengaluru" value={address.city} onChange={set("city")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-city-input" />
                </div>
                <div>
                  <Label htmlFor="co-state">State <span className="text-destructive">*</span></Label>
                  <Input id="co-state" placeholder="e.g. Karnataka" value={address.state} onChange={set("state")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-state-input" />
                </div>
                <div>
                  <Label htmlFor="co-pin">PIN code <span className="text-destructive">*</span></Label>
                  <Input id="co-pin" placeholder="e.g. 560001" value={address.pincode} onChange={set("pincode")} inputMode="numeric" pattern="[1-9][0-9]{5}" required className="mt-1.5 min-h-11" data-testid="checkout-pincode-input" />
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-bold">Order summary</h2>
              <ul className="mt-4 space-y-2 text-sm" data-testid="checkout-summary-items">
                {cart.items.map((l) => (
                  <li key={l.variant_id} className="flex flex-col gap-0.5 border-b border-border/40 pb-2">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-foreground">{l.product_name} × {l.qty}</span>
                      <span className="tabular-nums font-bold text-foreground">{inr(l.line_total)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{[l.size, l.thickness].filter(Boolean).join(" · ")}</span>
                      {l.mrp && l.mrp > l.unit_price && (
                        <>
                          <span>·</span>
                          <span className="line-through">MRP {inr(l.mrp)}</span>
                          <span className="text-[#2F5233] font-semibold">({l.discount_percent ? `${Math.round(l.discount_percent)}% OFF` : "40% OFF"})</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {cart.total_mrp && cart.total_mrp > cart.subtotal && (
                <div className="mt-4 flex justify-between text-sm text-muted-foreground">
                  <span>Total MRP</span>
                  <span className="line-through tabular-nums">{inr(cart.total_mrp)}</span>
                </div>
              )}
              {cart.total_discount && cart.total_discount > 0 && (
                <div className="mt-1 flex justify-between text-sm text-[#2F5233] font-medium">
                  <span>Sitewide Sale (40% OFF)</span>
                  <span className="tabular-nums">−{inr(cart.total_discount)}</span>
                </div>
              )}

              <div className="mt-2 flex justify-between border-t border-border pt-3 text-sm">
                <span className="text-foreground font-semibold">Payable Subtotal</span>
                <span className="font-heading text-xl font-bold tabular-nums text-foreground" data-testid="checkout-subtotal">{inr(cart.subtotal)}</span>
              </div>
              {cart.referral_discount > 0 && (
                <div className="mt-1 flex justify-between text-sm text-brand-leaf">
                  <span>Referral discount ({cart.referred_code})</span>
                  <span className="tabular-nums">−{inr(cart.referral_discount)}</span>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                GST {cart.referral_note ? "" : "and shipping lines"} are finalized server-side when the order is created — the amounts you see here are re-verified before payment.
              </p>

              <div className="mt-4">
                <Label htmlFor="co-ref">Referral code (optional)</Label>
                <Input id="co-ref" value={refInput} onChange={(e) => setRefInput(e.target.value.toUpperCase())} placeholder={cart.referred_code ?? ""} className="mt-1.5 min-h-11" data-testid="checkout-referral-input" />
                {cart.referral_status !== "none" && <p className="mt-1 text-xs text-muted-foreground">{cart.referral_note}</p>}
              </div>

              <Button
                size="lg"
                className="mt-6 w-full min-h-12"
                onClick={submit}
                disabled={placing || place.isPending}
                data-testid="checkout-pay-btn"
              >
                {placing || place.isPending
                  ? "Creating order…"
                  : config?.state === "ready_test" || config?.state === "ready_live"
                  ? "Pay with Razorpay"
                  : "Place order"}
              </Button>
              {config?.mode === "test" && (
                <Badge variant="outline" className="mt-3 w-full justify-center border-brand-amber text-brand-amber">
                  Test mode — no live charges
                </Badge>
              )}
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
