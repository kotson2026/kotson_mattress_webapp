import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Menu, ShoppingBag, UserRound } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { CartView } from "@/lib/types";
import { useMe } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import LogoMark from "@/components/layout/LogoMark";
import { CategoryNavDesktop, CategoryNavMobile } from "@/components/layout/CategoryNav";

// Secondary text links — deliberately lighter weight than the shopping categories.
const SECONDARY = [
  { to: "/about", label: "About Us", testId: "nav-secondary-about" },
  { to: "/faq", label: "FAQ", testId: "nav-secondary-faq" },
];

export { default as LogoMark } from "@/components/layout/LogoMark";

export default function StorefrontHeader() {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiGet<CartView>("/cart"),
  });

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:h-[92px] lg:gap-5">
        <Link
          to="/"
          data-testid="header-logo-link"
          aria-label="Kotson home"
          className="min-w-0 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2"
        >
          <LogoMark />
        </Link>

        {/* Visual shopping categories (desktop) */}
        <div className="ml-4 hidden lg:block">
          <CategoryNavDesktop />
        </div>

        {/* Secondary text links — visually subordinate to the categories */}
        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Secondary">
          {SECONDARY.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              data-testid={s.testId}
              className={({ isActive }) =>
                `min-h-11 inline-flex items-center rounded-md px-3 text-[13px] font-normal outline-none transition-colors duration-200 hover:text-brand-deep focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2 ${
                  isActive ? "text-brand-deep underline decoration-brand-leaf decoration-2 underline-offset-4" : "text-brand-charcoal/60"
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <Link
              to="/track-order"
              aria-label="Track order"
              data-testid="header-track-link"
              className={buttonVariants({ variant: "ghost", size: "sm" }) + " min-h-11"}
            >
              <span className="text-xs font-semibold">Track</span>
            </Link>
          </div>
          <Link
            to={me ? "/account" : "/login"}
            aria-label="Account"
            data-testid="header-account-link"
            className={buttonVariants({ variant: "ghost", size: "icon" }) + " min-h-11 min-w-11"}
          >
            <UserRound className="h-5 w-5" />
          </Link>
          <Link
            to="/cart"
            data-testid="header-cart-link"
            aria-label={`Cart, ${cart?.item_count ?? 0} items`}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " min-h-11 min-w-11"}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="ml-1 tabular-nums" data-testid="header-cart-count">
              {cart?.item_count ?? 0}
            </span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 lg:hidden"
                  aria-label="Open menu"
                  data-testid="header-menu-button"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="flex w-[300px] max-w-[88vw] flex-col overflow-y-auto sm:w-[340px]">
              <SheetHeader>
                <SheetTitle>
                  <LogoMark />
                </SheetTitle>
              </SheetHeader>

              <div className="px-4 pb-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-deep">Shop</p>
                <CategoryNavMobile onNavigate={() => setOpen(false)} />

                <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-deep/70">
                  More
                </p>
                <nav className="flex flex-col" aria-label="Mobile secondary">
                  {[...SECONDARY, { to: "/contact", label: "Contact", testId: "mobile-nav-contact" },
                    { to: "/track-order", label: "Track order", testId: "mobile-nav-track" }].map((s) => (
                    <NavLink
                      key={s.to}
                      to={s.to}
                      onClick={() => setOpen(false)}
                      data-testid={`mobile-${s.testId}`}
                      className={({ isActive }) =>
                        `min-h-11 inline-flex items-center rounded-lg px-3 text-[15px] outline-none transition-colors hover:bg-brand-leaf/10 focus-visible:ring-2 focus-visible:ring-brand-leaf ${
                          isActive ? "font-semibold text-brand-deep" : "text-brand-charcoal/75"
                        }`
                      }
                    >
                      {s.label}
                    </NavLink>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
