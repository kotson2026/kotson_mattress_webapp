import { ShoppingBag, Menu } from "lucide-react";
import SleepDockLogo from "./SleepDockLogo";
import { useCheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

interface Props {
  cartCount: number;
  onOpenShop: () => void;
  onOpenMobileMenu: () => void;
  onExpandCompact: () => void;
}

export default function MinimalNav({
  cartCount,
  onOpenShop,
  onOpenMobileMenu,
  onExpandCompact,
}: Props) {
  const { openDrawer } = useCheckoutDrawer();

  return (
    <div
      onMouseEnter={onExpandCompact}
      onFocus={onExpandCompact}
      className="flex w-full items-center justify-between px-3"
      data-testid="minimal-dock-content"
    >
      {/* Logo */}
      <SleepDockLogo state="minimal" />

      {/* Shop Button */}
      <button
        type="button"
        onClick={onOpenShop}
        data-testid="minimal-shop-button"
        className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-brand-charcoal hover:text-brand-deep hover:bg-black/[0.04] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer"
      >
        Shop
      </button>

      {/* Menu Hamburger */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open navigation menu"
        data-testid="minimal-menu-button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-brand-charcoal hover:bg-black/[0.04] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Bag Icon */}
      <button
        type="button"
        onClick={openDrawer}
        aria-label={`Open cart, ${cartCount} items`}
        data-testid="minimal-cart-link"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-brand-charcoal hover:bg-black/[0.04] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer"
      >
        <ShoppingBag className="h-4 w-4" />
        <span className="text-xs font-semibold tabular-nums">{cartCount}</span>
      </button>
    </div>
  );
}
