import React from "react";
import type { ProductConstructionSection as ConstructionSectionType } from "@/lib/types";
import { StoryIcon } from "./icons";

interface ProductConstructionProps {
  construction?: ConstructionSectionType;
  productName: string;
}

export default function ProductConstruction({
  construction,
  productName,
}: ProductConstructionProps) {
  // Graceful collapse if disabled or empty layers
  if (!construction || construction.enabled === false) {
    return null;
  }

  const layers = construction.layers || [];
  if (layers.length === 0) {
    return null;
  }

  // Sort layers by order
  const sortedLayers = [...layers].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <section
      className="my-16 md:my-28 rounded-3xl bg-brand-sand/15 border border-brand-sand/40 p-8 sm:p-12 lg:p-16"
      aria-labelledby="product-construction-heading"
      data-testid="product-construction-section"
    >
      <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
        <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-leaf mb-2 inline-block">
          {construction.eyebrow || "WHAT'S INSIDE?"}
        </span>
        <h2
          id="product-construction-heading"
          className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
        >
          {construction.heading || "What's Inside"}
        </h2>
        {construction.description && (
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed text-balance">
            {construction.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
        {/* Visual Media Column (5 cols) */}
        {construction.image_url && (
          <div className="lg:col-span-5 flex justify-center order-2 lg:order-1">
            <div className="relative w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden border border-border bg-card shadow-sm p-4 flex items-center justify-center">
              <img
                src={construction.image_url}
                alt={`${productName} construction`}
                loading="lazy"
                className="w-full h-full object-contain rounded-2xl transition-transform duration-500 hover:scale-105"
              />
            </div>
          </div>
        )}

        {/* Layers List Column (7 cols if image exists, 12 cols if no image) */}
        <div className={`${construction.image_url ? "lg:col-span-7" : "lg:col-span-12"} space-y-4 order-1 lg:order-2`}>
          {sortedLayers.map((layer, idx) => {
            const formattedIndex = String(layer.order || idx + 1).padStart(2, "0");
            return (
              <div
                key={idx}
                className="flex items-start gap-5 p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-brand-leaf/40 transition-all group"
              >
                <div className="font-heading text-2xl sm:text-3xl font-bold text-brand-leaf/70 group-hover:text-brand-leaf shrink-0 w-10">
                  {formattedIndex}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {layer.icon && <StoryIcon name={layer.icon} className="w-4 h-4 text-brand-leaf" />}
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      {layer.name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {layer.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
