import React from "react";
import { Link } from "react-router-dom";
import VideoHero from "@/components/home/VideoHero";
import SleepRibbon from "@/components/home/SleepRibbon";
import ExploreCategories from "@/components/home/ExploreCategories";
import SharkTankSection from "@/components/home/SharkTankSection";
import WhatsInside from "@/components/home/WhatsInside";
import SevenZonesSection from "@/components/home/SevenZonesSection";
import OrganicProcessSection from "@/components/home/OrganicProcessSection";
import CertificationExperience from "@/components/home/CertificationExperience";
import ExploreStores from "@/components/home/ExploreStores";
import { buttonVariants } from "@/components/ui/button";

export interface WebsiteSectionDefinition<T = any> {
  type: string;
  name: string;
  category: string;
  description: string;
  defaultData: T;
  rendererComponent: React.ComponentType<{ config: any; isPreview?: boolean }>;
}

const registry = new Map<string, WebsiteSectionDefinition<any>>();

export function registerWebsiteSection<T = any>(def: WebsiteSectionDefinition<T>) {
  registry.set(def.type, def);
}

export function getWebsiteSection(type: string): WebsiteSectionDefinition | undefined {
  return registry.get(type);
}

export function getAllRegisteredSections(): WebsiteSectionDefinition[] {
  return Array.from(registry.values());
}

// ----------------- Default 10 Live Section Registrations -----------------

// 1. Hero Video
registerWebsiteSection({
  type: "hero_video",
  name: "Hero Video / Banner",
  category: "Hero & Banners",
  description: "Full-width native looping video hero with fallback poster, autoplay, and CTA link.",
  defaultData: {
    video_url: "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4",
    poster_url: "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
    autoplay: true,
  },
  rendererComponent: () => <VideoHero />,
});

// 2. Sleep Ribbon Announcement
registerWebsiteSection({
  type: "announcement_bar",
  name: "Announcement Ribbon (Sleep Ribbon)",
  category: "Hero & Banners",
  description: "Editorial continuous marquee ribbon with rotating promise messages and star separators.",
  defaultData: {
    messages: ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"],
    separator: "✦",
  },
  rendererComponent: () => <SleepRibbon />,
});

// 3. Explore Categories
registerWebsiteSection({
  type: "category_grid",
  name: "Explore Categories Showroom",
  category: "Catalog & Storefront",
  description: "Interactive category showroom with floating micro-animations (Mattresses, Pillows, Toppers, Baby + Kids).",
  defaultData: {},
  rendererComponent: () => <ExploreCategories />,
});

// 4. Shark Tank Feature
registerWebsiteSection({
  type: "shark_tank_feature",
  name: "Shark Tank India Feature",
  category: "Media & Trust",
  description: "Cinematic banner featuring Shark Tank India Season 5 episode with expandable in-place video player.",
  defaultData: {
    banner_url: "https://cdn.phototourl.com/free/2026-09-22-71b40d3f-ad65-4569-9d86-378e72497548.png",
    video_url: "https://aiseralab.com/host-file/f/f51eb579-4f7e-45b5-929b-46f16b059ad1",
  },
  rendererComponent: () => <SharkTankSection />,
});

// 5. What's Inside?
registerWebsiteSection({
  type: "mattress_layer_breakdown",
  name: "What's Inside? 3D Layer Breakdown",
  category: "Interactive & Product Anatomy",
  description: "Dual typography showcase presenting the 3 authentic natural layers of the Kotson mattress.",
  defaultData: {},
  rendererComponent: () => <WhatsInside />,
});

// 6. Seven Zones & Benefits Strip
registerWebsiteSection({
  type: "seven_zones_support",
  name: "7-Zone Support & Benefits Strip",
  category: "Product Anatomy & Benefits",
  description: "Anatomical 7-zone body contouring diagram paired with an infinite-scroll benefits ticker.",
  defaultData: {},
  rendererComponent: () => <SevenZonesSection />,
});

// 7. Organic Latex Process
registerWebsiteSection({
  type: "organic_latex_process",
  name: "Organic Dunlop Latex Process (8 Steps)",
  category: "Storytelling & Process",
  description: "Comprehensive 8-step visual walkthrough: tree tapping, water-washing, vulcanizing, and quality audit.",
  defaultData: {},
  rendererComponent: () => <OrganicProcessSection />,
});

// 8. Certifications Experience
registerWebsiteSection({
  type: "certifications_badges",
  name: "Certifications & Trust Explorer",
  category: "Trust & Information",
  description: "Verified seals and audit details for GOLS, eco-INSTITUT, FSC, LGA Durability, and OEKO-TEX.",
  defaultData: {},
  rendererComponent: () => <CertificationExperience />,
});

// 9. Explore Our Stores
registerWebsiteSection({
  type: "explore_stores",
  name: "Explore Our Stores",
  category: "Retail & Locations",
  description: "Editorial 36/64 split section with store hero image, compact location cards, and a side-drawer store detail panel (desktop) / bottom-sheet (mobile).",
  defaultData: {},
  rendererComponent: () => <ExploreStores />,
});

// 10. Real Sleeper Testimonials
registerWebsiteSection({
  type: "testimonials_slider",
  name: "Real Sleeper Testimonials",
  category: "Social Proof",
  description: "Verified customer quote cards highlighting pain-free sleep, purity, and fast delivery.",
  defaultData: {
    heading: "Comfort, Naturally.",
    testimonials: [
      {
        name: "Verified buyer — Pune",
        text: "My lower-back stiffness eased within the first two weeks. The 7-zone feel is real — firm where it should be, soft at the shoulders.",
        rating: 5,
      },
      {
        name: "Verified buyer — Bengaluru",
        text: "No chemical smell at all, which was the whole point of going organic. Delivery and setup were smooth.",
        rating: 5,
      },
      {
        name: "Verified buyer — Kochi",
        text: "Bought the crib mattress for my daughter; it is firm, breathable and light. Exactly what the pediatrician recommended.",
        rating: 5,
      },
    ],
  },
  rendererComponent: ({ config }) => {
    const heading = config?.heading || "Comfort, Naturally.";
    const items = config?.testimonials || [];

    return (
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-20 sm:px-6" aria-label="Testimonials">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="font-ui text-eyebrow text-brand-deep">REAL EXPERIENCES</p>
          <h2 className="mt-1.5 font-display text-display-lg text-brand-charcoal">
            {heading}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3" data-testid="testimonials-grid">
          {items.map((t: any, i: number) => (
            <blockquote key={i} className="rounded-2xl border border-border bg-card p-6" data-testid={`testimonial-${i}`}>
              <p className="font-ui text-sm sm:text-[15px] leading-relaxed text-brand-charcoal/85">“{t.text}”</p>
              <footer className="mt-4 font-ui text-xs font-semibold text-brand-deep">{t.name}</footer>
            </blockquote>
          ))}
        </div>
      </section>
    );
  },
});

// 10. Final CTA Banner
registerWebsiteSection({
  type: "cta_banner",
  name: "Where Better Sleep Begins (Final CTA)",
  category: "Hero & Banners",
  description: "High-impact closing banner before footer with phone order hotline and Buy button.",
  defaultData: {
    heading: "Where Better Sleep Begins.",
    subheading: "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial.",
    cta_label: "Shop the collection",
    cta_link: "/collections",
  },
  rendererComponent: ({ config }) => {
    const heading = config?.heading || "Where Better Sleep Begins.";
    const sub = config?.subheading || "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial.";
    const label = config?.cta_label || "Shop the collection";
    const link = config?.cta_link || "/collections";

    return (
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-brand-deep px-6 py-14 text-center text-white sm:px-12 shadow-sm">
          <h2 className="font-display text-display-xl text-white">
            {heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-ui text-white/80 text-base sm:text-lg leading-relaxed">
            {sub}
          </p>
          <Link
            to={link}
            className={buttonVariants({ size: "lg" }) + " mt-8 bg-white text-brand-deep hover:bg-white/90 font-ui font-semibold shadow-xs"}
            data-testid="final-cta"
          >
            {label}
          </Link>
        </div>
      </section>
    );
  },
});
