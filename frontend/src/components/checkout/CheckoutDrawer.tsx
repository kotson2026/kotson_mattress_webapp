/**
 * CheckoutDrawer — Kotson Premium Checkout Experience
 *
 * Layout reference: SleepyCat/GoKwik screenshots (structure only)
 * Design: Kotson's own — cream/warm off-white, Kotson green, charcoal, premium natural aesthetic
 *
 * State machine: CART → PHONE_ENTRY → OTP_VERIFY → ADDRESS_SELECT | ADDRESS_ADD → PAYMENT → SUCCESS | FAILURE
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Package,
  Truck,
  ShieldCheck,
  Tag,
  Plus,
  Check,
  Pencil,
  Trash2,
  ShoppingBag,
} from "lucide-react";

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api";
import { inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import type {
  CartView,
  CartLine,
  CheckoutConfig,
  CheckoutStartOut,
  CheckoutStep,
  CouponResult,
  OtpSessionInfo,
  Product,
  SavedAddress,
} from "@/lib/types";
import PriceDisplay from "@/components/product/PriceDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─────────────────────────────────────────────────────────
// Razorpay types
// ─────────────────────────────────────────────────────────
import type { RazorpayResponse } from "@/lib/razorpay.d";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-js")) return resolve(true);
    const s = document.createElement("script");
    s.id = "razorpay-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────
interface CheckoutState {
  step: CheckoutStep;
  phone: string;
  otpSent: boolean;
  otpToken: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  isNewCustomer: boolean;
  selectedAddressId: string | null;
  inlineAddress: Partial<AddressFields>;
  couponCode: string;
  couponResult: CouponResult | null;
  orderId: string | null;
  orderNumber: string | null;
  guestToken: string | null;
  failureReason: string | null;
}

type CheckoutAction =
  | { type: "SET_STEP"; step: CheckoutStep }
  | { type: "SET_PHONE"; phone: string }
  | { type: "OTP_SENT" }
  | { type: "OTP_VERIFIED"; info: OtpSessionInfo }
  | { type: "SELECT_ADDRESS"; id: string }
  | { type: "SET_INLINE_ADDRESS"; fields: Partial<AddressFields> }
  | { type: "SET_COUPON"; result: CouponResult | null; code: string }
  | { type: "ORDER_SUCCESS"; orderId: string; orderNumber: string; guestToken: string | null }
  | { type: "ORDER_FAILURE"; reason: string }
  | { type: "RESET" };

const initState: CheckoutState = {
  step: "CART",
  phone: "",
  otpSent: false,
  otpToken: null,
  customerId: null,
  customerName: null,
  customerEmail: null,
  isNewCustomer: false,
  selectedAddressId: null,
  inlineAddress: {},
  couponCode: "",
  couponResult: null,
  orderId: null,
  orderNumber: null,
  guestToken: null,
  failureReason: null,
};

function reducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_PHONE":
      return { ...state, phone: action.phone };
    case "OTP_SENT":
      return { ...state, otpSent: true };
    case "OTP_VERIFIED":
      return {
        ...state,
        otpToken: action.info.otp_token,
        customerId: action.info.customer_id,
        customerName: action.info.customer_name,
        customerEmail: action.info.customer_email,
        isNewCustomer: action.info.is_new_customer,
      };
    case "SELECT_ADDRESS":
      return { ...state, selectedAddressId: action.id };
    case "SET_INLINE_ADDRESS":
      return { ...state, inlineAddress: { ...state.inlineAddress, ...action.fields } };
    case "SET_COUPON":
      return { ...state, couponCode: action.code, couponResult: action.result };
    case "ORDER_SUCCESS":
      return { ...state, step: "SUCCESS", orderId: action.orderId, orderNumber: action.orderNumber, guestToken: action.guestToken };
    case "ORDER_FAILURE":
      return { ...state, step: "FAILURE", failureReason: action.reason };
    case "RESET":
      return { ...initState };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────
interface DrawerCtx {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}
const DrawerContext = createContext<DrawerCtx>({ open: false, openDrawer: () => {}, closeDrawer: () => {} });
export const useCheckoutDrawer = () => useContext(DrawerContext);

// ─────────────────────────────────────────────────────────
// Address form fields type
// ─────────────────────────────────────────────────────────
interface AddressFields {
  label: string;
  full_name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const EMPTY_ADDRESS: AddressFields = {
  label: "Home",
  full_name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  is_default: true,
};

// ─────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────
const C = {
  cream: "#FAF7F2",
  creamDark: "#F0EBE1",
  green: "#2F5233",
  greenLight: "#3D6B42",
  greenBg: "#EDF2EE",
  charcoal: "#1A1A1A",
  muted: "#6B6B6B",
  border: "#E5DDD0",
  badge: "#F7F2EA",
  badgeBorder: "rgba(47,82,51,0.2)",
  white: "#FFFFFF",
  error: "#C0392B",
  amber: "#D97706",
};

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

/** Compact qty stepper used inside the drawer cart item */
function QtyStepper({
  qty,
  maxQty,
  onDecrease,
  onIncrease,
  loading,
}: {
  qty: number;
  maxQty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.5 : 1 }}>
      <button
        onClick={onDecrease}
        disabled={loading}
        aria-label="Decrease quantity"
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: `1.5px solid ${C.border}`, background: C.cream,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: C.charcoal, transition: "background 0.15s",
        }}
      >
        −
      </button>
      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600, fontSize: 15 }}>{qty}</span>
      <button
        onClick={onIncrease}
        disabled={loading || qty >= maxQty}
        aria-label="Increase quantity"
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: `1.5px solid ${C.border}`, background: C.cream,
          cursor: qty >= maxQty ? "not-allowed" : "pointer",
          opacity: qty >= maxQty ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: C.charcoal, transition: "background 0.15s",
        }}
      >
        +
      </button>
    </div>
  );
}

/** Individual cart line inside the drawer */
function DrawerCartItem({ line, onQty, onRemove, busy }: {
  line: CartLine;
  onQty: (qty: number) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const dims = [line.size, line.thickness, line.firmness].filter(Boolean).join(" · ");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        display: "flex", gap: 14, padding: "16px 0",
        borderBottom: `1px solid ${C.border}`,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {/* Product Image Thumbnail */}
      <div style={{
        width: 72, height: 72, borderRadius: 10, background: C.creamDark, flexShrink: 0,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${C.border}`,
      }}>
        {line.image ? (
          <img
            src={line.image}
            alt={line.product_name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Package size={24} color={C.muted} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.charcoal, lineHeight: 1.3 }}>
          {line.product_name}
        </div>
        {dims && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{dims}</div>
        )}
        <div style={{ marginTop: 6 }}>
          <PriceDisplay
            salePrice={line.unit_price}
            mrp={line.mrp}
            discountPercent={line.discount_percent}
            size="sm"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <QtyStepper
            qty={line.qty}
            maxQty={Math.min(line.free_stock, 10)}
            onDecrease={() => onQty(line.qty - 1)}
            onIncrease={() => onQty(line.qty + 1)}
            loading={busy}
          />
          <button
            onClick={onRemove}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 8px", color: C.muted, fontSize: 12,
              display: "flex", alignItems: "center", gap: 4,
              transition: "color 0.15s",
            }}
            aria-label={`Remove ${line.product_name}`}
          >
            <Trash2 size={13} />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/** You Might Also Like — complementary product cards in drawer */
function DrawerRecommendations({ cart, onClose }: { cart: CartView; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState<string | null>(null);

  // Derive excluded product IDs from cart
  const cartProductIds = new Set(cart.items.map((i) => i.product_id));

  // Determine recommendation priority based on what's in cart
  const hasMattress = cart.items.some(i => i.product_slug?.includes("mattress") || !!i.size);
  const hasTopper = cart.items.some(i => i.product_slug?.includes("topper"));
  const hasPillow = cart.items.some(i => i.product_slug?.includes("pillow"));

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["catalog-products-all"],
    queryFn: () => apiGet<Product[]>("/catalog/products"),
    staleTime: 5 * 60 * 1000,
  });

  const candidates = (allProducts || []).filter(
    p => !cartProductIds.has(p.id) && p.in_stock && p.is_active !== false
  );

  // Recommendation priority:
  // Mattress in cart -> Pillow / Topper
  // Topper in cart -> Pillow / Mattress
  // Pillow in cart -> Topper / Mattress
  const sorted = [...candidates].sort((a, b) => {
    const score = (p: Product) => {
      const isPillow = p.category_slug === "pillows";
      const isTopper = p.category_slug === "toppers";
      const isMattress = p.category_slug === "mattresses";
      if (hasMattress) {
        if (isPillow) return 3;
        if (isTopper) return 2;
        return 1;
      }
      if (hasTopper) {
        if (isPillow) return 3;
        if (isMattress) return 2;
        return 1;
      }
      if (hasPillow) {
        if (isTopper) return 3;
        if (isMattress) return 2;
        return 1;
      }
      return 1;
    };
    return score(b) - score(a);
  });

  const recs = sorted.slice(0, 3);

  if (!recs.length) return null;

  const handleAction = async (p: Product) => {
    if (p.variants.length > 1) {
      onClose();
      navigate(`/products/${p.slug}`);
      return;
    }
    if (!p.variants[0]) return;
    setAdding(p.id);
    try {
      await apiPost("/cart/items", { variant_id: p.variants[0].id, qty: 1 });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    } catch {
      toast.error("Could not add to cart");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.muted,
        textTransform: "uppercase", marginBottom: 12,
      }}>
        You Might Also Like
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recs.map(p => (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.white,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 8, background: C.creamDark,
              flexShrink: 0, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${C.border}`,
            }}>
              {p.images?.[0] || p.primary_image ? (
                <img
                  src={p.images?.[0] || p.primary_image}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Package size={20} color={C.muted} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.charcoal, lineHeight: 1.3 }}>
                {p.name}
              </div>
              <PriceDisplay
                salePrice={p.price_from}
                mrp={p.mrp_from}
                discountPercent={p.discount_percent}
                isFrom={p.variants.length > 1}
                size="sm"
              />
            </div>
            <button
              onClick={() => handleAction(p)}
              disabled={adding === p.id}
              style={{
                flexShrink: 0,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1.5px solid ${C.green}`,
                background: "transparent",
                color: C.green,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.02em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {adding === p.id ? "…" : p.variants.length > 1 ? "CHOOSE OPTIONS" : "ADD TO CART"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Order total summary panel */
function DrawerOrderTotal({ cart, couponDiscount }: { cart: CartView; couponDiscount: number }) {
  const totalMrp = cart.total_mrp && cart.total_mrp > cart.subtotal ? cart.total_mrp : Math.round(cart.subtotal * 1.4);
  const subtotal = cart.subtotal;
  const savings = (totalMrp > subtotal ? totalMrp - subtotal : 0) + couponDiscount;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  return (
    <div style={{
      background: C.cream, borderRadius: 12, padding: "16px",
      border: `1px solid ${C.border}`, fontSize: 13,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, marginBottom: 8 }}>
        <span>Subtotal</span>
        <span style={{ fontWeight: 600, color: C.charcoal }}>{inr(totalMrp)}</span>
      </div>
      {savings > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", color: C.green, fontWeight: 600, marginBottom: 8 }}>
          <span>Total Discount (40% Off)</span>
          <span>−{inr(savings)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, marginBottom: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Truck size={13} color={C.green} />Shipping
        </span>
        <span style={{ color: C.green, fontWeight: 700 }}>FREE</span>
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4,
        fontWeight: 700, fontSize: 16, color: C.charcoal,
      }}>
        <span>Total</span>
        <span style={{ color: C.green }}>{inr(finalTotal)}</span>
      </div>
    </div>
  );
}

/** Collapsible order summary for checkout steps */
function OrderSummaryAccordion({ cart, couponDiscount }: { cart: CartView; couponDiscount: number }) {
  const [open, setOpen] = useState(false);
  const finalTotal = Math.max(0, cart.subtotal - couponDiscount);

  return (
    <div style={{
      background: C.cream, borderRadius: 12, border: `1px solid ${C.border}`,
      marginBottom: 16, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", cursor: "pointer",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={16} color={C.green} />
          <span style={{ fontWeight: 700, color: C.charcoal, fontSize: 14 }}>Order Summary</span>
          <span style={{
            background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 20,
          }}>
            {cart.item_count} item{cart.item_count !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, color: C.charcoal, fontSize: 16 }}>{inr(finalTotal)}</span>
          {open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
            transition={{ duration: 0.22 }}
          >
            <div style={{ padding: "0 16px 14px" }}>
              {cart.items.map(line => {
                const dims = [line.size, line.thickness, line.firmness].filter(Boolean).join(" · ");
                return (
                  <div key={line.variant_id} style={{
                    display: "flex", gap: 10, paddingTop: 10, paddingBottom: 10,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, background: C.creamDark,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Package size={18} color={C.muted} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{line.product_name} × {line.qty}</div>
                      {dims && <div style={{ fontSize: 11, color: C.muted }}>{dims}</div>}
                      <PriceDisplay salePrice={line.unit_price} mrp={line.mrp} discountPercent={line.discount_percent} size="sm" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.charcoal, flexShrink: 0 }}>
                      {inr(line.line_total)}
                    </div>
                  </div>
                );
              })}
              <div style={{ paddingTop: 10 }}>
                <DrawerOrderTotal cart={cart} couponDiscount={couponDiscount} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Coupon section */
function CouponSection({ state, dispatch, subtotal }: {
  state: CheckoutState;
  dispatch: React.Dispatch<CheckoutAction>;
  subtotal: number;
}) {
  const [input, setInput] = useState(state.couponCode);
  const [loading, setLoading] = useState(false);
  const [publicCoupons, setPublicCoupons] = useState<{ code: string; description: string }[]>([]);
  const [showCoupons, setShowCoupons] = useState(false);

  const apply = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const result = await apiPost<CouponResult>("/checkout/apply-coupon", {
        code: input.trim().toUpperCase(),
        cart_subtotal_paise: subtotal,
      });
      dispatch({ type: "SET_COUPON", result, code: input.trim().toUpperCase() });
      if (result.valid) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not validate coupon");
    } finally {
      setLoading(false);
    }
  };

  const remove = () => {
    setInput("");
    dispatch({ type: "SET_COUPON", result: null, code: "" });
  };

  const loadPublicCoupons = async () => {
    if (showCoupons) { setShowCoupons(false); return; }
    try {
      const coupons = await apiGet<typeof publicCoupons>("/checkout/coupons");
      setPublicCoupons(coupons);
      setShowCoupons(true);
    } catch { /* silently ignore if none */ }
  };

  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: "14px 16px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Tag size={15} color={C.green} />
        <span style={{ fontWeight: 700, fontSize: 13, color: C.charcoal }}>Offers & Coupons</span>
      </div>

      {state.couponResult?.valid ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.greenBg, padding: "10px 12px", borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={14} color={C.green} />
            <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{state.couponCode}</span>
            <span style={{ fontSize: 12, color: C.muted }}>— {state.couponResult.message}</span>
          </div>
          <button
            onClick={remove}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && apply()}
            placeholder="Enter coupon code"
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 8,
              border: `1.5px solid ${C.border}`, fontSize: 13, color: C.charcoal,
              background: C.cream, outline: "none", fontFamily: "inherit",
              letterSpacing: "0.05em",
            }}
          />
          <button
            onClick={apply}
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 16px", borderRadius: 8,
              background: input.trim() ? C.green : C.creamDark,
              color: input.trim() ? C.white : C.muted,
              border: "none", cursor: input.trim() ? "pointer" : "default",
              fontWeight: 700, fontSize: 13, transition: "all 0.15s",
            }}
          >
            {loading ? "…" : "Apply"}
          </button>
        </div>
      )}

      <button
        onClick={loadPublicCoupons}
        style={{
          marginTop: 8, background: "none", border: "none", cursor: "pointer",
          color: C.green, fontSize: 12, fontWeight: 600, padding: 0, textDecoration: "underline",
        }}
      >
        {showCoupons ? "Hide coupons" : "View available coupons"}
      </button>

      <AnimatePresence>
        {showCoupons && publicCoupons.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {publicCoupons.map(c => (
              <div
                key={c.code}
                onClick={() => { setInput(c.code); setShowCoupons(false); }}
                style={{
                  marginTop: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  border: `1px dashed ${C.green}`, background: C.greenBg, display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: C.green, fontSize: 12 }}>{c.code}</span>
                  {c.description && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{c.description}</span>}
                </div>
                <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Use</span>
              </div>
            ))}
          </motion.div>
        )}
        {showCoupons && publicCoupons.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>No coupons available right now</div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Saved address card */
function AddressCard({ addr, selected, onSelect, onEdit, onDelete }: {
  addr: SavedAddress;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: 12, border: `2px solid ${selected ? C.green : C.border}`,
        background: selected ? C.greenBg : C.white,
        padding: "14px 16px", cursor: "pointer", transition: "all 0.18s",
        marginBottom: 10,
      }}
      onClick={onSelect}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selected
            ? <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={10} color="#fff" /></div>
            : <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${C.border}` }} />
          }
          <span style={{
            fontSize: 11, fontWeight: 700, color: selected ? C.green : C.muted,
            background: selected ? C.greenBg : C.creamDark,
            padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em",
          }}>{addr.label}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.error, padding: 4 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 8, paddingLeft: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.charcoal }}>{addr.full_name}</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}{addr.landmark ? ` (Near ${addr.landmark})` : ""}
          <br />{addr.city}, {addr.state} — {addr.pincode}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>+91 {addr.phone}</div>
      </div>
    </div>
  );
}

/** Address form */
function AddressForm({ initial, onSave, onBack, otpToken, loading }: {
  initial: Partial<AddressFields>;
  onSave: (fields: AddressFields) => void;
  onBack: () => void;
  otpToken: string | null;
  loading: boolean;
}) {
  const [f, setF] = useState<AddressFields>({ ...EMPTY_ADDRESS, ...initial });
  const set = (k: keyof AddressFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = () => {
    if (!f.full_name.trim() || f.full_name.trim().length < 2) { toast.error("Please enter your full name"); return; }
    if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 10) { toast.error("Please enter a valid mobile number"); return; }
    if (!f.line1.trim() || f.line1.trim().length < 5) { toast.error("Please enter your delivery address"); return; }
    if (!f.city.trim()) { toast.error("Please enter your city"); return; }
    if (!f.state.trim()) { toast.error("Please enter your state"); return; }
    if (f.email && f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      toast.error("Please enter a valid email address or leave it blank");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(f.pincode.trim())) { toast.error("Please enter a valid 6-digit PIN code"); return; }
    onSave(f);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1.5px solid ${C.border}`, fontSize: 13, color: C.charcoal,
    background: C.cream, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: C.muted,
    marginBottom: 4, marginTop: 12,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {(["Home", "Work", "Other"] as string[]).map(lbl => (
          <button
            key={lbl}
            onClick={() => setF(p => ({ ...p, label: lbl }))}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${f.label === lbl ? C.green : C.border}`,
              background: f.label === lbl ? C.green : "transparent",
              color: f.label === lbl ? C.white : C.muted,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >{lbl}</button>
        ))}
      </div>

      <label style={labelStyle}>Full Name *</label>
      <input style={inputStyle} value={f.full_name} onChange={set("full_name")} placeholder="e.g. Rahul Sharma" />

      <label style={labelStyle}>Mobile Number *</label>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...inputStyle, width: 56, flexShrink: 0, color: C.muted }}>+91</div>
        <input style={{ ...inputStyle, flex: 1 }} value={f.phone} onChange={set("phone")} placeholder="9876543210" inputMode="tel" />
      </div>

      <label style={labelStyle}>Email (optional)</label>
      <input style={inputStyle} type="email" value={f.email} onChange={set("email")} placeholder="rahul@example.com" />

      <label style={labelStyle}>House / Flat / Building *</label>
      <input style={inputStyle} value={f.line1} onChange={set("line1")} placeholder="e.g. Flat 4B, Green Valley Apartments" />

      <label style={labelStyle}>Street / Area</label>
      <input style={inputStyle} value={f.line2} onChange={set("line2")} placeholder="e.g. MG Road, Koramangala" />

      <label style={labelStyle}>Landmark (optional)</label>
      <input style={inputStyle} value={f.landmark} onChange={set("landmark")} placeholder="e.g. Near Metro Station" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={labelStyle}>City *</label>
          <input style={inputStyle} value={f.city} onChange={set("city")} placeholder="Bengaluru" />
        </div>
        <div>
          <label style={labelStyle}>PIN Code *</label>
          <input style={inputStyle} value={f.pincode} onChange={set("pincode")} placeholder="560001" inputMode="numeric" maxLength={6} />
        </div>
      </div>

      <label style={labelStyle}>State *</label>
      <input style={inputStyle} value={f.state} onChange={set("state")} placeholder="Karnataka" />

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, padding: "13px", borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: "transparent", color: C.charcoal, fontWeight: 600, cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            flex: 2, padding: "13px", borderRadius: 10, border: "none",
            background: loading ? C.creamDark : C.green,
            color: loading ? C.muted : C.white,
            fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.18s",
          }}
        >
          {loading ? "Saving…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────
interface CheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CheckoutDrawer({ open, onClose }: CheckoutDrawerProps) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reducer, initState);
  const [busyVariant, setBusyVariant] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [addressSaving, setAddressSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const cooldownRef = useRef<number | null>(null);

  const { data: cart, isLoading: cartLoading } = useQuery<CartView>({
    queryKey: ["cart"],
    queryFn: () => apiGet<CartView>("/cart"),
    enabled: open,
  });

  const { data: config } = useQuery<CheckoutConfig>({
    queryKey: ["checkout-config"],
    queryFn: () => apiGet<CheckoutConfig>("/checkout/config"),
    enabled: open,
  });

  const { data: addresses, refetch: refetchAddresses } = useQuery<SavedAddress[]>({
    queryKey: ["addresses", state.otpToken, me?.id],
    queryFn: () => {
      const params = state.otpToken ? `?otp_token=${state.otpToken}` : "";
      return apiGet<SavedAddress[]>(`/addresses${params}`);
    },
    enabled: open && (state.step === "ADDRESS_SELECT" || state.step === "ADDRESS_ADD") && (!!state.otpToken || !!me),
  });

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC to close (only on CART step — not during payment)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && state.step === "CART") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, state.step, onClose]);

  // Resend OTP cooldown ticker
  useEffect(() => {
    if (otpResendCooldown > 0) {
      cooldownRef.current = window.setTimeout(() => setOtpResendCooldown(c => c - 1), 1000);
    }
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
  }, [otpResendCooldown]);

  // If user is already logged in, skip phone/OTP steps
  const jumpToAddressForLoggedIn = useCallback(() => {
    if (me) {
      dispatch({ type: "OTP_VERIFIED", info: {
        otp_token: "",
        phone: me.phone || "",
        customer_id: me.id,
        customer_name: me.name,
        customer_email: me.email,
        is_new_customer: false,
      }});
      dispatch({ type: "SET_STEP", step: "ADDRESS_SELECT" });
    }
  }, [me]);

  // ── Cart mutations ──
  const setQty = useMutation({
    mutationFn: ({ variant_id, qty }: { variant_id: string; qty: number }) =>
      apiPatch("/cart/items", { variant_id, qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update cart"),
  });

  const removeItem = useMutation({
    mutationFn: (variant_id: string) => apiDelete(`/cart/items/${variant_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  // ── OTP send ──
  const sendOtp = async () => {
    if (!state.phone || state.phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    try {
      await apiPost("/auth/otp/send", { phone: state.phone });
      dispatch({ type: "OTP_SENT" });
      dispatch({ type: "SET_STEP", step: "OTP_VERIFY" });
      setOtpResendCooldown(30);
      toast.success("OTP sent to your mobile number");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    }
  };

  // ── OTP verify ──
  const verifyOtp = async () => {
    if (!otpInput || otpInput.length < 4) {
      toast.error("Please enter the OTP");
      return;
    }
    try {
      const info = await apiPost<OtpSessionInfo>("/auth/otp/verify", {
        phone: state.phone,
        otp: otpInput,
      });
      dispatch({ type: "OTP_VERIFIED", info });
      toast.success("Mobile number verified ✓");
      dispatch({ type: "SET_STEP", step: "ADDRESS_SELECT" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Incorrect or expired OTP");
    }
  };

  // ── Save address ──
  const saveAddress = async (fields: AddressFields) => {
    if (!me && !state.otpToken) {
      // Guest with OTP bypassed — use inline address and go straight to payment
      dispatch({ type: "SET_INLINE_ADDRESS", fields });
      setPaying(true);
      dispatch({ type: "SET_STEP", step: "PROCESSING" });
      await startPayment(fields);
      return;
    }
    setAddressSaving(true);
    try {
      const params = state.otpToken ? `?otp_token=${state.otpToken}` : "";
      await apiPost<SavedAddress>(`/addresses${params}`, fields);
      await refetchAddresses();
      dispatch({ type: "SET_STEP", step: "ADDRESS_SELECT" });
      toast.success("Address saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save address");
    } finally {
      setAddressSaving(false);
    }
  };

  // ── Payment ──
  const startPayment = async (overrideFields?: Partial<AddressFields>) => {
    if (!cart || cart.items.length === 0) { toast.error("Your cart is empty"); return; }

    const selectedAddr = addresses?.find(a => a.id === state.selectedAddressId);
    const inlineFields = overrideFields ?? state.inlineAddress;
    const hasInlineAddress = inlineFields?.full_name && inlineFields?.line1 && inlineFields?.pincode;

    if (!selectedAddr && !hasInlineAddress) {
      toast.error("Please enter a delivery address");
      dispatch({ type: "SET_STEP", step: "ADDRESS_ADD" });
      return;
    }

    const addressPayload = selectedAddr
      ? {
          full_name: selectedAddr.full_name,
          phone: selectedAddr.phone,
          email: selectedAddr.email?.trim() || undefined,
          line1: selectedAddr.line1,
          line2: selectedAddr.line2 || undefined,
          city: selectedAddr.city,
          state: selectedAddr.state,
          pincode: selectedAddr.pincode,
        }
      : {
          full_name: (inlineFields?.full_name || "") as string,
          phone: (inlineFields?.phone || "") as string,
          email: inlineFields?.email?.trim() || undefined,
          line1: (inlineFields?.line1 || "") as string,
          line2: inlineFields?.line2 || undefined,
          city: (inlineFields?.city || "") as string,
          state: (inlineFields?.state || "") as string,
          pincode: (inlineFields?.pincode || "") as string,
        };

    setPaying(true);
    dispatch({ type: "SET_STEP", step: "PROCESSING" });

    try {
      const out = await apiPost<CheckoutStartOut>("/checkout/start", {
        address: addressPayload,
        referral_code: undefined,
        coupon_id: state.couponResult?.valid ? state.couponResult.coupon_id : undefined,
      });

      qc.invalidateQueries({ queryKey: ["orders"] });
      const t = out.guest_access_token ? `?t=${out.guest_access_token}` : "";
      const gatewayReady = out.gateway.state === "ready_test" || out.gateway.state === "ready_live";

      if (gatewayReady && out.gateway.rzp_order_id && out.gateway.key_id) {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          toast.error("Could not load payment — your order is saved");
          dispatch({ type: "ORDER_SUCCESS", orderId: out.order_id, orderNumber: out.order_number, guestToken: out.guest_access_token });
          return;
        }

        const rzp = new window.Razorpay({
          key: out.gateway.key_id,
          amount: out.amounts.total,
          currency: "INR",
          name: "Kotson",
          description: `Order ${out.order_number}`,
          order_id: out.gateway.rzp_order_id,
          prefill: {
            name: addressPayload?.full_name || "",
            email: addressPayload?.email || "",
            contact: addressPayload?.phone || "",
          },
          theme: { color: C.green },
          handler: async (res: RazorpayResponse) => {
            try {
              await apiPost("/checkout/verify", res);
              toast.success("Payment verified ✓");
            } catch {
              toast.info("Payment is being verified — we'll confirm shortly");
            } finally {
              dispatch({ type: "ORDER_SUCCESS", orderId: out.order_id, orderNumber: out.order_number, guestToken: out.guest_access_token });
            }
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment window closed — your order is saved as awaiting payment");
              dispatch({ type: "ORDER_FAILURE", reason: "Payment window closed" });
            },
          },
        });
        rzp.open();
      } else if (out.gateway.state === "pending_keys") {
        toast.info("Order saved — payment gateway keys are not configured yet");
        dispatch({ type: "ORDER_SUCCESS", orderId: out.order_id, orderNumber: out.order_number, guestToken: out.guest_access_token });
      } else {
        dispatch({ type: "ORDER_FAILURE", reason: out.gateway.detail ?? "Payment gateway error" });
        toast.error(out.gateway.detail ?? "Could not start payment — retry shortly");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not place order";
      dispatch({ type: "ORDER_FAILURE", reason: msg });
      toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  const couponDiscount = 0; // Coupons UI coming soon — backend infrastructure is ready

  // ─────────────────────────────────────────────────
  // Step content
  // ─────────────────────────────────────────────────
  const renderStep = () => {
    switch (state.step) {
      // ──── CART ────
      case "CART":
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
              {cartLoading && (
                <div style={{ padding: "40px 0", textAlign: "center", color: C.muted, fontSize: 14 }}>
                  Loading cart…
                </div>
              )}
              {cart && cart.items.length === 0 && (
                <div style={{
                  padding: "80px 24px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  textAlign: "center",
                }}>
                  <div style={{
                    width: 76, height: 76, borderRadius: "50%",
                    background: C.greenBg, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 20,
                  }}>
                    <ShoppingBag size={34} color={C.green} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: C.charcoal, marginBottom: 8 }}>
                    Your cart is empty.
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, maxWidth: 280, lineHeight: 1.5, marginBottom: 28 }}>
                    Discover handcrafted comfort and pure natural sleep made with certified organic materials.
                  </div>
                  <button
                    onClick={() => {
                      document.body.style.overflow = "";
                      onClose();
                      navigate("/collections");
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    style={{
                      padding: "13px 32px", borderRadius: 12, border: "none",
                      background: C.green, color: C.white,
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                      letterSpacing: "0.05em", transition: "all 0.18s",
                      boxShadow: "0 4px 14px rgba(47, 82, 51, 0.2)",
                    }}
                  >
                    EXPLORE PRODUCTS
                  </button>
                </div>
              )}

              {cart && cart.items.length > 0 && (
                <>
                  {/* Free shipping banner */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: C.greenBg, padding: "8px 16px", borderRadius: 8,
                    marginBottom: 4, marginTop: 4,
                  }}>
                    <Truck size={14} color={C.green} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>
                      Free Shipping on all Orders
                    </span>
                  </div>

                  {/* Cart items */}
                  <AnimatePresence>
                    {cart.items.map(line => (
                      <DrawerCartItem
                        key={line.variant_id}
                        line={line}
                        busy={busyVariant === line.variant_id}
                        onQty={(qty) => {
                          setBusyVariant(line.variant_id);
                          setQty.mutate({ variant_id: line.variant_id, qty }, {
                            onSettled: () => setBusyVariant(null),
                          });
                        }}
                        onRemove={() => {
                          setBusyVariant(line.variant_id);
                          removeItem.mutate(line.variant_id, {
                            onSettled: () => setBusyVariant(null),
                          });
                        }}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Recommendations */}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <DrawerRecommendations cart={cart} onClose={onClose} />
                  </div>

                  {/* Order total */}
                  <div style={{ marginTop: 20 }}>
                    <DrawerOrderTotal cart={cart} couponDiscount={couponDiscount} />
                  </div>
                </>
              )}
            </div>

            {/* Sticky CTA */}
            {cart && cart.items.length > 0 && (
              <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}`, background: C.white }}>
                <button
                  onClick={() => {
                    if (me) {
                      jumpToAddressForLoggedIn();
                    } else {
                      dispatch({ type: "SET_STEP", step: "ADDRESS_ADD" });
                    }
                  }}
                  style={{
                    width: "100%", padding: "15px", borderRadius: 12, border: "none",
                    background: C.green, color: C.white, fontWeight: 700, fontSize: 16,
                    cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.18s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <ShieldCheck size={18} />
                  CHECKOUT
                </button>
                {config?.mode === "test" && (
                  <div style={{
                    textAlign: "center", marginTop: 8, fontSize: 11,
                    color: C.amber, fontWeight: 600,
                  }}>
                    ⚡ Razorpay Test Mode — no live charges
                  </div>
                )}
              </div>
            )}
          </div>
        );

      // ──── PHONE ENTRY ────
      case "PHONE_ENTRY":
        return (
          <div style={{ padding: "0 20px" }}>
            {cart && <OrderSummaryAccordion cart={cart} couponDiscount={couponDiscount} />}

            <div style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: "20px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldCheck size={16} color={C.green} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.charcoal }}>Verify Mobile Number</div>
                  <div style={{ fontSize: 12, color: C.muted }}>We'll send a one-time code to confirm</div>
                </div>
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                Mobile Number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  padding: "11px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`,
                  background: C.cream, fontSize: 13, color: C.muted, flexShrink: 0,
                }}>
                  +91
                </div>
                <input
                  autoFocus
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={state.phone}
                  onChange={e => dispatch({ type: "SET_PHONE", phone: e.target.value.replace(/\D/g, "") })}
                  onKeyDown={e => e.key === "Enter" && sendOtp()}
                  placeholder="Enter mobile number"
                  style={{
                    flex: 1, padding: "11px 12px", borderRadius: 8,
                    border: `1.5px solid ${C.border}`, fontSize: 15, color: C.charcoal,
                    background: C.cream, outline: "none", fontFamily: "inherit",
                    letterSpacing: "0.08em",
                  }}
                />
              </div>

              <button
                onClick={sendOtp}
                disabled={state.phone.length < 10}
                style={{
                  width: "100%", marginTop: 14, padding: "13px",
                  borderRadius: 10, border: "none",
                  background: state.phone.length >= 10 ? C.green : C.creamDark,
                  color: state.phone.length >= 10 ? C.white : C.muted,
                  fontWeight: 700, fontSize: 15, cursor: state.phone.length >= 10 ? "pointer" : "not-allowed",
                  transition: "all 0.18s",
                }}
              >
                Send OTP
              </button>
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
              <ShieldCheck size={12} style={{ display: "inline", marginRight: 4 }} />
              Your data is secure and never shared
            </div>
          </div>
        );

      // ──── OTP VERIFY ────
      case "OTP_VERIFY":
        return (
          <div style={{ padding: "0 20px" }}>
            {cart && <OrderSummaryAccordion cart={cart} couponDiscount={couponDiscount} />}

            <div style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: "20px", marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.charcoal, marginBottom: 4 }}>
                Enter OTP
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                Sent to +91 {state.phone}
                <button
                  onClick={() => dispatch({ type: "SET_STEP", step: "PHONE_ENTRY" })}
                  style={{ marginLeft: 8, background: "none", border: "none", color: C.green, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  Change
                </button>
              </div>

              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
                placeholder="• • • • • •"
                style={{
                  width: "100%", padding: "14px", borderRadius: 10,
                  border: `2px solid ${C.border}`, fontSize: 24, textAlign: "center",
                  color: C.charcoal, background: C.cream, outline: "none",
                  fontFamily: "monospace", letterSpacing: "0.4em", boxSizing: "border-box",
                }}
              />

              <button
                onClick={verifyOtp}
                disabled={otpInput.length < 4}
                style={{
                  width: "100%", marginTop: 14, padding: "13px",
                  borderRadius: 10, border: "none",
                  background: otpInput.length >= 4 ? C.green : C.creamDark,
                  color: otpInput.length >= 4 ? C.white : C.muted,
                  fontWeight: 700, fontSize: 15,
                  cursor: otpInput.length >= 4 ? "pointer" : "not-allowed",
                  transition: "all 0.18s",
                }}
              >
                Verify & Continue
              </button>

              <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.muted }}>
                {otpResendCooldown > 0 ? (
                  `Resend OTP in ${otpResendCooldown}s`
                ) : (
                  <button
                    onClick={sendOtp}
                    style={{ background: "none", border: "none", color: C.green, cursor: "pointer", fontWeight: 600, fontSize: 12 }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      // ──── ADDRESS SELECT ────
      case "ADDRESS_SELECT":
        return (
          <div style={{ padding: "0 20px" }}>
            {cart && <OrderSummaryAccordion cart={cart} couponDiscount={0} />}

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={16} color={C.green} />
                <span style={{ fontWeight: 700, fontSize: 14, color: C.charcoal }}>Delivery Address</span>
              </div>
              <button
                onClick={() => dispatch({ type: "SET_STEP", step: "ADDRESS_ADD" })}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: `1.5px solid ${C.green}`, color: C.green,
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                <Plus size={13} />Add New
              </button>
            </div>

            {!addresses || addresses.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <MapPin size={32} color={C.border} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>No saved addresses yet</div>
                <button
                  onClick={() => dispatch({ type: "SET_STEP", step: "ADDRESS_ADD" })}
                  style={{
                    padding: "11px 24px", borderRadius: 10, border: "none",
                    background: C.green, color: C.white, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Add Delivery Address
                </button>
              </div>
            ) : (
              <>
                {addresses.map(addr => (
                  <React.Fragment key={addr.id}>
                    {deleteConfirm === addr.id ? (
                      <div style={{
                        borderRadius: 12, border: `2px solid ${C.error}`, padding: "14px 16px",
                        marginBottom: 10, background: "#fff5f5",
                      }}>
                        <div style={{ fontSize: 13, color: C.charcoal, marginBottom: 10 }}>
                          Delete this address? This cannot be undone.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            style={{
                              flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${C.border}`,
                              background: "transparent", cursor: "pointer", fontWeight: 600, fontSize: 13,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              const params = state.otpToken ? `?otp_token=${state.otpToken}` : "";
                              await apiDelete(`/addresses/${addr.id}${params}`);
                              setDeleteConfirm(null);
                              refetchAddresses();
                              if (state.selectedAddressId === addr.id) dispatch({ type: "SELECT_ADDRESS", id: "" });
                              toast.success("Address deleted");
                            }}
                            style={{
                              flex: 1, padding: "8px", borderRadius: 8, border: "none",
                              background: C.error, color: C.white, cursor: "pointer", fontWeight: 700, fontSize: 13,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <AddressCard
                        addr={addr}
                        selected={state.selectedAddressId === addr.id}
                        onSelect={() => dispatch({ type: "SELECT_ADDRESS", id: addr.id })}
                        onEdit={() => {
                          dispatch({ type: "SET_INLINE_ADDRESS", fields: {
                            ...addr,
                            email: addr.email ?? undefined,
                            line2: addr.line2 ?? undefined,
                            landmark: addr.landmark ?? undefined,
                          } });
                          dispatch({ type: "SET_STEP", step: "ADDRESS_ADD" });
                        }}
                        onDelete={() => setDeleteConfirm(addr.id)}
                      />
                    )}
                  </React.Fragment>
                ))}

                {/* Sticky payment CTA */}
                <div style={{ paddingTop: 8, paddingBottom: 4 }}>
                  <button
                    onClick={() => startPayment()}
                    disabled={!state.selectedAddressId || paying}
                    style={{
                      width: "100%", padding: "15px", borderRadius: 12, border: "none",
                      background: state.selectedAddressId && !paying ? C.green : C.creamDark,
                      color: state.selectedAddressId && !paying ? C.white : C.muted,
                      fontWeight: 700, fontSize: 16, cursor: state.selectedAddressId ? "pointer" : "not-allowed",
                      transition: "all 0.18s", letterSpacing: "0.04em",
                    }}
                  >
                    {paying ? "Processing…" : `Pay ${cart ? inr(Math.max(0, cart.subtotal - couponDiscount)) : ""}`}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
                    <ShieldCheck size={13} color={C.muted} />
                    <span style={{ fontSize: 11, color: C.muted }}>Secured payment powered by Razorpay</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      // ──── ADDRESS ADD ────
      case "ADDRESS_ADD":
        return (
          <div style={{ padding: "0 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.charcoal, marginBottom: 16 }}>
              Add Delivery Address
            </div>
            <AddressForm
              initial={state.inlineAddress}
              onSave={saveAddress}
              onBack={() => dispatch({ type: "SET_STEP", step: "ADDRESS_SELECT" })}
              otpToken={state.otpToken}
              loading={addressSaving}
            />
          </div>
        );

      // ──── PROCESSING ────
      case "PROCESSING":
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", border: `4px solid ${C.greenBg}`,
              borderTopColor: C.green, animation: "spin 0.9s linear infinite",
            }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: C.charcoal }}>Processing Payment…</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 240 }}>
              Please do not close this window or press back
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        );

      // ──── SUCCESS ────
      case "SUCCESS":
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: "0 24px", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: C.greenBg,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={36} color={C.green} strokeWidth={2.5} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, color: C.charcoal }}>Order Confirmed!</div>
            {state.customerName && (
              <div style={{ fontSize: 15, color: C.muted }}>
                Thank you, {state.customerName.split(" ")[0]} 🌿
              </div>
            )}
            {state.orderNumber && (
              <div style={{
                background: C.cream, borderRadius: 10, padding: "10px 20px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Order ID</div>
                <div style={{ fontWeight: 700, color: C.charcoal, fontFamily: "monospace" }}>{state.orderNumber}</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
              <button
                onClick={() => {
                  onClose();
                  const t = state.guestToken ? `?t=${state.guestToken}` : "";
                  navigate(`/order/confirmation/${state.orderId}${t}`);
                }}
                style={{
                  padding: "13px", borderRadius: 10, border: "none",
                  background: C.green, color: C.white, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}
              >
                View Order
              </button>
              <button
                onClick={() => { dispatch({ type: "RESET" }); onClose(); }}
                style={{
                  padding: "13px", borderRadius: 10, border: `1.5px solid ${C.border}`,
                  background: "transparent", color: C.charcoal, fontWeight: 600, cursor: "pointer",
                }}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        );

      // ──── FAILURE ────
      case "FAILURE":
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: "0 24px", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: "#fff0f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
            }}>
              ✕
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: C.charcoal }}>Payment Unsuccessful</div>
            <div style={{ fontSize: 13, color: C.muted, maxWidth: 260 }}>
              {state.failureReason || "Something went wrong. Your cart and selections are preserved."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
              <button
                onClick={() => dispatch({ type: "SET_STEP", step: "ADDRESS_SELECT" })}
                style={{
                  padding: "13px", borderRadius: 10, border: "none",
                  background: C.green, color: C.white, fontWeight: 700, cursor: "pointer",
                }}
              >
                Retry Payment
              </button>
              <button
                onClick={() => dispatch({ type: "RESET" })}
                style={{
                  padding: "13px", borderRadius: 10, border: `1.5px solid ${C.border}`,
                  background: "transparent", color: C.charcoal, fontWeight: 600, cursor: "pointer",
                }}
              >
                Back to Cart
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Step header / title ───
  const stepTitle = () => {
    const count = cart?.item_count ?? 0;
    switch (state.step) {
      case "CART": return `Your Cart (${count} item${count !== 1 ? "s" : ""})`;
      case "PHONE_ENTRY": return "Secure Checkout";
      case "OTP_VERIFY": return "Verify Mobile";
      case "ADDRESS_SELECT": return "Delivery Address";
      case "ADDRESS_ADD": return "Add Address";
      case "PROCESSING": return "Processing…";
      case "SUCCESS": return "Order Confirmed";
      case "FAILURE": return "Payment Failed";
      default: return "Checkout";
    }
  };

  const canGoBack = ["PHONE_ENTRY", "OTP_VERIFY", "ADDRESS_SELECT", "ADDRESS_ADD"].includes(state.step);
  const safeClose = !["PROCESSING"].includes(state.step);

  const handleBack = () => {
    const backMap: Partial<Record<CheckoutStep, CheckoutStep>> = {
      PHONE_ENTRY: "CART",
      OTP_VERIFY: "PHONE_ENTRY",
      ADDRESS_SELECT: "CART",
      // ADDRESS_ADD: goes back to ADDRESS_SELECT only if there are saved addresses (logged-in), else CART
      ADDRESS_ADD: (addresses && addresses.length > 0) ? "ADDRESS_SELECT" : "CART",
    };
    const target = backMap[state.step as CheckoutStep];
    if (target) dispatch({ type: "SET_STEP", step: target });
  };

  // ─────────────────────────────────────────────────────────
  // Render the drawer shell
  // ─────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => safeClose && onClose()}
            style={{
              position: "fixed", inset: 0, background: "rgba(15,12,8,0.55)",
              zIndex: 9998, backdropFilter: "blur(2px)",
            }}
          />

          {/* Drawer panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Cart"
            className="kotson-cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            style={{
              position: "fixed",
              top: 0, right: 0, bottom: 0,
              background: C.white,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 12,
              background: C.cream, flexShrink: 0,
            }}>
              {canGoBack && (
                <button
                  onClick={handleBack}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.border}`,
                    background: C.white, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} color={C.charcoal} />
                </button>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.charcoal }}>{stepTitle()}</div>
                {state.step === "CART" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <ShieldCheck size={11} color={C.green} />
                    <span style={{ fontSize: 11, color: C.muted }}>Secure checkout</span>
                  </div>
                )}
              </div>

              {safeClose && (
                <button
                  onClick={onClose}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.border}`,
                    background: C.white, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                  aria-label="Close"
                >
                  <X size={18} color={C.charcoal} />
                </button>
              )}
            </div>

            {/* Step content */}
            <div style={{
              flex: 1, overflowY: "auto",
              paddingTop: 16, paddingBottom: 24,
            }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  style={{ height: state.step === "CART" ? "100%" : "auto" }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────
// Provider — wraps the app so any component can open the drawer
// ─────────────────────────────────────────────────────────
export function CheckoutDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);

  return (
    <DrawerContext.Provider value={{ open, openDrawer, closeDrawer }}>
      {children}
      <CheckoutDrawer open={open} onClose={closeDrawer} />
    </DrawerContext.Provider>
  );
}

export default CheckoutDrawer;
