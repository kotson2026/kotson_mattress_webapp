import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Menu, ShoppingBag, UserRound } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { CartView, Category } from "@/lib/types";
import { useMe } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Wordmark placeholder — replaced by the official logo files (slots logo-header-light/dark) via /admin.
export function LogoMark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-baseline gap-2 leading-none" aria-label="Kotson Mattress">
      <span className={`font-heading text-2xl font-black tracking-tight ${light ? "text-brand-sand" : "text-brand-charcoal"}`}>
        KOTSON
      </span>
      <span className={`text-[10px] font-medium uppercase tracking-[0.28em] ${light ? "text-brand-sand/70" : "text-brand-deep"}`}>
        Naturals
      </span>
      <span className="h-2 w-2 rounded-full bg-brand-leaf" aria-hidden="true" />
    </span>
  );
}

export default function StorefrontHeader() {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/catalog/categories"),
  });
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiGet<CartView>("/cart"),
  });

  const nav = [
    ...(cats ?? []).map((c) => ({ to: `/collections/${c.slug}`, label: c.name })),
    { to: "/about", label: "About" },
    { to: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" data-testid="header-logo-link" aria-label="Kotson Mattress home">
          <LogoMark />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-leaf/10 hover:text-brand-deep ${
                  isActive ? "text-brand-deep" : "text-foreground/80"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/track-order"
            aria-label="Track order"
            data-testid="header-track-link"
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " min-h-11"}
          >
            <span className="text-xs font-semibold">Track</span>
          </Link>
          <Link
            to={me ? "/account" : "/login"}
            aria-label="Account"
            data-testid="header-account-link"
            className={buttonVariants({ variant: "ghost", size: "icon" }) + " min-h-11"}
          >
            <UserRound className="h-5 w-5" />
          </Link>
          <Link
            to="/cart"
            data-testid="header-cart-link"
            aria-label={`Cart, ${cart?.item_count ?? 0} items`}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " min-h-11"}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="ml-1 tabular-nums" data-testid="header-cart-count">
              {cart?.item_count ?? 0}
            </span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" data-testid="header-menu-button">
                  <Menu className="h-5 w-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <LogoMark />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {nav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-md px-3 py-2 text-base font-medium hover:bg-brand-leaf/10"
                  >
                    {n.label}
                  </NavLink>
                ))}
                <NavLink to="/contact" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-3 py-2 text-base font-medium hover:bg-brand-leaf/10">
                  Contact
                </NavLink>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
