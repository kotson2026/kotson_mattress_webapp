import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import VideoHero from "@/components/home/VideoHero";
import SleepRibbon from "@/components/home/SleepRibbon";
import ExploreCategories from "@/components/home/ExploreCategories";
import WhatsInside from "@/components/home/WhatsInside";
import SevenZonesSection from "@/components/home/SevenZonesSection";
import CertificationExperience from "@/components/home/CertificationExperience";
import ExploreStores from "@/components/home/ExploreStores";
import SharkTankSection from "@/components/home/SharkTankSection";
import OrganicProcessSection from "@/components/home/OrganicProcessSection";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import CustomerSupportCta from "@/components/home/CustomerSupportCta";
import { getWebsiteSection } from "@/lib/cms/SectionRegistry";

export default function Home() {
  // Query CMS Published Homepage
  const { data: homePage } = useQuery({
    queryKey: ["cms-page-home"],
    queryFn: () => apiGet<any>("/cms/pages/home"),
    staleTime: 30_000,
  });

  // Section types that are permanently removed from the homepage
  const REMOVED_TYPES = new Set(["testimonials_slider", "cta_banner"]);

  const visibleCmsSections = (homePage?.sections || [])
    .filter((sec: any) => sec.is_visible !== false && !REMOVED_TYPES.has(sec.type))
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  // Guard against missing end-of-page sections if CMS list is partial
  const hasExploreStoresInCms = visibleCmsSections.some((s: any) => s.type === "explore_stores");
  const hasNeedHelpInCms = visibleCmsSections.some((s: any) => s.type === "need_help_choosing");

  return (
    <div className="min-h-svh">
      <StorefrontHeader />

      <main>
        {visibleCmsSections.length > 0 ? (
          // Dynamic CMS Rendering through Section Registry
          <>
            {visibleCmsSections.map((sec: any) => {
              const registered = getWebsiteSection(sec.type);
              if (registered) {
                const Component = registered.rendererComponent;
                return <Component key={sec.id} config={sec.config} />;
              }
              return null;
            })}

            {/* Exactly ONE Explore Stores section guaranteed */}
            {!hasExploreStoresInCms && <ExploreStores />}

            {/* Exactly ONE Need Help Choosing support CTA guaranteed */}
            {!hasNeedHelpInCms && <CustomerSupportCta />}
          </>
        ) : (
          // Safe Fallback Sequence
          <>
            <VideoHero />
            <SleepRibbon />
            <ExploreCategories />
            <SharkTankSection />
            <WhatsInside />
            <SevenZonesSection />
            <OrganicProcessSection />
            <CertificationExperience />
            <CustomerTestimonials />
            <ExploreStores />
            <CustomerSupportCta />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
