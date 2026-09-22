import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { CartView } from "@/lib/types";
import SleepDockLogo from "./SleepDockLogo";
import LandingProductNav from "./LandingProductNav";
import CompactNav from "./CompactNav";
import DockActions from "./DockActions";
import ProductShelf from "./ProductShelf";
import SearchModal from "./SearchModal";
import MobileDock from "./MobileDock";
import MobileNavSheet from "./MobileNavSheet";
import type { DockState, CategorySlug } from "./types";

export default function FloatingSleepDock() {
  // Navigation mode states: Landing and Compact
  const [dockState, setDockState] = useState<DockState>("landing");
  const [activeCategory, setActiveCategory] = useState<CategorySlug | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Cart query
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiGet<CartView>("/cart"),
    staleTime: 30_000,
  });
  const cartCount = cart?.item_count ?? 0;

  // Refs for tracking scroll position & direction with hysteresis
  const lastScrollY = useRef(0);
  const shelfCloseTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Optimized Scroll Listener with Hysteresis & rAF (Landing <-> Compact)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentY = window.scrollY;
      lastScrollY.current = currentY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          setDockState((prev) => {
            // Scroll transformation thresholds with hysteresis
            if (currentY < 80) {
              return "landing";
            }

            if (currentY >= 140 && prev === "landing") {
              // Subconscious mattress compression micro-interaction
              if (!prefersReduced) {
                setIsCompressing(true);
                setTimeout(() => setIsCompressing(false), 420);
              }
              return "compact";
            }

            return prev;
          });

          // Close active shelf on significant scroll down
          if (currentY > 220) {
            setActiveCategory(null);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prefersReduced]);

  // Click outside to close shelf
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveCategory(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Escape key closes shelf & search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveCategory(null);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Category Hover handlers with debounce
  const handleCategoryHover = useCallback((slug: CategorySlug | null) => {
    if (shelfCloseTimer.current) {
      clearTimeout(shelfCloseTimer.current);
      shelfCloseTimer.current = null;
    }
    setActiveCategory(slug);
  }, []);

  const handleShelfClose = useCallback(() => {
    shelfCloseTimer.current = setTimeout(() => {
      setActiveCategory(null);
    }, 180);
  }, []);

  const isLanding = dockState === "landing";

  return (
    <>
      {/* Floating Sleep Dock Container — centered, 18-20px from top */}
      <div
        ref={containerRef}
        onMouseLeave={handleShelfClose}
        className="fixed top-[18px] sm:top-5 inset-x-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6"
        data-testid="floating-sleep-dock-container"
      >
        {/* DESKTOP DOCK (lg:flex) — Rounded pill dock centered over the hero */}
        <div
          data-testid="floating-sleep-dock"
          data-state={dockState}
          className={`pointer-events-auto relative hidden lg:flex items-center justify-between border border-black/[0.045] bg-[#FAF8F5]/96 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all ease-[cubic-bezier(0.22,1,0.36,1)] ${
            prefersReduced ? "duration-150" : "duration-[380ms]"
          } ${
            isLanding
              ? "w-[92%] max-w-[1120px] h-[88px] px-8 sm:px-10 rounded-full"
              : "w-[860px] max-w-[90vw] h-[60px] px-6 rounded-full"
          } ${isCompressing ? "scale-y-[1.03] scale-x-[0.985]" : "scale-100"}`}
        >
          {/* LEFT: KOTSON LOGO */}
          <div className="flex shrink-0 items-center">
            <SleepDockLogo state={dockState} />
          </div>

          {/* CENTER: LANDING (4 Category Items) vs COMPACT (Shop + Story Links) */}
          <div className="flex flex-1 items-center justify-center transition-all duration-300">
            {isLanding ? (
              <div className="animate-in fade-in-50 zoom-in-95 duration-250">
                <LandingProductNav
                  activeCategory={activeCategory}
                  onSelectCategory={handleCategoryHover}
                />
              </div>
            ) : (
              <div className="animate-in fade-in-50 zoom-in-95 duration-250">
                <CompactNav
                  isShopOpen={activeCategory !== null}
                  onToggleShop={() =>
                    setActiveCategory((prev) => (prev ? null : "mattresses"))
                  }
                  onOpenCategory={(slug) => setActiveCategory(slug)}
                />
              </div>
            )}
          </div>

          {/* RIGHT: TIGHTENED UTILITY GROUP (Search, Track, Account, Cart) */}
          <DockActions
            state={dockState}
            cartCount={cartCount}
            onOpenSearch={() => setIsSearchOpen(true)}
          />

          {/* STATE 2: PRODUCT SHELF MEGA MENU (Connected below the dock) */}
          {activeCategory && (
            <ProductShelf
              activeCategory={activeCategory}
              onSelectCategory={(slug) => setActiveCategory(slug)}
              onClose={() => setActiveCategory(null)}
            />
          )}
        </div>

        {/* MOBILE DOCK */}
        <div className="pointer-events-auto flex lg:hidden w-full justify-center">
          <MobileDock
            isScrolled={!isLanding}
            cartCount={cartCount}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenShop={() => setIsMobileMenuOpen(true)}
          />
        </div>
      </div>

      {/* SEARCH MODAL */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* MOBILE NAVIGATION SHEET */}
      <MobileNavSheet
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        cartCount={cartCount}
      />
    </>
  );
}
