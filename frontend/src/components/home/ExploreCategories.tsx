import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   EXPLORE OUR CATEGORIES — 5 Kotson Categories
   1. Mattresses
   2. Pillows
   3. Toppers
   4. Baby + Kids
   5. Customizable Products
   Desktop (1200px+): 5 equal columns in one row
   Tablet (640px–1199px): Balanced 2-col / 3-col responsive layout
   Mobile (<640px): Vertical stack
   Single source of truth: FAMILIES array below.
   ───────────────────────────────────────────────────────────────────────── */

interface ProductFamily {
  id: string;
  slug: string;
  name: string;
  productCount?: number;     // update here only
  countLabel?: string;       // "03 Products" | "CUSTOMIZE YOURS"
  ctaLabel: string;         // per-family CTA text
  route: string;
  type?: "standard" | "customizable";
  action?: (() => void) | null;
  image: string;            // primary / single image
  images?: string[];        // optional layered composition
  fallbackImage: string;
  alt: string;
  motionMultiplier: { x: number; y: number };
}

const FAMILIES: ProductFamily[] = [
  {
    id: "mattresses",
    slug: "mattresses",
    name: "Mattresses",
    productCount: 3,
    countLabel: "03 Products",
    ctaLabel: "Explore Mattresses",
    route: "/collections/mattresses",
    image: "/navbar/mattress.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-23-58e2ca4e-ebff-4af3-be34-e3e84717dbb8.jpg",
    alt: "Kotson Organic Latex Mattress Collection — Ortho Therapy, Spine Balance & Ortho Core Max",
    motionMultiplier: { x: 0.5, y: 0.4 },
  },
  {
    id: "pillows",
    slug: "pillows",
    name: "Pillows",
    productCount: 12,
    countLabel: "12 Products",
    ctaLabel: "Explore Pillows",
    route: "/collections/pillows",
    image: "/navbar/pillows.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
    alt: "Kotson Latex Pillow Collection — Standard, Ortho Wave, Jumbo, Dualis & more",
    motionMultiplier: { x: 0.9, y: 0.8 },
  },
  {
    id: "toppers",
    slug: "toppers",
    name: "Toppers",
    productCount: 1,
    countLabel: "01 Product",
    ctaLabel: "Explore Topper",
    route: "/collections/toppers",
    image: "/navbar/toppers.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
    alt: "Kotson Organic Latex Mattress Topper",
    motionMultiplier: { x: 0.7, y: 1.0 },
  },
  {
    id: "baby-kids",
    slug: "baby-kids",
    name: "Baby + Kids",
    productCount: 2,
    countLabel: "02 Products",
    ctaLabel: "Explore Baby + Kids",
    route: "/collections/baby-kids",
    image: "/navbar/baby-kids.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
    alt: "Kotson Baby & Kids Pillow Collection — Natural Nest Junior & Mini",
    motionMultiplier: { x: 0.4, y: 0.4 },
  },
  {
    id: "customizable-products",
    slug: "customizable-products",
    name: "Customizable Products",
    countLabel: "CUSTOMIZE YOURS",
    ctaLabel: "Customize",
    route: "",
    type: "customizable",
    action: null,
    image: "https://cdn.phototourl.com/member/2026-09-25-fdcc5d89-9660-48c9-8356-3c13ea2156c8.png",
    fallbackImage: "/categories/customizable-products.png",
    alt: "Kotson Customizable Products — Custom size, feel, and mattress tailoring",
    motionMultiplier: { x: 0.6, y: 0.5 },
  },
];

/* ── Fan offsets for 3-image compositions ─────────────────────────────── */
const COMPOSITION_OFFSETS = [
  { x: "-32%", y: "8%", rotate: "-8deg", z: 1, scale: 0.80 },
  { x: "0%", y: "-4%", rotate: "0deg", z: 3, scale: 0.94 },
  { x: "32%", y: "8%", rotate: "8deg", z: 2, scale: 0.80 },
] as const;

/* ── Single family zone ───────────────────────────────────────────────── */
function FamilyZone({
  family,
  isActive,
  isAnyActive,
  onHoverStart,
  onHoverEnd,
  pointerOffset,
  prefersReduced,
}: {
  family: ProductFamily;
  isActive: boolean;
  isAnyActive: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  pointerOffset: { x: number; y: number };
  prefersReduced: boolean;
}) {
  const [imgSrc, setImgSrc] = useState(family.image);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisibleMobile, setIsVisibleMobile] = useState(false);

  useEffect(() => {
    setImgSrc(family.image);
  }, [family.image]);

  /* Mobile scroll-in observer */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setIsVisibleMobile(entry.isIntersecting));
      },
      { threshold: 0.3, rootMargin: "-10% 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Pointer depth translation */
  const pointerTransform =
    isActive && !prefersReduced
      ? `translate3d(${pointerOffset.x * family.motionMultiplier.x}px, ${pointerOffset.y * family.motionMultiplier.y
      }px, 0)`
      : "translate3d(0, 0, 0)";

  const hasComposition = (family.images?.length ?? 0) > 1;

  /* Zone opacity — inactive siblings dim */
  const zoneOpacity = prefersReduced ? 1 : isAnyActive && !isActive ? 0.62 : 1;

  /* Image wrapper state classes */
  const imageClass = prefersReduced
    ? "scale-100 opacity-100 translate-y-0"
    : isActive
      ? "scale-[1.10] -translate-y-2 drop-shadow-[0_16px_28px_rgba(0,0,0,0.08)] opacity-100"
      : isAnyActive
        ? "scale-[0.97] opacity-60"
        : isVisibleMobile
          ? "scale-100 opacity-100 translate-y-0"
          : "scale-100 opacity-100 sm:scale-100 sm:opacity-100 max-sm:scale-[0.96] max-sm:opacity-75 max-sm:translate-y-3";

  const isInteractiveLink = Boolean(family.route && family.route !== "#");

  const commonProps = {
    "aria-label": `${family.ctaLabel} — ${family.name}`,
    onFocus: onHoverStart,
    onBlur: onHoverEnd,
    className:
      "group/item relative flex flex-col items-center text-center w-full outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf/50 focus-visible:ring-offset-8 rounded-3xl py-4 sm:py-5 px-2 sm:px-3 select-none cursor-pointer",
    "data-testid": `category-zone-${family.slug}`,
  };

  const cardContent = (
    <>
      {/* ── Product image stage ── */}
      <div className="relative w-full h-[180px] sm:h-[195px] lg:h-[205px] xl:h-[220px] flex items-center justify-center">

        {/* Soft circular backdrop */}
        <div
          className={`absolute inset-0 m-auto w-36 h-36 sm:w-40 sm:h-40 lg:w-42 lg:h-42 xl:w-46 xl:h-46 rounded-full bg-brand-sand/70 pointer-events-none transition-all duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${prefersReduced
              ? ""
              : isActive
                ? "scale-110 opacity-80 bg-brand-leaf/10 ring-1 ring-brand-leaf/20"
                : isAnyActive
                  ? "scale-95 opacity-35"
                  : "scale-100 opacity-50"
            }`}
          aria-hidden="true"
        />

        {/* Image wrapper — pointer parallax */}
        <div
          style={{
            transform: pointerTransform,
            transition: prefersReduced
              ? "none"
              : isActive
                ? "transform 180ms ease-out"
                : "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className={`relative z-10 w-full h-full flex items-center justify-center transition-all duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${imageClass}`}
        >
          {hasComposition && family.images ? (
            /* ── Layered fan composition ── */
            <div
              style={{
                position: "relative",
                width: "90%",
                height: "88%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {family.images.map((url, i) => {
                const o = COMPOSITION_OFFSETS[i] ?? COMPOSITION_OFFSETS[1];
                return (
                  <img
                    key={i}
                    src={url}
                    alt={`${family.name} product ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = family.fallbackImage || "/navbar/mattress.png";
                    }}
                    style={{
                      position: "absolute",
                      width: `${o.scale * 100}%`,
                      height: "auto",
                      objectFit: "contain",
                      zIndex: o.z,
                      transform: `translateX(${o.x}) translateY(${o.y}) rotate(${o.rotate})`,
                      transition: prefersReduced
                        ? "none"
                        : `transform 420ms cubic-bezier(0.22,1,0.36,1) ${i * 40}ms, filter 420ms ease`,
                      filter: isActive
                        ? "drop-shadow(0 12px 22px rgba(0,0,0,0.14))"
                        : "drop-shadow(0 4px 8px rgba(0,0,0,0.08))",
                    }}
                  />
                );
              })}
            </div>
          ) : (
            /* ── Single image ── */
            <img
              src={imgSrc}
              alt={family.alt}
              loading="lazy"
              decoding="async"
              onError={() => {
                if (imgSrc !== family.fallbackImage) setImgSrc(family.fallbackImage);
              }}
              className="max-h-[82%] max-w-[85%] w-auto h-auto object-contain transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
          )}
        </div>
      </div>

      {/* ── Category info ── */}
      <div className="mt-3 sm:mt-3.5 lg:mt-4 flex flex-col items-center w-full">

        {/* Product count / eyebrow — understated & aligned */}
        <p
          className={`font-ui text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.20em] mb-1 transition-colors duration-300 min-h-[16px] flex items-center justify-center ${isActive ? "text-brand-leaf" : "text-brand-charcoal/40"
            }`}
        >
          {family.countLabel}
        </p>

        {/* Category name — exact height containment for horizontal CTA alignment */}
        <h3
          className={`font-ui text-lg sm:text-[19px] xl:text-[21px] font-semibold tracking-tight transition-colors duration-300 min-h-[46px] sm:min-h-[50px] flex items-center justify-center text-center leading-snug px-1 ${isActive ? "text-brand-deep" : "text-brand-charcoal"
            }`}
        >
          {family.name}
        </h3>

        {/* Morphing CTA */}
        <div className="mt-2.5 sm:mt-3 h-[42px] flex items-center justify-center">

          {/* Desktop: morphing pill */}
          <div
            className={`hidden sm:inline-flex items-center justify-center overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] font-ui font-medium ${isActive
                ? "h-[38px] px-4 rounded-full bg-brand-deep text-white shadow-sm gap-2 min-w-[136px]"
                : "h-[36px] w-[36px] rounded-full border border-brand-charcoal/15 bg-white/60 text-brand-charcoal/70 hover:border-brand-deep/30"
              }`}
          >
            {isActive ? (
              <span className="text-[12.5px] font-semibold whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
                {family.ctaLabel}
              </span>
            ) : null}
            <ArrowRight
              className={`shrink-0 transition-transform duration-200 ${isActive ? "h-3.5 w-3.5" : "h-3.5 w-3.5 group-hover/item:translate-x-0.5"
                }`}
              aria-hidden="true"
            />
          </div>

          {/* Mobile: persistent pill */}
          <div className="inline-flex sm:hidden items-center gap-1.5 font-ui text-xs font-semibold text-brand-deep px-3.5 py-1.5 rounded-full bg-brand-deep/8 hover:bg-brand-deep/12 transition-colors">
            <span>{family.ctaLabel}</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={cardRef}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{
        opacity: zoneOpacity,
        transition: prefersReduced ? "none" : "opacity 380ms cubic-bezier(0.22,1,0.36,1)",
      }}
      className="relative flex flex-col items-center text-center w-full focus-within:z-20"
    >
      {isInteractiveLink ? (
        <Link to={family.route} {...commonProps}>
          {cardContent}
        </Link>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            if (family.action) family.action();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (family.action) family.action();
            }
          }}
          {...commonProps}
        >
          {cardContent}
        </div>
      )}
    </div>
  );
}

/* ── Main section ─────────────────────────────────────────────────────── */
function ExploreCategories() {
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [prefersReduced, setPrefersReduced] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointerOffset({
      x: Math.max(-4, Math.min(4, relX * 4)),
      y: Math.max(-3, Math.min(3, relY * 3)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveFamily(null);
    setPointerOffset({ x: 0, y: 0 });
  }, []);

  return (
    <section
      ref={sectionRef}
      id="explore-categories"
      aria-labelledby="explore-categories-heading"
      data-testid="explore-categories-section"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full bg-[#FAF8F5] pt-[72px] sm:pt-[80px] lg:pt-[88px] pb-[80px] sm:pb-[90px] lg:pb-[100px] px-4 sm:px-6 lg:px-8 overflow-hidden select-none"
    >
      {/* Ambient botanical gradients */}
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.035] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.035] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1400px]">

        {/* ── Section heading ── */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 lg:mb-14">
          <p
            id="explore-categories-eyebrow"
            className="font-ui text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.20em] text-brand-deep"
          >
            EXPLORE OUR
          </p>
          <h2
            id="explore-categories-heading"
            className="mt-1.5 font-display text-[42px] sm:text-[50px] lg:text-[58px] font-normal text-brand-charcoal tracking-tight leading-[1.04]"
          >
            Categories
          </h2>
          <p className="mt-2.5 font-ui text-sm sm:text-[15px] lg:text-[16px] text-brand-charcoal/65 leading-relaxed">
            Four families. Eighteen products. All natural latex.
          </p>
        </div>

        {/* ── 5 family zones: 1-col on mobile, 2/3-col on tablet, 5-col on desktop ── */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-8 sm:gap-6 lg:gap-5 xl:gap-4 items-start"
          data-testid="categories-showroom-grid"
        >
          {FAMILIES.map((family) => (
            <FamilyZone
              key={family.id}
              family={family}
              isActive={activeFamily === family.id}
              isAnyActive={activeFamily !== null}
              onHoverStart={() => setActiveFamily(family.id)}
              onHoverEnd={() => setActiveFamily(null)}
              pointerOffset={pointerOffset}
              prefersReduced={prefersReduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(ExploreCategories);
