import { ShoppingBag, Menu } from "lucide-react";
import SleepDockLogo from "./SleepDockLogo";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

interface Props {
  isScrolled: boolean;
  cartCount: number;
  onOpenMobileMenu: () => void;
  onOpenShop?: () => void;
}

export default function MobileDock({
  isScrolled,
  cartCount,
  onOpenMobileMenu,
}: Props) {
  const { openDrawer } = useCheckoutDrawer();

  return (
    <div
      className="flex lg:hidden h-[62px] sm:h-[66px] w-full max-w-[460px] items-center justify-between rounded-full border border-black/[0.06] bg-[#FAF8F5]/96 px-4 sm:px-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-300"
      data-testid="mobile-dock"
    >
      {/* LEFT: KOTSON LOGO */}
      <div className="flex shrink-0 items-center">
        <SleepDockLogo state={isScrolled ? "compact" : "landing"} />
      </div>

      {/* RIGHT: CART + HAMBURGER MENU ONLY */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={openDrawer}
          aria-label={`Open cart, ${cartCount} items`}
          data-testid="mobile-cart-button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-brand-charcoal transition-colors cursor-pointer"
        >
          <ShoppingBag className="h-4 w-4 text-brand-deep" />
          <span className="tabular-nums font-bold text-brand-deep">{cartCount}</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          data-testid="mobile-menu-trigger"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-brand-charcoal hover:bg-black/[0.05] transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
