import React from "react";
import { ArrowRight } from "lucide-react";

export interface ProductFamilyCardItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  image: string;
  alt: string;
}

export interface ProductFamilyCardProps {
  family: ProductFamilyCardItem;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * ProductFamilyCard
 * 
 * Reusable card for Kotson Customizable Product Families.
 * Implements refined editorial hover/focus interactions:
 * - 240ms translateY(-4px) + scale(1.01) + Kotson green border + subtle green tint
 * - Soft elevated shadow
 * - Product image micro-scaling (scale 1.06, translateY -2px)
 * - Title transitions to Kotson deep green without layout shift
 * - "View customizable ->" arrow slides +4px to the right
 * - Distinct active/selected state vs temporary hover
 * - Full card clickability
 * - Full :focus-visible keyboard accessibility
 * - Mobile-friendly active:scale-[0.99] touch feedback (no sticky hover)
 * - prefers-reduced-motion safe
 */
export const ProductFamilyCard: React.FC<ProductFamilyCardProps> = ({
  family,
  isSelected,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`group relative flex items-center p-3.5 sm:p-5 rounded-2xl border text-left outline-none cursor-pointer w-full
        transition-all duration-[250ms] ease-out
        motion-reduce:transform-none motion-reduce:transition-none
        focus-visible:ring-2 focus-visible:ring-[#467065] focus-visible:ring-offset-2 focus-visible:outline-none
        active:scale-[0.99] active:translate-y-0
        ${
          isSelected
            ? "bg-[#467065]/5 border-[#467065] shadow-sm ring-1 ring-[#467065]/30 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_8px_20px_rgba(70,112,101,0.08)]"
            : "bg-white border-[#2D2D2D]/10 hover:border-[#7C9C59]/60 hover:bg-[#F9FAF7] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_8px_20px_rgba(70,112,101,0.08)]"
        }
      `}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#FAF8F5] border border-[#2D2D2D]/10 flex items-center justify-center p-1 shrink-0 overflow-hidden">
        <img
          src={family.image}
          alt={family.alt}
          className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.06] group-hover:-translate-y-[2px] motion-reduce:group-hover:scale-100 motion-reduce:group-hover:translate-y-0"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.endsWith(`/navbar/${family.id}.png`)) {
              target.src = `/navbar/${family.id}.png`;
            }
          }}
        />
      </div>

      {/* Details */}
      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-ui text-sm sm:text-base font-bold text-[#2D2D2D] group-hover:text-[#467065] transition-colors duration-200 truncate">
            {family.name}
          </span>
          {isSelected && (
            <span
              className="w-2 h-2 rounded-full bg-[#467065] shrink-0"
              aria-label="Active selection"
            />
          )}
        </div>
        <p className="text-[11px] text-[#5C6656] line-clamp-1 mt-0.5">
          {family.tagline}
        </p>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold mt-1.5 transition-colors duration-200 ${
            isSelected ? "text-[#467065]" : "text-[#5C6656] group-hover:text-[#467065]"
          }`}
        >
          <span>View customizable</span>
          <ArrowRight className="w-3 h-3 transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" />
        </span>
      </div>
    </button>
  );
};

export default ProductFamilyCard;
