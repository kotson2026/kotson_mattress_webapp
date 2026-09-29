import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface AccordionItemProps {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({ id, title, isOpen, onToggle, children }: AccordionItemProps) {
  return (
    <div className="border-b border-border/80 last:border-b-0">
      <button
        id={`accordion-btn-${id}`}
        aria-controls={`accordion-panel-${id}`}
        aria-expanded={isOpen}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-brand-deep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-leaf/40 rounded-lg group"
      >
        <span className="font-heading text-lg sm:text-xl font-bold text-foreground group-hover:text-brand-deep">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out shrink-0 ml-4",
            isOpen && "rotate-180 text-brand-leaf"
          )}
        />
      </button>
      <div
        id={`accordion-panel-${id}`}
        role="region"
        aria-labelledby={`accordion-btn-${id}`}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100 pb-6" : "grid-rows-[0fr] opacity-0 pb-0"
        )}
      >
        <div className="overflow-hidden text-sm sm:text-base text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ProductInformationAccordionProps {
  product: Product;
}

export default function ProductInformationAccordion({
  product,
}: ProductInformationAccordionProps) {
  // Support independent multi-accordion toggles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    specs: true, // First open by default
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isPillowOrBaby =
    product.category_slug === "pillows" || product.category_slug === "baby-kids";
  const defaultUnit = isPillowOrBaby ? "cm" : "inches";

  // Build accordion panels array
  const items = [];

  // 1. Specifications & Measurements Table
  if (product.specifications && Object.keys(product.specifications).length > 0) {
    items.push({
      id: "specs",
      title: "Specifications & Measurements",
      content: (
        <div className="overflow-hidden rounded-xl border border-border bg-card mt-2">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/60">
              {Object.entries(product.specifications).map(([key, value], idx) => {
                const needsUnit = ["length", "width", "height", "thickness", "breadth"].includes(
                  key.toLowerCase()
                );
                const displayVal =
                  needsUnit && !value.toLowerCase().includes("cm") && !value.toLowerCase().includes("inch")
                    ? `${value} ${defaultUnit}`
                    : value;

                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-card" : "bg-brand-sand/10"}>
                    <td className="px-4 py-3 font-semibold text-foreground w-1/3">{key}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{displayVal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  // 2. Product Details & Material Story
  items.push({
    id: "details",
    title: "Product Details & Materials",
    content: (
      <div className="space-y-3">
        <p>
          {product.description ||
            product.tagline ||
            "Crafted with 100% botanical natural Dunlop latex, sustainably sourced and manufactured without petrochemical polyurethane foams or toxic adhesives."}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="px-3 py-1 rounded-full bg-brand-sand/40 border border-brand-sand text-xs font-semibold text-foreground">
            Material: 100% Botanical Dunlop Latex
          </span>
          <span className="px-3 py-1 rounded-full bg-brand-sand/40 border border-brand-sand text-xs font-semibold text-foreground">
            Zero Polyurethane Foam
          </span>
          <span className="px-3 py-1 rounded-full bg-brand-sand/40 border border-brand-sand text-xs font-semibold text-foreground">
            Hypoallergenic & Dust-Mite Resistant
          </span>
        </div>
      </div>
    ),
  });

  // 3. Care Instructions
  if (product.care_instructions) {
    items.push({
      id: "care",
      title: "Care & Maintenance",
      content: (
        <p className="whitespace-pre-line leading-relaxed">
          {product.care_instructions}
        </p>
      ),
    });
  } else {
    items.push({
      id: "care",
      title: "Care & Maintenance",
      content: (
        <ul className="list-disc list-inside space-y-2 marker:text-brand-leaf">
          <li>Unzip the outer bamboo cover and machine wash on gentle cycle with mild detergent.</li>
          <li>Do not wash, soak, or wring the latex core directly; spot clean with a damp cloth if necessary.</li>
          <li>Avoid exposing the latex core to direct sunlight or high heat sources.</li>
          <li>Allow to air dry naturally in a shaded, well-ventilated room.</li>
        </ul>
      ),
    });
  }

  // 4. Shipping & Delivery
  items.push({
    id: "shipping",
    title: "Shipping & Delivery",
    content: (
      <div className="space-y-2">
        <p>
          We offer <strong>Free Standard Shipping</strong> across India on all prepaid orders.
        </p>
        <p>
          Pillows and accessories typically dispatch within 24–48 hours and arrive in 3–5 business days depending on destination pincode.
        </p>
        <p>
          Every order includes verified tracking updates dispatched directly via SMS and WhatsApp.
        </p>
      </div>
    ),
  });

  // 5. Trial, Returns & Warranty
  items.push({
    id: "trial-warranty",
    title: "Trial, Returns & Warranty",
    content: (
      <div className="space-y-2">
        <p>
          <strong>30-Night Risk-Free Trial:</strong> We want you to be completely satisfied. If you find the comfort profile unsuitable, reach out to our sleep care team within 30 nights.
        </p>
        <p>
          <strong>Authoritative Warranty:</strong> Covered by our manufacturer warranty against indentation and structural sagging under normal domestic usage.
        </p>
      </div>
    ),
  });

  return (
    <section
      className="my-16 md:my-28 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:p-12 shadow-xs"
      aria-labelledby="product-info-heading"
      data-testid="product-information-accordion"
    >
      <div className="mb-6 pb-4 border-b border-border/80">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-leaf mb-1 block">
          POLICIES & SPECIFICATIONS
        </span>
        <h2
          id="product-info-heading"
          className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
        >
          Product Information
        </h2>
      </div>

      <div className="divide-y divide-border/60">
        {items.map((item) => (
          <AccordionItem
            key={item.id}
            id={item.id}
            title={item.title}
            isOpen={Boolean(openSections[item.id])}
            onToggle={() => toggleSection(item.id)}
          >
            {item.content}
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
