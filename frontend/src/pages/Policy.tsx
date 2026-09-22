import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const TITLES: Record<string, string> = {
  policy_shipping: "Shipping policy",
  policy_returns: "Returns & 100-night trial",
  policy_privacy: "Privacy policy",
  policy_terms: "Terms of service",
};

export default function Policy() {
  const { slug } = useParams();
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "policies"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=policies"),
  });
  const body = slug ? blocks?.[slug] : undefined;

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight" data-testid="policy-title">
          {TITLES[slug ?? ""] ?? "Policy"}
        </h1>
        <div className="mt-8 rounded-2xl border border-dashed border-brand-amber/50 bg-brand-amber/5 p-6" data-testid="policy-body">
          <p className="leading-relaxed">
            {body ?? "PENDING OWNER APPROVAL — the final terms for this policy have not been published yet."}
          </p>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Policy pages are owner-editable content blocks. Published terms appear here verbatim and are reused at checkout and in the footer.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
