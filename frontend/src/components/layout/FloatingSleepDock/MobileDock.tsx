import { Link } from "react-router-dom";
import { ShoppingBag, Menu } from "lucide-react";
import SleepDockLogo from "./SleepDockLogo";
import { DOCK_CATEGORIES } from "./types";

interface Props {
  isScrolled: boolean;
  cartCount: number;
  onOpenMobileMenu: () => void;
  onOpenShop: () => void;
}

export default function MobileDock({
  isScrolled,
  cartCount,
  onOpenMobileMenu,
  onOpenShop,
}: Props) {
  if (isScrolled) {
    // STATE 6: Mobile Scrolled Compact Pill
    return (
      <div
        className="flex lg:hidden h-14 w-[calc(100%-24px)] max-w-[420px] items-center justify-between rounded-full border border-black/[0.06] bg-[#FAF8F5]/96 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-300"
        data-testid="mobile-dock-scrolled"
      >
        <SleepDockLogo state="compact" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenShop}
            data-testid="mobile-shop-button"
            className="px-2.5 py-1 text-xs font-semibold text-brand-deep hover:bg-black/[0.04] rounded-full"
          >
            Shop
          </button>

          <Link
            to="/cart"
            aria-label={`Cart, ${cartCount} items`}
            data-testid="mobile-cart-button"
            className="flex items-center gap-1 rounded-full p-1.5 text-brand-charcoal hover:bg-black/[0.04]"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="text-xs font-semibold tabular-nums text-brand-deep">{cartCount}</span>
          </Link>

          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            data-testid="mobile-menu-trigger"
            className="rounded-full p-1.5 text-brand-charcoal hover:bg-black/[0.04]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // STATE 5: Initial Mobile Product Discovery Dock
  return (
    <div
      className="flex lg:hidden flex-col w-[calc(100%-20px)] max-w-[500px] rounded-2xl border border-black/[0.06] bg-[#FAF8F5]/96 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.09)] backdrop-blur-md transition-all duration-300"
      data-testid="mobile-dock-landing"
    >
      {/* Top Row: Logo and Right Actions */}
      <div className="flex items-center justify-between px-1">
        <SleepDockLogo state="landing" />

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            aria-label={`Cart, ${cartCount} items`}
            data-testid="mobile-cart-link-landing"
            className="flex items-center gap-1 rounded-full bg-black/[0.03] px-2.5 py-1 text-xs font-semibold text-brand-charcoal"
          >
            <ShoppingBag className="h-4 w-4 text-brand-deep" />
            <span className="tabular-nums text-brand-deep">{cartCount}</span>
          </Link>

          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            data-testid="mobile-menu-trigger-landing"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand-charcoal hover:bg-black/[0.04]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom Row: 4 Product Category Items */}
      <div className="mt-2.5 flex items-center justify-between gap-1 overflow-x-auto border-t border-black/[0.05] pt-2 scrollbar-none">
        {DOCK_CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/collections/${cat.slug}`}
            className="flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-xl p-1 text-center hover:bg-black/[0.02]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-sand/60 p-0.5">
              <img
                src={cat.imageUrl}
                alt={cat.label}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = cat.localFallback;
                }}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-[10.5px] font-medium leading-tight text-brand-charcoal">
              {cat.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
