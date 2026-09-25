import { useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useMe } from "@/lib/session";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import type { DockState } from "./types";

interface Props {
  state: DockState;
  cartCount: number;
  onOpenSearch: () => void;
}

export default function DockActions({ state, cartCount, onOpenSearch }: Props) {
  const { data: me } = useMe();
  const { openDrawer } = useCheckoutDrawer();
  const isLanding = state === "landing";

  const [isPulsing, setIsPulsing] = useState(false);
  const prevCount = useRef(cartCount);

  useEffect(() => {
    if (cartCount !== prevCount.current) {
      prevCount.current = cartCount;
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 250);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 text-brand-charcoal/65" data-testid="dock-actions">
      {/* Search trigger */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search Kotson products"
        data-testid="dock-search-button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-brand-charcoal/65 hover:text-brand-deep hover:bg-black/[0.03] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer"
      >
        <Search className="h-3.5 w-3.5" />
      </button>

      {/* Track order (subdued text link) */}
      <Link
        to="/track-order"
        aria-label="Track order"
        data-testid="dock-track-link"
        className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-medium text-brand-charcoal/65 hover:text-brand-deep hover:bg-black/[0.03] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        Track
      </Link>

      {/* Account */}
      <Link
        to={me ? "/account" : "/login"}
        aria-label={me ? "My Account" : "Sign In"}
        data-testid="dock-account-link"
        className="flex h-8 w-8 items-center justify-center rounded-full text-brand-charcoal/65 hover:text-brand-deep hover:bg-black/[0.03] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        <UserRound className="h-3.5 w-3.5" />
      </Link>

      {/* Cart Bag Trigger */}
      <button
        type="button"
        onClick={openDrawer}
        aria-label={`Open cart, ${cartCount} items`}
        data-testid="dock-cart-link"
        className="group relative ml-0.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-black/[0.06] bg-white/60 hover:bg-white hover:border-[#2F5233]/25 hover:shadow-xs hover:-translate-y-0.5 text-brand-charcoal/75 transition-all duration-200 shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer"
      >
        <ShoppingBag className="h-3.5 w-3.5 text-brand-deep transition-transform duration-200 group-hover:scale-105" />
        <span
          className={`text-[11.5px] font-medium tabular-nums text-brand-deep transition-transform duration-200 ${
            isPulsing ? "scale-110 font-bold text-[#2F5233]" : "scale-100"
          }`}
          data-testid="dock-cart-count"
        >
          {cartCount}
        </span>
      </button>
    </div>
  );
}
