import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

function AccordionItem({
  title,
  isOpen,
  onClick,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between py-5 text-left text-lg font-semibold transition-colors hover:text-brand-deep"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-300",
            isOpen && "rotate-180 text-brand-deep"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function ProductAccordions({ product }: { product: Product }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First open by default

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const isPillow = product.category_slug === "pillows" || product.category_slug === "baby-kids";
  const unit = isPillow ? "cm" : "inches";

  // Build the sections array
  const sections = [];

  // Key Features
  if (product.features && product.features.length > 0) {
    sections.push({
      title: "Key Features",
      content: (
        <ul className="list-inside list-disc space-y-2 marker:text-brand-deep">
          {product.features.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ),
    });
  }

  // Specifications
  if (product.specifications && Object.keys(product.specifications).length > 0) {
    sections.push({
      title: "Specifications & Measurements",
      content: (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {Object.entries(product.specifications).map(([key, value], i) => {
                // Determine if we should append the unit
                const needsUnit = ["length", "width", "height", "thickness", "breadth"].includes(key.toLowerCase());
                const displayValue = needsUnit && !value.includes(unit) ? `${value} ${unit}` : value;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-brand-sand/10"}>
                    <td className="px-4 py-3 font-medium text-foreground">{key}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{displayValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  // Care Instructions
  if (product.care_instructions) {
    sections.push({
      title: "Care Instructions",
      content: <p className="whitespace-pre-line leading-relaxed">{product.care_instructions}</p>,
    });
  }

  // Fallback defaults if sections are empty
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="mt-10" data-testid="product-accordions">
      {sections.map((sec, i) => (
        <AccordionItem
          key={i}
          title={sec.title}
          isOpen={openIndex === i}
          onClick={() => toggle(i)}
        >
          {sec.content}
        </AccordionItem>
      ))}
    </div>
  );
}
