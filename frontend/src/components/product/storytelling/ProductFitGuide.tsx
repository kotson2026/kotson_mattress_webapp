import React from "react";
import { Link } from "react-router-dom";
import type { ProductFitGuideSection as FitGuideSectionType } from "@/lib/types";
import { Phone, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  useCustomerSupport,
  getTelUrl,
  getWhatsAppUrl,
  getPdpWhatsAppMessage,
} from "@/lib/support";

interface ProductFitGuideProps {
  fitGuide?: FitGuideSectionType;
  currentSlug: string;
  productName: string;
}

export default function ProductFitGuide({
  fitGuide,
  currentSlug,
  productName,
}: ProductFitGuideProps) {
  const support = useCustomerSupport();

  // Graceful collapse if disabled or empty
  if (!fitGuide || fitGuide.enabled === false) {
    return null;
  }

  const items = fitGuide.items || [];
  if (items.length === 0) {
    return null;
  }

  const telUrl = getTelUrl(support.canonicalPhone);
  const waMsg = getPdpWhatsAppMessage(productName);
  const waUrl = getWhatsAppUrl(support.cleanWhatsAppNumber, waMsg);

  return (
    <section
      className="my-16 md:my-28 rounded-3xl border border-border bg-card p-8 sm:p-12 lg:p-16 shadow-xs"
      aria-labelledby="product-fit-guide-heading"
      data-testid="product-fit-guide-section"
    >
      <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
        <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-leaf mb-2 inline-block">
          {fitGuide.eyebrow || "FIND THE RIGHT FIT"}
        </span>
        <h2
          id="product-fit-guide-heading"
          className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
        >
          {fitGuide.heading || "Find the Right Fit"}
        </h2>
        {fitGuide.description && (
          <p className="mt-3 text-base text-muted-foreground leading-relaxed text-balance">
            {fitGuide.description}
          </p>
        )}
      </div>

      <div className={`grid grid-cols-1 ${items.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6 max-w-4xl mx-auto`}>
        {items.map((item, idx) => {
          const isCurrent = item.link_slug === currentSlug;
          return (
            <div
              key={idx}
              className={`flex flex-col justify-between p-6 sm:p-8 rounded-2xl border transition-all ${
                isCurrent
                  ? "border-brand-leaf bg-brand-sand/20 shadow-sm ring-1 ring-brand-leaf/30"
                  : "border-border bg-background hover:border-brand-leaf/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {item.name}
                  </h3>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-leaf bg-brand-leaf/10 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Current
                    </span>
                  )}
                </div>

                {item.subtitle && (
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-leaf mb-2">
                    {item.subtitle}
                  </div>
                )}

                {item.dimensions && (
                  <div className="text-base font-bold text-foreground mb-2">
                    {item.dimensions}
                  </div>
                )}

                {item.specs && (
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                    {item.specs}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border/60">
                {isCurrent ? (
                  <span className="text-xs font-semibold text-brand-leaf flex items-center gap-1">
                    Viewing this model
                  </span>
                ) : item.link_slug ? (
                  <Link
                    to={`/products/${item.link_slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-deep hover:text-brand-leaf transition-colors"
                  >
                    View this model <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Need Help Choosing Footer */}
      <div className="mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">
          Need personal advice on the best size?
        </span>
        <div className="flex items-center gap-2">
          <a
            href={telUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Phone className="w-3 h-3 text-brand-leaf" />
            Call Us
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-leaf text-white text-xs font-semibold hover:bg-brand-leaf/90 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp Us
          </a>
        </div>
      </div>
    </section>
  );
}
