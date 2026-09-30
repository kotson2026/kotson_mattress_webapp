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
import SharkTankSection from "@/components/home/SharkTankSection";
import ExploreStores from "@/components/home/ExploreStores";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import CustomerSupportCta from "@/components/home/CustomerSupportCta";
import { getWebsiteSection } from "@/lib/cms/SectionRegistry";

/**
 * Authoritative 10 Structural Sections for the Kotson Homepage (Step 9).
 * Exact Structural Order:
 * 1. Hero video
 * 2. Scrolling announcement
 * 3. Explore Categories
 * 4. What's Inside Kotson
 * 5. 7-Zone ergonomic support
 * 6. Certifications / manufacturing
 * 7. Shark Tank
 * 8. Explore Store
 * 9. Customer Testimonials
 * 10. Need Help Choosing
 * 11. Footer (SiteFooter)
 *
 * Architecture:
 * Approved source-controlled structure -> published CMS overrides -> render.
 * Missing CMS records NEVER destroy the complete 11-section approved homepage.
 */
interface SectionDef {
  key: string;
  type: string;
  defaultComponent: React.ComponentType<{ config?: any; isPreview?: boolean }>;
}

const STRUCTURAL_SECTIONS: SectionDef[] = [
  { key: "hero_video", type: "hero_video", defaultComponent: VideoHero },
  { key: "announcement_bar", type: "announcement_bar", defaultComponent: SleepRibbon },
  { key: "category_grid", type: "category_grid", defaultComponent: ExploreCategories },
  { key: "mattress_layer_breakdown", type: "mattress_layer_breakdown", defaultComponent: WhatsInside },
  { key: "seven_zones_support", type: "seven_zones_support", defaultComponent: SevenZonesSection },
  { key: "certifications_badges", type: "certifications_badges", defaultComponent: CertificationExperience },
  { key: "shark_tank_feature", type: "shark_tank_feature", defaultComponent: SharkTankSection },
  { key: "explore_stores", type: "explore_stores", defaultComponent: ExploreStores },
  { key: "customer_testimonials", type: "customer_testimonials", defaultComponent: CustomerTestimonials },
  { key: "need_help_choosing", type: "need_help_choosing", defaultComponent: CustomerSupportCta },
];

export default function Home() {
  // Query CMS Published Homepage
  const { data: homePage } = useQuery({
    queryKey: ["cms-page-home"],
    queryFn: () => apiGet<any>("/cms/pages/home"),
    staleTime: 30_000,
  });

  // Map published CMS sections by type & id for fast lookup
  const cmsMap = new Map<string, any>();
  const rawSections: any[] = homePage?.sections || [];
  for (const s of rawSections) {
    if (s.type) cmsMap.set(s.type, s);
    if (s.id) cmsMap.set(s.id, s);
  }

  return (
    <div className="min-h-svh">
      <StorefrontHeader />

      <main>
        {STRUCTURAL_SECTIONS.map((sec) => {
          const cmsOverride = cmsMap.get(sec.type) || cmsMap.get(sec.key);

          // If owner explicitly hides section in CMS, respect that
          if (cmsOverride && (cmsOverride.is_visible === false || cmsOverride.enabled === false)) {
            return null;
          }

          // Use registered component from SectionRegistry or the approved default
          const registered = getWebsiteSection(sec.type);
          const Component = registered ? registered.rendererComponent : sec.defaultComponent;

          return <Component key={sec.key} config={cmsOverride?.config} />;
        })}
      </main>

      <SiteFooter />
    </div>
  );
}
