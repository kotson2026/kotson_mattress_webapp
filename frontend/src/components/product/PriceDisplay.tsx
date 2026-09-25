import React, { memo } from "react";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PriceDisplayProps {
  salePrice: number | null | undefined; // paise
  mrp?: number | null | undefined; // paise
  discountPercent?: number | null | undefined; // e.g. 40
  isFrom?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  testId?: string;
  align?: "left" | "center" | "right";
}

/**
 * Standardized Kotson price display component.
 * Hierarchy: SALE PRICE (bold, high emphasis) -> ORIGINAL MRP (smaller, strikethrough) -> (40% OFF) badge
 */
export const PriceDisplay = memo(function PriceDisplay({
  salePrice,
  mrp,
  discountPercent = 40,
  isFrom = false,
  size = "md",
  className,
  testId,
  align = "left",
}: PriceDisplayProps) {
  if (salePrice === null || salePrice === undefined) {
    return <span className="font-heading font-medium text-muted-foreground">—</span>;
  }

  // Authoritative discount calculation if not explicitly provided
  const hasDiscount = Boolean(mrp && mrp > salePrice);
  const calculatedPercent =
    discountPercent && discountPercent > 0
      ? Math.round(discountPercent)
      : hasDiscount && mrp
      ? Math.round(((mrp - salePrice) / mrp) * 100)
      : 40;

  const sizeClasses = {
    sm: {
      from: "text-[11px] font-normal text-muted-foreground mr-1",
      sale: "text-sm sm:text-base font-bold text-foreground tracking-tight",
      mrp: "text-xs text-muted-foreground/75 line-through decoration-muted-foreground/50",
      badge: "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
      gap: "gap-1.5 sm:gap-2",
    },
    md: {
      from: "text-xs sm:text-sm font-normal text-muted-foreground mr-1",
      sale: "text-lg sm:text-xl font-bold text-foreground tracking-tight",
      mrp: "text-sm text-muted-foreground/75 line-through decoration-muted-foreground/50",
      badge: "text-[11px] font-semibold px-2 py-0.5 rounded-full",
      gap: "gap-2 sm:gap-2.5",
    },
    lg: {
      from: "text-sm sm:text-base font-normal text-muted-foreground mr-1.5",
      sale: "text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight",
      mrp: "text-base sm:text-lg text-muted-foreground/75 line-through decoration-muted-foreground/50",
      badge: "text-xs font-semibold px-2.5 py-0.5 rounded-full",
      gap: "gap-2.5 sm:gap-3",
    },
    xl: {
      from: "text-base sm:text-lg font-normal text-muted-foreground mr-1.5",
      sale: "text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight",
      mrp: "text-lg sm:text-xl text-muted-foreground/75 line-through decoration-muted-foreground/50",
      badge: "text-xs sm:text-sm font-semibold px-3 py-1 rounded-full",
      gap: "gap-3 sm:gap-3.5",
    },
  }[size];

  const alignClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[align];

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-baseline transition-opacity duration-200 ease-out",
        sizeClasses.gap,
        alignClass,
        className
      )}
      data-testid={testId}
    >
      {/* 1. SALE PRICE (Primary emphasis) */}
      <span className={cn("inline-flex items-baseline", sizeClasses.sale)}>
        {isFrom && <span className={sizeClasses.from}>From</span>}
        <span>{inr(salePrice)}</span>
      </span>

      {/* 2. ORIGINAL MRP (Strikethrough, lighter/smaller) */}
      {hasDiscount && mrp && (
        <span className={sizeClasses.mrp} aria-label={`Original MRP ${inr(mrp)}`}>
          {inr(mrp)}
        </span>
      )}

      {/* 3. DISCOUNT BADGE (Compact, warm premium accent) */}
      {hasDiscount && calculatedPercent > 0 && (
        <span
          className={cn(
            "inline-flex items-center select-none tracking-tight",
            "bg-[#F7F2EA] text-[#2F5233] border border-[#2F5233]/20 shadow-xs",
            "hover:border-[#2F5233]/40 transition-colors duration-200",
            sizeClasses.badge
          )}
          aria-label={`${calculatedPercent}% off`}
        >
          ({calculatedPercent}% OFF)
        </span>
      )}
    </div>
  );
});

export default PriceDisplay;
