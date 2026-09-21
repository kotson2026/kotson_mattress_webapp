import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";

export default function About() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "about"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=about"),
  });

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-4xl font-black tracking-tight" data-testid="about-title">
          {blocks?.about_title ?? "About Kotson Naturals"}
        </h1>
        <p className="mt-6 leading-relaxed text-muted-foreground" data-testid="about-body">
          {blocks?.about_body ?? "Owner-approved brand copy is pending."}
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-bold">Company</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. Registered details, GSTIN and official contact information are
            published once validated by the owner.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
