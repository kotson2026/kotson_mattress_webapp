import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
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

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (res: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

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

  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: () => apiGet<CartView>("/cart") });
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => apiGet<CheckoutConfig>("/checkout/config") });

  // Browser sends ONLY ids/qty/address/referral — amounts come back from the server.
  const place = useMutation({
    mutationFn: () =>
      apiPost<CheckoutStartOut>("/checkout/start", {
        address: { ...address, email: address.email || me?.email || "" },
        referral_code: refInput || undefined,
      }),
    onSuccess: async (out) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      const t = out.guest_access_token ? `?t=${out.guest_access_token}` : "";
      if (out.gateway.state === "ready" && out.gateway.rzp_order_id && out.gateway.key_id) {
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
          handler: async (res) => {
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
    if (!cart || cart.items.length === 0) return;
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
                  <Label htmlFor="co-name">Full name</Label>
                  <Input id="co-name" value={address.full_name} onChange={set("full_name")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-name-input" />
                </div>
                <div>
                  <Label htmlFor="co-phone">Phone</Label>
                  <Input id="co-phone" value={address.phone} onChange={set("phone")} inputMode="tel" required minLength={10} className="mt-1.5 min-h-11" data-testid="checkout-phone-input" />
                </div>
                <div>
                  <Label htmlFor="co-email">Email</Label>
                  <Input id="co-email" type="email" value={address.email} onChange={set("email")} required className="mt-1.5 min-h-11" data-testid="checkout-email-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-line1">Address line 1</Label>
                  <Input id="co-line1" value={address.line1} onChange={set("line1")} required minLength={5} className="mt-1.5 min-h-11" data-testid="checkout-line1-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-line2">Address line 2 (optional)</Label>
                  <Input id="co-line2" value={address.line2} onChange={set("line2")} className="mt-1.5 min-h-11" data-testid="checkout-line2-input" />
                </div>
                <div>
                  <Label htmlFor="co-city">City</Label>
                  <Input id="co-city" value={address.city} onChange={set("city")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-city-input" />
                </div>
                <div>
                  <Label htmlFor="co-state">State</Label>
                  <Input id="co-state" value={address.state} onChange={set("state")} required minLength={2} className="mt-1.5 min-h-11" data-testid="checkout-state-input" />
                </div>
                <div>
                  <Label htmlFor="co-pin">PIN code</Label>
                  <Input id="co-pin" value={address.pincode} onChange={set("pincode")} inputMode="numeric" pattern="[1-9][0-9]{5}" required className="mt-1.5 min-h-11" data-testid="checkout-pincode-input" />
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-bold">Order summary</h2>
              <ul className="mt-4 space-y-2 text-sm" data-testid="checkout-summary-items">
                {cart.items.map((l) => (
                  <li key={l.variant_id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{l.product_name} × {l.qty}</span>
                    <span className="tabular-nums">{inr(l.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-heading text-xl font-bold tabular-nums" data-testid="checkout-subtotal">{inr(cart.subtotal)}</span>
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
                {placing || place.isPending ? "Creating order…" : config?.state === "ready" ? "Pay with Razorpay" : "Place order"}
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
