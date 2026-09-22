// Visual category navigation: a small product image above each label, wired to the existing
// /collections/<slug> routes. Images come from the configured image URLs with asset registry fallback.
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import type { AssetSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Route slug -> category info, primary image URL from user prompt, and local fallback. */
export const CATEGORY_NAV = [
  {
    slug: "mattresses",
    label: "Mattresses",
    slot: "category-mattress",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
    localFallback: "/navbar/mattress.png",
  },
  {
    slug: "pillows",
    label: "Pillows",
    slot: "category-pillow",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
    localFallback: "/navbar/pillows.png",
  },
  {
    slug: "toppers",
    label: "Toppers",
    slot: "category-topper",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
    localFallback: "/navbar/toppers.png",
  },
  {
    slug: "baby-kids",
    label: "Baby + Kids",
    slot: "category-babykids",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
    localFallback: "/navbar/baby-kids.png",
  },
] as const;

export function useCategoryAssets() {
  const { data } = useQuery({
    queryKey: ["assets"],
    queryFn: () => apiGet<AssetSlot[]>("/content/assets"),
    staleTime: 60_000,
  });
  const bySlot = new Map((data ?? []).map((a) => [a.slot, a]));
  return CATEGORY_NAV.map((c) => {
    const asset = bySlot.get(c.slot);
    const publishedUrl = asset?.status === "published" && !!asset.file_url ? asset.file_url : null;
    return {
      ...c,
      src: publishedUrl || c.imageUrl,
      fallbackSrc: c.localFallback,
      alt: asset?.alt_text || `${c.label} — Kotson`,
    };
  });
}

/** Correctly-sized labelled placeholder held at the same aspect ratio as the final image. */
function Placeholder({ label }: { label: string }) {
  return (
    <span
      className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-brand-leaf/10 text-center"
      data-testid={`category-nav-placeholder-${label}`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider text-brand-deep/80">Image</span>
      <span className="text-[8px] font-medium uppercase tracking-wide text-brand-deep/55">pending</span>
    </span>
  );
}

function Thumb({
  src,
  fallbackSrc,
  alt,
  label,
}: {
  src: string | null;
  fallbackSrc?: string;
  alt: string;
  label: string;
}) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src || fallbackSrc || null);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || null);
  }, [src, fallbackSrc]);

  return (
    <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-sand/40 p-0.5 ring-1 ring-brand-deep/12 transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:ring-brand-leaf group-focus-visible:ring-brand-leaf">
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (fallbackSrc && currentSrc !== fallbackSrc) {
              setCurrentSrc(fallbackSrc);
            }
          }}
          className="h-full w-full object-contain"
        />
      ) : (
        <Placeholder label={label} />
      )}
    </span>
  );
}

/** Desktop: image-above-label, consistent sizes/spacing/alignment without clipping. */
export function CategoryNavDesktop() {
  const cats = useCategoryAssets();
  return (
    <nav className="hidden items-end gap-1.5 lg:flex" aria-label="Shop categories">
      {cats.map((c) => (
        <NavLink
          key={c.slug}
          to={`/collections/${c.slug}`}
          data-testid={`nav-category-${c.slug}`}
          className={({ isActive }) =>
            cn(
              "group flex min-h-11 w-[84px] flex-col items-center gap-1.5 rounded-xl px-1 py-1.5",
              "outline-none transition-colors duration-200",
              "hover:bg-brand-leaf/8 focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2",
              isActive && "bg-brand-leaf/12"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Thumb src={c.src} fallbackSrc={c.fallbackSrc} alt={c.alt} label={c.label} />
              <span
                className={cn(
                  "text-center text-[11px] font-semibold leading-tight tracking-tight transition-colors",
                  isActive ? "text-brand-deep" : "text-brand-charcoal/85 group-hover:text-brand-deep"
                )}
              >
                {c.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-[2px] w-6 rounded-full transition-colors",
                  isActive ? "bg-brand-leaf" : "bg-transparent group-hover:bg-brand-leaf/45"
                )}
              />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Mobile: image beside label, full-width rows that never force horizontal page scroll. */
export function CategoryNavMobile({ onNavigate }: { onNavigate: () => void }) {
  const cats = useCategoryAssets();
  return (
    <nav className="flex flex-col gap-1.5" aria-label="Shop categories">
      {cats.map((c) => (
        <NavLink
          key={c.slug}
          to={`/collections/${c.slug}`}
          onClick={onNavigate}
          data-testid={`mobile-nav-category-${c.slug}`}
          className={({ isActive }) =>
            cn(
              "group flex min-h-[60px] w-full items-center gap-3 rounded-xl px-3 py-2 outline-none",
              "transition-colors duration-200 hover:bg-brand-leaf/10",
              "focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2",
              isActive ? "bg-brand-leaf/12" : "bg-brand-sand/50"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Thumb src={c.src} fallbackSrc={c.fallbackSrc} alt={c.alt} label={c.label} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[15px] font-semibold",
                    isActive ? "text-brand-deep" : "text-brand-charcoal"
                  )}
                >
                  {c.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">Shop {c.label.toLowerCase()}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
