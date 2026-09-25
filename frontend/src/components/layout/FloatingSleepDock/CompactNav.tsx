import { ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { CategorySlug } from "./types";

interface Props {
  isShopOpen: boolean;
  onToggleShop: () => void;
  onOpenCategory: (slug: CategorySlug) => void;
}

export default function CompactNav({ isShopOpen, onToggleShop, onOpenCategory }: Props) {
  const location = useLocation();
  const pathname = location.pathname;

  const isWhyKotsonActive = pathname === "/about" || pathname === "/why-kotson";
  const isSleepScienceActive = pathname === "/sleep-science";
  const isStoresActive = pathname === "/contact";
  const isShopActive =
    isShopOpen ||
    (!isWhyKotsonActive &&
      !isSleepScienceActive &&
      !isStoresActive &&
      (pathname.startsWith("/collections") || pathname.startsWith("/products")));

  return (
    <nav
      className="hidden lg:flex items-center gap-1 xl:gap-2"
      aria-label="Primary navigation"
    >
      {/* Shop Dropdown trigger */}
      <button
        type="button"
        onClick={onToggleShop}
        onMouseEnter={() => onOpenCategory("mattresses")}
        aria-expanded={isShopOpen}
        data-testid="compact-shop-button"
        className={`group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer ${
          isShopActive
            ? "bg-brand-deep text-white shadow-sm"
            : "text-brand-charcoal hover:text-brand-deep hover:bg-black/[0.04]"
        }`}
      >
        <span>Shop</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            isShopActive ? "text-white" : "text-brand-charcoal/60 group-hover:text-brand-deep"
          } ${isShopOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Why Kotson */}
      <Link
        to="/about"
        data-testid="compact-why-kotson"
        aria-current={isWhyKotsonActive ? "page" : undefined}
        className={`px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer ${
          isWhyKotsonActive
            ? "bg-brand-deep text-white shadow-sm"
            : "text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04]"
        }`}
      >
        Why Kotson
      </Link>

      {/* Sleep Science */}
      <Link
        to="/sleep-science"
        data-testid="compact-sleep-science"
        aria-current={isSleepScienceActive ? "page" : undefined}
        className={`px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer ${
          isSleepScienceActive
            ? "bg-brand-deep text-white shadow-sm"
            : "text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04]"
        }`}
      >
        Sleep Science
      </Link>

      {/* Stores */}
      <Link
        to="/contact"
        data-testid="compact-stores"
        aria-current={isStoresActive ? "page" : undefined}
        className={`px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf cursor-pointer ${
          isStoresActive
            ? "bg-brand-deep text-white shadow-sm"
            : "text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04]"
        }`}
      >
        Stores
      </Link>
    </nav>
  );
}
