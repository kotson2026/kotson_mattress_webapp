import { useState } from "react";
import { Link } from "react-router-dom";
import { DOCK_CATEGORIES, type CategorySlug } from "./types";

interface Props {
  activeCategory: CategorySlug | null;
  onSelectCategory: (slug: CategorySlug | null) => void;
}

export default function LandingProductNav({ activeCategory, onSelectCategory }: Props) {
  return (
    <nav
      className="hidden lg:flex items-center justify-center gap-6 xl:gap-8"
      aria-label="Product categories"
    >
      {DOCK_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.slug;
        return (
          <ProductNavItem
            key={cat.slug}
            cat={cat}
            isActive={isActive}
            onHover={() => onSelectCategory(cat.slug)}
          />
        );
      })}
    </nav>
  );
}

function ProductNavItem({
  cat,
  isActive,
  onHover,
}: {
  cat: (typeof DOCK_CATEGORIES)[number];
  isActive: boolean;
  onHover: () => void;
}) {
  const [imgSrc, setImgSrc] = useState(cat.localFallback || cat.imageUrl);

  return (
    <Link
      to={`/collections/${cat.slug}`}
      onMouseEnter={onHover}
      onPointerEnter={onHover}
      onFocus={onHover}
      data-testid={`dock-category-${cat.slug}`}
      className={`group relative flex flex-col items-center gap-1.5 px-3.5 py-1 rounded-2xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2 ${
        isActive ? "bg-black/[0.03]" : "hover:bg-black/[0.02]"
      }`}
    >
      {/* Product Image Stage — slightly reduced to keep dock light and airy */}
      <div className="relative flex h-[46px] w-[54px] xl:h-[48px] xl:w-[58px] items-center justify-center">
        {/* Subtle organic backlight for contrast against varying video frames */}
        <div
          className={`absolute inset-0 m-auto h-9 w-9 rounded-full bg-brand-sand/70 transition-transform duration-300 ease-out group-hover:scale-105 ${
            isActive ? "scale-105 ring-1 ring-brand-leaf/30" : ""
          }`}
          aria-hidden="true"
        />

        {/* Transparent Product Image with restrained micro-interaction */}
        <img
          src={imgSrc}
          alt={`${cat.label} - Kotson`}
          width={56}
          height={48}
          onError={() => {
            if (imgSrc !== cat.localFallback) {
              setImgSrc(cat.localFallback);
            }
          }}
          className="relative z-10 block h-full w-full object-contain drop-shadow-2xs transition-transform duration-[200ms] ease-out will-change-transform group-hover:-translate-y-[3px] group-hover:scale-[1.04]"
        />
      </div>

      {/* Category Label (6-8px below image) */}
      <span
        className={`text-[12px] font-medium tracking-tight transition-colors duration-[200ms] ease-out ${
          isActive
            ? "text-brand-deep font-semibold"
            : "text-brand-charcoal/80 group-hover:text-brand-deep"
        }`}
      >
        {cat.label}
      </span>

      {/* Subtle active pill indicator */}
      {isActive && (
        <span
          className="absolute -bottom-1 h-0.5 w-6 rounded-full bg-brand-leaf animate-in fade-in zoom-in duration-200"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
