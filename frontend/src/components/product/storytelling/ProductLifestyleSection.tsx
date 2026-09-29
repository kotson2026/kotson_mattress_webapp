import React from "react";
import type { ProductLifestyleSection as LifestyleSectionType } from "@/lib/types";
import { StoryIcon } from "./icons";
import { Check, Phone, MessageSquare } from "lucide-react";
import {
  useCustomerSupport,
  getTelUrl,
  getWhatsAppUrl,
  getPdpWhatsAppMessage,
} from "@/lib/support";

interface ProductLifestyleSectionProps {
  lifestyle?: LifestyleSectionType;
  productName: string;
}

export default function ProductLifestyleSection({
  lifestyle,
  productName,
}: ProductLifestyleSectionProps) {
  const support = useCustomerSupport();

  // Graceful collapse if disabled or empty
  if (!lifestyle || lifestyle.enabled === false) {
    return null;
  }

  const hasImage = Boolean(lifestyle.image_url);
  const hasHeading = Boolean(lifestyle.heading?.trim());
  const suitabilityItems = lifestyle.suitability_items || [];
  const bulletFeatures = lifestyle.bullet_features || [];

  if (!hasImage && !hasHeading && suitabilityItems.length === 0) {
    return null;
  }

  const telUrl = getTelUrl(support.canonicalPhone);
  const waMsg = getPdpWhatsAppMessage(productName);
  const waUrl = getWhatsAppUrl(support.cleanWhatsAppNumber, waMsg);

  return (
    <section
      className="my-16 md:my-28 rounded-3xl overflow-hidden border border-border bg-card shadow-sm"
      aria-labelledby="product-lifestyle-heading"
      data-testid="product-lifestyle-section"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Column: Lifestyle Visual (Approx 50% / 6 cols on desktop) */}
        <div className="lg:col-span-6 relative min-h-[340px] sm:min-h-[440px] lg:min-h-full bg-brand-sand/30 overflow-hidden">
          {lifestyle.image_url ? (
            <img
              src={lifestyle.image_url}
              alt={lifestyle.heading || productName}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-12 text-center text-muted-foreground">
              <span className="font-heading text-xl">{productName} Lifestyle</span>
            </div>
          )}
        </div>

        {/* Right Column: Suitability Content (Approx 50% / 6 cols on desktop) */}
        <div className="lg:col-span-6 p-8 sm:p-12 lg:p-16 flex flex-col justify-center bg-card">
          {lifestyle.eyebrow && (
            <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-leaf mb-2 inline-block">
              {lifestyle.eyebrow}
            </span>
          )}

          {lifestyle.heading && (
            <h2
              id="product-lifestyle-heading"
              className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
            >
              {lifestyle.heading}
            </h2>
          )}

          {lifestyle.description && (
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              {lifestyle.description}
            </p>
          )}

          {/* Dynamic Suitability Items Grid */}
          {suitabilityItems.length > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {suitabilityItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-background/80 p-3 sm:p-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {item.icon && <StoryIcon name={item.icon} className="w-3.5 h-3.5 text-brand-leaf" />}
                    <span>{item.label}</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-foreground">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bullet Feature Checkmarks */}
          {bulletFeatures.length > 0 && (
            <div className="mt-8 space-y-2.5">
              {bulletFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-brand-leaf/10 p-1 text-brand-leaf shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-foreground/90 leading-snug">{feat}</span>
                </div>
              ))}
            </div>
          )}

          {/* Assistance CTA Bar */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                Need guidance for your setup?
              </p>
              <p className="text-xs text-muted-foreground">
                Our sleep specialists can assist your choice.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={telUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                data-testid="lifestyle-call-btn"
              >
                <Phone className="w-3.5 h-3.5 text-brand-leaf" />
                Call Us
              </a>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-brand-leaf text-white text-xs font-semibold hover:bg-brand-leaf/90 transition-colors"
                data-testid="lifestyle-whatsapp-btn"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
