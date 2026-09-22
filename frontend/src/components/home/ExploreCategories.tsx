import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface CategoryShowroomItem {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  route: string;
  image: string;
  fallbackImage: string;
  alt: string;
  motionMultiplier: { x: number; y: number };
}

const SHOWROOM_CATEGORIES: CategoryShowroomItem[] = [
  {
    id: "mattresses",
    slug: "mattresses",
    name: "Mattresses",
    subtitle: "Support for a better you",
    route: "/collections/mattresses",
    image: "/navbar/mattress.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
    alt: "Kotson 7-Zone Organic Latex Mattress",
    motionMultiplier: { x: 0.5, y: 0.4 }, // Heavier / stable response
  },
  {
    id: "pillows",
    slug: "pillows",
    name: "Pillows",
    subtitle: "Comfort in every sleep",
    route: "/collections/pillows",
    image: "/navbar/pillows.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
    alt: "Kotson Ergonomic Cervical Latex Pillow",
    motionMultiplier: { x: 0.9, y: 0.8 }, // Softer lift
  },
  {
    id: "toppers",
    slug: "toppers",
    name: "Toppers",
    subtitle: "An extra layer of comfort",
    route: "/collections/toppers",
    image: "/navbar/toppers.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
    alt: "Kotson Breathable Organic Latex Mattress Topper",
    motionMultiplier: { x: 0.7, y: 1.0 }, // Small upward float
  },
  {
    id: "baby-kids",
    slug: "baby-kids",
    name: "Baby + Kids",
    subtitle: "Gentle care for growing dreams",
    route: "/collections/baby-kids",
    image: "/navbar/baby-kids.png",
    fallbackImage: "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
    alt: "Kotson Pediatric Certified Baby and Kids Mattress",
    motionMultiplier: { x: 0.4, y: 0.4 }, // Gentle minimal response
  },
];

function CategoryZone({
  category,
  isActive,
  isAnyActive,
  onHoverStart,
  onHoverEnd,
  pointerOffset,
  prefersReduced,
}: {
  category: CategoryShowroomItem;
  isActive: boolean;
  isAnyActive: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  pointerOffset: { x: number; y: number };
  prefersReduced: boolean;
}) {
  const [imgSrc, setImgSrc] = useState(category.image);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisibleMobile, setIsVisibleMobile] = useState(false);

  // Mobile scroll-in observer
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisibleMobile(true);
          } else {
            setIsVisibleMobile(false);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: "-10% 0px -10% 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate subtle pointer depth translation (max ±4px x, ±3px y)
  const pointerTransform =
    isActive && !prefersReduced
      ? `translate3d(${pointerOffset.x * category.motionMultiplier.x}px, ${
          pointerOffset.y * category.motionMultiplier.y
        }px, 0)`
      : "translate3d(0, 0, 0)";

  return (
    <div
      ref={cardRef}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className="relative flex flex-col items-center text-center w-full focus-within:z-20 transition-all"
    >
      <Link
        to={category.route}
        aria-label={`Explore ${category.name}: ${category.subtitle}`}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        className="group/item relative flex flex-col items-center text-center w-full outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf/50 focus-visible:ring-offset-8 rounded-3xl py-4 sm:py-6 px-2 sm:px-4 select-none cursor-pointer"
        data-testid={`category-zone-${category.slug}`}
      >
        {/* PRODUCT STAGE: Height 250-290px desktop with subtle organic backdrop */}
        <div className="relative w-full h-[220px] sm:h-[240px] lg:h-[270px] flex items-center justify-center">
          {/* Subtle organic arched/circular backdrop behind product */}
          <div
            className={`absolute inset-0 m-auto w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 rounded-full bg-brand-sand/70 pointer-events-none transition-all duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              prefersReduced
                ? ""
                : isActive
                ? "scale-110 opacity-80 bg-brand-leaf/10 ring-1 ring-brand-leaf/20"
                : isAnyActive
                ? "scale-95 opacity-35"
                : "scale-100 opacity-50"
            }`}
            aria-hidden="true"
          />

          {/* Physical Product Image */}
          <div
            style={{
              transform: pointerTransform,
              transition: prefersReduced
                ? "none"
                : isActive
                ? "transform 180ms ease-out"
                : "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className={`relative z-10 w-full h-full flex items-center justify-center transition-all duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
              prefersReduced
                ? ""
                : isActive
                ? "scale-[1.10] -translate-y-2.5 drop-shadow-[0_16px_28px_rgba(0,0,0,0.08)] opacity-100"
                : isAnyActive
                ? "scale-[0.97] opacity-60"
                : isVisibleMobile
                ? "scale-100 opacity-100 translate-y-0"
                : "scale-100 opacity-100 sm:scale-100 sm:opacity-100 max-sm:scale-[0.96] max-sm:opacity-75 max-sm:translate-y-3"
            }`}
          >
            <img
              src={imgSrc}
              alt={category.alt}
              loading="lazy"
              onError={() => {
                if (imgSrc !== category.fallbackImage) {
                  setImgSrc(category.fallbackImage);
                }
              }}
              className="max-h-[85%] max-w-[88%] w-auto h-auto object-contain transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
          </div>
        </div>

        {/* CATEGORY INFORMATION */}
        <div className="mt-4 sm:mt-5 flex flex-col items-center">
          {/* Category Name — Manrope SemiBold */}
          <h3
            className={`font-ui text-xl sm:text-2xl lg:text-[24px] font-semibold tracking-tight transition-colors duration-300 ${
              isActive ? "text-brand-deep" : "text-brand-charcoal"
            }`}
          >
            {category.name}
          </h3>

          {/* Subtitle — Manrope Regular */}
          <p className="mt-1 sm:mt-1.5 font-ui text-xs sm:text-[13.5px] lg:text-[14px] text-brand-charcoal/65 max-w-[210px] leading-relaxed">
            {category.subtitle}
          </p>

          {/* MORPHING CTA */}
          <div className="mt-4 sm:mt-5 h-[42px] flex items-center justify-center">
            {/* Desktop / Tablet Morphing Pill — Manrope Medium/SemiBold */}
            <div
              className={`hidden sm:inline-flex items-center justify-center overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] font-ui font-medium ${
                isActive
                  ? "h-[40px] px-4 rounded-full bg-brand-deep text-white shadow-sm gap-2"
                  : "h-[36px] w-[36px] rounded-full border border-brand-charcoal/15 bg-white/60 text-brand-charcoal/70 hover:border-brand-deep/30"
              }`}
            >
              {isActive ? (
                <span className="text-[13px] font-semibold whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
                  Explore {category.name}
                </span>
              ) : null}
              <ArrowRight
                className={`transition-transform duration-200 shrink-0 ${
                  isActive ? "h-3.5 w-3.5" : "h-3.5 w-3.5 group-hover/item:translate-x-0.5"
                }`}
                aria-hidden="true"
              />
            </div>

            {/* Mobile Persistent Direct Explore Pill — Manrope SemiBold */}
            <div className="inline-flex sm:hidden items-center gap-1.5 font-ui text-xs font-semibold text-brand-deep px-3.5 py-1.5 rounded-full bg-brand-deep/8 hover:bg-brand-deep/12 transition-colors">
              <span>Explore {category.name}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function ExploreCategories() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [prefersReduced, setPrefersReduced] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Subtle pointer depth tracking relative to active category zone
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    // Normalize -1 to 1 based on center of section
    const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    // Maximum movement: x: ±4px, y: ±3px
    setPointerOffset({
      x: Math.max(-4, Math.min(4, relX * 4)),
      y: Math.max(-3, Math.min(3, relY * 3)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveCategory(null);
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
      {/* Subtle organic botanical ambient gradients at far left and right edges */}
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.035] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.035] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1360px]">
        {/* COMPACT EDITORIAL HEADING AREA */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 lg:mb-14">
          <p
            id="explore-categories-eyebrow"
            className="font-ui text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brand-deep"
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
            Thoughtfully designed for every stage of life.
          </p>
        </div>

        {/* CONTINUOUS SHOWROOM PRODUCT ENVIRONMENT (NO CARDS / NO BOXED TILES) */}
        {/* Desktop: 4 equal zones | Tablet: 2x2 grid | Mobile: vertical journey */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-8 lg:gap-6 items-start"
          data-testid="categories-showroom-grid"
        >
          {SHOWROOM_CATEGORIES.map((cat) => (
            <CategoryZone
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.id}
              isAnyActive={activeCategory !== null}
              onHoverStart={() => setActiveCategory(cat.id)}
              onHoverEnd={() => setActiveCategory(null)}
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
