import { Link } from "react-router-dom";
import { X, ArrowRight, UserRound, ShoppingBag, ShieldCheck } from "lucide-react";
import { useMe } from "@/lib/session";
import { DOCK_CATEGORIES } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cartCount: number;
}

const SECONDARY_NAV = [
  { label: "Why Kotson", href: "#why-kotson" },
  { label: "Sleep Science", href: "#zones" },
  { label: "Stores", href: "/contact" },
  { label: "Track Order", href: "/track-order" },
  { label: "About Us", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export default function MobileNavSheet({ isOpen, onClose, cartCount }: Props) {
  const { data: me } = useMe();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="mobile-nav-sheet"
    >
      <div
        className="flex h-full w-full max-w-[360px] flex-col justify-between bg-[#FAF8F5] p-6 shadow-2xl transition-all animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <Link to="/" onClick={onClose} aria-label="Kotson home">
              <img
                src="/brand/kotson-wordmark.png"
                alt="KOTSON"
                width={1601}
                height={184}
                className="h-4 w-auto object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-full p-1.5 text-brand-charcoal/70 hover:bg-black/5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Primary Categories with Product Thumbnails */}
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-deep">
              Collections
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {DOCK_CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/collections/${cat.slug}`}
                  onClick={onClose}
                  data-testid={`mobile-category-${cat.slug}`}
                  className="group flex items-center justify-between rounded-xl p-2.5 hover:bg-black/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-sand/60 p-1">
                      <img
                        src={cat.imageUrl}
                        alt={cat.label}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = cat.localFallback;
                        }}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <span className="font-heading text-sm font-bold text-brand-charcoal group-hover:text-brand-deep">
                        {cat.label}
                      </span>
                      <span className="block text-[11px] text-brand-charcoal/60">
                        {cat.tagline}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-charcoal/40 transition-transform group-hover:translate-x-1 group-hover:text-brand-deep" />
                </Link>
              ))}
            </div>
          </div>

          {/* Secondary Links */}
          <div className="mt-6 border-t border-black/[0.06] pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-charcoal/50">
              Discover
            </p>
            <nav className="mt-2 grid grid-cols-2 gap-2" aria-label="Mobile secondary links">
              {SECONDARY_NAV.map((s) => (
                <Link
                  key={s.label}
                  to={s.href}
                  onClick={onClose}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-charcoal/80 hover:text-brand-deep hover:bg-black/[0.03]"
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Footer Account & Cart Actions */}
        <div className="border-t border-black/[0.06] pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              to={me ? "/account" : "/login"}
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black/[0.04] py-2.5 text-xs font-semibold text-brand-charcoal hover:bg-black/[0.07]"
            >
              <UserRound className="h-4 w-4" />
              <span>{me ? "My Account" : "Sign In"}</span>
            </Link>
            <Link
              to="/cart"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-deep py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-deep/90"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Cart ({cartCount})</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
