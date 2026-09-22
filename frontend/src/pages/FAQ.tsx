import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { parseJsonBlock } from "@/lib/format";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";

interface FaqItem {
  q: string;
  a: string;
}

export default function FAQ() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "home"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=home"),
  });
  const items = parseJsonBlock<FaqItem[]>(blocks?.faq_items ?? "[]", []);

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight">Frequently asked questions</h1>
        <dl className="mt-10 divide-y divide-border" data-testid="faq-list">
          {items.length === 0 && <p className="text-muted-foreground">FAQ content is pending owner input.</p>}
          {items.map((f, i) => (
            <div key={i} className="py-6" data-testid={`faq-item-${i}`}>
              <dt className="font-heading text-lg font-bold">{f.q}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </main>
      <SiteFooter />
    </div>
  );
}
