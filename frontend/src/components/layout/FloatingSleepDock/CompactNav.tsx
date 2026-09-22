import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { CategorySlug } from "./types";

interface Props {
  isShopOpen: boolean;
  onToggleShop: () => void;
  onOpenCategory: (slug: CategorySlug) => void;
}

export default function CompactNav({ isShopOpen, onToggleShop, onOpenCategory }: Props) {
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
        className={`group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf ${
          isShopOpen
            ? "bg-brand-deep text-white shadow-sm"
            : "text-brand-charcoal hover:text-brand-deep hover:bg-black/[0.04]"
        }`}
      >
        <span>Shop</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            isShopOpen ? "rotate-180 text-white" : "text-brand-charcoal/60 group-hover:text-brand-deep"
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Why Kotson */}
      <a
        href="#why-kotson"
        onClick={(e) => {
          if (window.location.pathname !== "/") {
            // Let normal navigation take over
            return;
          }
          const el = document.getElementById("why-kotson");
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        data-testid="compact-why-kotson"
        className="px-3.5 py-1.5 rounded-full text-[13.5px] font-medium text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        Why Kotson
      </a>

      {/* Sleep Science */}
      <a
        href="#zones"
        onClick={(e) => {
          if (window.location.pathname !== "/") {
            return;
          }
          const el = document.getElementById("zones");
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        data-testid="compact-sleep-science"
        className="px-3.5 py-1.5 rounded-full text-[13.5px] font-medium text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        Sleep Science
      </a>

      {/* Stores */}
      <Link
        to="/contact"
        data-testid="compact-stores"
        className="px-3.5 py-1.5 rounded-full text-[13.5px] font-medium text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.04] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        Stores
      </Link>
    </nav>
  );
}
