import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronRight, Ruler, Sparkles, Shield } from "lucide-react";
import { apiGet } from "@/lib/api";
import { inr } from "@/lib/format";
import type { Product, Category } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import PriceDisplay from "@/components/product/PriceDisplay";
import { Badge } from "@/components/ui/badge";
import { ProductFamilyCard } from "@/components/product/ProductFamilyCard";

/* ── 4 Product Families ─────────────────────────────────────────────── */
interface FamilyCardItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  image: string;
  alt: string;
}

const FAMILIES: FamilyCardItem[] = [
  {
    id: "mattresses",
    slug: "mattresses",
    name: "Mattresses",
    tagline: "Custom length, breadth & anatomical thickness",
    image: "/navbar/mattress.png",
    alt: "Kotson Customizable Organic Latex Mattresses",
  },
  {
    id: "pillows",
    slug: "pillows",
    name: "Pillows",
    tagline: "Tailored profile & organic botanical comfort",
    image: "/navbar/pillows.png",
    alt: "Kotson Customizable Pillows",
  },
  {
    id: "toppers",
    slug: "toppers",
    name: "Toppers",
    tagline: "Made-to-size natural latex mattress toppers",
    image: "/navbar/toppers.png",
    alt: "Kotson Customizable Mattress Toppers",
  },
  {
    id: "baby-kids",
    slug: "baby-kids",
    name: "Baby + Kids",
    tagline: "Hypoallergenic crib & junior custom sizing",
    image: "/navbar/baby-kids.png",
    alt: "Kotson Customizable Baby & Kids Bedding",
  },
];

const getSingularName = (slug: string) => {
  switch (slug) {
    case "mattresses":
      return "mattress";
    case "pillows":
      return "pillow";
    case "toppers":
      return "topper";
    case "baby-kids":
      return "baby or junior bedding item";
    default:
      return "product";
  }
};

export default function CustomizableProductsLanding() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const collectionSectionRef = useRef<HTMLElement>(null);

  // Active family tab (defaults to url param or "mattresses")
  const activeFamilySlug = urlCategory || "mattresses";
  const activeFamily = FAMILIES.find((f) => f.slug === activeFamilySlug) || FAMILIES[0];

  // Fetch customizable products for current category
  const { data: customizableProducts, isLoading } = useQuery<Product[]>({
    queryKey: ["customizable-products", activeFamilySlug],
    queryFn: () => apiGet<Product[]>(`/catalog/customizable-products?category=${activeFamilySlug}`),
  });

  const scrollToCollection = (behavior: ScrollBehavior = "smooth") => {
    if (collectionSectionRef.current) {
      const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const headerOffset = 90; // account for sticky storefront header
      const elementPosition = collectionSectionRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: isReduced ? "auto" : behavior,
      });
    }
  };

  const handleSelectFamily = (slug: string) => {
    navigate(`/customizable-products/${slug}`);
    // Only scroll on explicit user selection click
    requestAnimationFrame(() => {
      scrollToCollection("smooth");
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D]">
      <StorefrontHeader />

      {/* ── Breadcrumb Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#5C6656]">
          <Link to="/" className="hover:text-[#467065] transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#5C6656]/50" />
          <Link to="/customizable-products" className="hover:text-[#467065] transition-colors">
            Customizable Products
          </Link>
          {urlCategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#5C6656]/50" />
              <span className="font-semibold text-[#2D2D2D]">{activeFamily.name}</span>
            </>
          )}
        </nav>
      </div>

      {/* ── Editorial Hero Section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="rounded-3xl bg-white border border-[#2D2D2D]/10 p-6 sm:p-10 lg:p-12 shadow-[0_4px_24px_rgba(45,45,45,0.04)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Copy Concept */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6">
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#2D2D2D] leading-[1.15]">
                CUSTOMIZABLE
                <br />
                <span className="italic text-[#467065]">PRODUCTS</span>
              </h1>

              <div className="space-y-2">
                <p className="font-ui text-base sm:text-lg font-semibold text-[#2D2D2D]">
                  Your sleep. Your size. Your comfort.
                </p>
                <p className="font-ui text-sm sm:text-base text-[#5C6656] max-w-xl leading-relaxed">
                  Choose a product and customize the measurements according to your requirement.
                  Tapped from certified botanical latex and hand-tailored to your exact bed frame dimensions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs sm:text-sm text-[#5C6656]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#467065]" />
                  <span>Precision measurements (in)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#467065]" />
                  <span>Configurable cover & feel</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#467065]" />
                  <span>100% GOLS Organic Latex</span>
                </div>
              </div>
            </div>

            {/* Right: Premium Made-to-Size Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md sm:max-w-lg aspect-[4/3] rounded-2xl overflow-hidden bg-[#FAF8F5] border border-[#2D2D2D]/10 flex items-center justify-center p-4 group">
                <img
                  src="/categories/customizable-products.png"
                  alt="Kotson Customizable Products — Custom size, feel, and mattress tailoring"
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  loading="eager"
                  onError={(e) => {
                    // Fallback to CDN hosted image if local file fails
                    (e.target as HTMLImageElement).src =
                      "/categories/customizable-products.png";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Family Selection (4 Cards) ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider font-bold text-[#5C6656]">Step 1 of Selection</p>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#2D2D2D]">Choose Product Family</h2>
        </div>

        {/* Desktop: 4 cards in one balanced row; Mobile: stacked compact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FAMILIES.map((family) => {
            const isSelected = Boolean(urlCategory && family.slug === urlCategory);
            return (
              <ProductFamilyCard
                key={family.id}
                family={family}
                isSelected={isSelected}
                onClick={() => handleSelectFamily(family.slug)}
              />
            );
          })}
        </div>
      </section>

      {/* ── Customizable Product List ── */}
      <section
        id="customized-collection"
        ref={collectionSectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 pb-4 border-b border-[#2D2D2D]/10">
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-[#467065]">
              {activeFamily.name} Collection
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D]">
              Customized {activeFamily.name}
            </h2>
            <p className="font-ui text-sm text-[#5C6656] mt-1">
              Select a {getSingularName(activeFamily.slug)} and customize the measurements
              according to your requirement.
            </p>
          </div>

          <div className="text-xs font-medium text-[#5C6656] bg-white px-3 py-1.5 rounded-full border border-[#2D2D2D]/10 self-start sm:self-auto">
            {customizableProducts?.length || 0} product(s) available for custom sizing
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-2xl bg-white border border-[#2D2D2D]/10 animate-pulse p-6" />
            ))}
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && customizableProducts && customizableProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {customizableProducts.map((product) => {
              const primaryImg =
                product.primary_image ||
                (product.images && product.images[0]) ||
                "/navbar/mattress.png";

              // Canonical name display
              const isOrthoMax = product.slug.includes("ortho-core-max");
              const displayName = isOrthoMax
                ? "Ortho Core Max Mattress"
                : product.name;

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-3xl border border-[#2D2D2D]/10 overflow-hidden shadow-[0_2px_12px_rgba(45,45,45,0.03)] hover:shadow-[0_8px_30px_rgba(70,112,101,0.1)] hover:border-[#467065]/40 transition-all duration-300 flex flex-col"
                  data-testid={`customizable-card-${product.slug}`}
                >
                  {/* Product Visual */}
                  <div className="relative aspect-[4/3] bg-[#FAF8F5] p-6 flex items-center justify-center overflow-hidden border-b border-[#2D2D2D]/10">
                    <img
                      src={primaryImg}
                      alt={displayName}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#467065] text-white shadow-sm">
                        <Ruler className="w-3 h-3" />
                        Custom Sizing Available
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-ui text-lg sm:text-xl font-bold text-[#2D2D2D] group-hover:text-[#467065] transition-colors">
                        {displayName}
                      </h3>

                      <p className="text-xs text-[#5C6656] mt-1.5 line-clamp-2 leading-relaxed">
                        {product.short_description ||
                          product.tagline ||
                          "GOLS-certified organic natural latex tailored to your exact custom specifications."}
                      </p>

                      {/* Key Custom Features */}
                      <div className="mt-3 pt-3 border-t border-[#2D2D2D]/5 flex flex-wrap gap-1.5 text-[11px] text-[#5C6656]">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#2D2D2D]/10">
                          Length: 60″–84″
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#2D2D2D]/10">
                          Breadth: 30″–78″
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#2D2D2D]/10">
                          Thickness: 4″–12″
                        </span>
                      </div>
                    </div>

                    {/* Price and CTA */}
                    <div className="pt-4 border-t border-[#2D2D2D]/10 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#5C6656] block">
                          Base Variant From
                        </span>
                        <PriceDisplay
                          salePrice={product.price_from}
                          mrp={product.mrp_from}
                          discountPercent={product.discount_percent}
                          size="md"
                        />
                      </div>

                      <Link
                        to={`/customizable-products/customize/${product.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#467065] text-white text-xs sm:text-sm font-bold tracking-wide hover:bg-[#395c53] shadow-sm hover:shadow transition-all duration-200"
                        data-testid={`btn-customize-${product.slug}`}
                      >
                        <span>CUSTOMIZE &amp; SHOP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state fallback */}
        {!isLoading && (!customizableProducts || customizableProducts.length === 0) && (
          <div className="text-center py-16 px-4 rounded-3xl bg-white border border-[#2D2D2D]/10">
            <Ruler className="w-10 h-10 text-[#467065] mx-auto mb-3 opacity-60" />
            <h3 className="font-serif text-lg font-bold text-[#2D2D2D]">No customizable products listed</h3>
            <p className="text-xs text-[#5C6656] mt-1 max-w-sm mx-auto">
              Please check back shortly or explore our mattresses family for tailored made-to-order sizing.
            </p>
            <button
              onClick={() => handleSelectFamily("mattresses")}
              className="mt-4 px-4 py-2 rounded-xl bg-[#467065] text-white text-xs font-semibold"
            >
              Browse Mattresses
            </button>
          </div>
        )}
      </section>

      {/* ── Botanical Guarantee & Reassurance ── */}
      <section className="bg-white border-t border-[#2D2D2D]/10 py-10 sm:py-12 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5]">
              <Ruler className="w-6 h-6 text-[#467065] mx-auto" />
              <h4 className="font-bold text-sm text-[#2D2D2D]">Guaranteed Fit Guarantee</h4>
              <p className="text-xs text-[#5C6656]">
                Each bespoke unit is precision cut to the exact 0.5-inch tolerance of your specifications.
              </p>
            </div>
            <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5]">
              <Sparkles className="w-6 h-6 text-[#467065] mx-auto" />
              <h4 className="font-bold text-sm text-[#2D2D2D]">Zero Compromise Comfort</h4>
              <p className="text-xs text-[#5C6656]">
                Even in custom measurements, your 7-zone anatomical latex density is balanced proportionally.
              </p>
            </div>
            <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5]">
              <Shield className="w-6 h-6 text-[#467065] mx-auto" />
              <h4 className="font-bold text-sm text-[#2D2D2D]">Authoritative Craftsmanship</h4>
              <p className="text-xs text-[#5C6656]">
                Made from organic natural tree sap in India, free of synthetic chemical foaming agents.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
