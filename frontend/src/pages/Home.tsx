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
import OrganicProcessSection from "@/components/home/OrganicProcessSection";
import SharkTankSection from "@/components/home/SharkTankSection";
import ExploreStores from "@/components/home/ExploreStores";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import CustomerSupportCta from "@/components/home/CustomerSupportCta";
import { getWebsiteSection } from "@/lib/cms/SectionRegistry";

/**
 * Authoritative 11 Structural Content Sections + Footer for Kotson Homepage:
 * 1. Hero
 * 2. Announcement
 * 3. Explore Categories
 * 4. What's Inside
 * 5. 7-Zone
 * 6. Certifications
 * 7. How Organic Latex Is Made
 * 8. Shark Tank
 * 9. Explore Store
 * 10. Testimonials
 * 11. Need Help
 * 12. Footer (SiteFooter)
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
  { key: "organic_latex_process", type: "organic_latex_process", defaultComponent: OrganicProcessSection },
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

  // Determine authoritative section order from CMS (published_sections -> sections -> STRUCTURAL_SECTIONS fallback)
  const sectionsToRender: any[] =
    (homePage?.published_sections && homePage.published_sections.length > 0)
      ? homePage.published_sections
      : (homePage?.sections && homePage.sections.length > 0)
      ? homePage.sections
      : STRUCTURAL_SECTIONS;

  return (
    <div className="min-h-svh">
      <StorefrontHeader />

      <main>
        {sectionsToRender.map((sec: any, idx: number) => {
          // If owner explicitly hides section in CMS, respect that
          if (sec.is_visible === false || sec.enabled === false) {
            return null;
          }

          // Use registered component from SectionRegistry or the approved default
          const registered = getWebsiteSection(sec.type);
          const fallbackDef = STRUCTURAL_SECTIONS.find(
            (s) => s.type === sec.type || s.key === sec.type || s.key === sec.id
          );
          const Component = registered ? registered.rendererComponent : fallbackDef?.defaultComponent;

          if (!Component) return null;

          return <Component key={sec.id || sec.key || `${sec.type}-${idx}`} config={sec.config} />;
        })}
      </main>

      <SiteFooter />
    </div>
  );
}
