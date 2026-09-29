import React from "react";
import type { ProductStorySection } from "@/lib/types";
import { StoryIcon } from "./icons";

interface ProductStoryIntroProps {
  story?: ProductStorySection;
  productName: string;
}

export default function ProductStoryIntro({ story, productName }: ProductStoryIntroProps) {
  // Graceful collapse if disabled or no content
  if (!story || story.enabled === false) {
    return null;
  }

  const hasHeading = Boolean(story.heading?.trim());
  const hasDesc = Boolean(story.description?.trim());
  const features = story.features || [];

  if (!hasHeading && !hasDesc && features.length === 0) {
    return null;
  }

  return (
    <section
      className="my-16 md:my-24 rounded-3xl bg-brand-sand/20 border border-brand-sand/50 p-8 sm:p-12 lg:p-16 transition-all"
      aria-labelledby="product-story-heading"
      data-testid="product-story-intro"
    >
      <div className="max-w-3xl mx-auto text-center">
        {story.eyebrow && (
          <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-leaf mb-3 inline-block">
            {story.eyebrow}
          </span>
        )}
        {story.heading && (
          <h2
            id="product-story-heading"
            className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance"
          >
            {story.heading}
          </h2>
        )}
        {story.description && (
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed text-balance">
            {story.description}
          </p>
        )}
      </div>

      {features.length > 0 && (
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-brand-leaf/40 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-brand-sand/50 flex items-center justify-center mb-4 text-brand-leaf">
                <StoryIcon name={feat.icon} className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">
                {feat.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
