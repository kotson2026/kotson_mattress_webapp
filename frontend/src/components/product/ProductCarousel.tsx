import { useRef } from "react";
import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProductCarousel({ products, testId }: { products: Product[]; testId: string }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="relative group" data-testid={testId}>
      {/* Desktop Controls (hidden on mobile/tablet natively by hover state, but we'll show on hover) */}
      <div className="absolute top-1/2 -left-4 z-10 -translate-y-1/2 hidden lg:group-hover:block">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background shadow-md border-border text-foreground hover:bg-brand-sand/50 transition-colors"
          onClick={scrollLeft}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="absolute top-1/2 -right-4 z-10 -translate-y-1/2 hidden lg:group-hover:block">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background shadow-md border-border text-foreground hover:bg-brand-sand/50 transition-colors"
          onClick={scrollRight}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-6 pt-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((p) => (
          <div 
            key={p.id} 
            className="shrink-0 snap-start w-[75vw] sm:w-[45vw] md:w-[35vw] lg:w-[23%]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
