export type DockState = "landing" | "compact" | "minimal";

export type CategorySlug = "mattresses" | "pillows" | "toppers" | "baby-kids";

export interface DockCategoryItem {
  slug: CategorySlug;
  label: string;
  tagline: string;
  imageUrl: string;
  localFallback: string;
  slot: string;
}

export const DOCK_CATEGORIES: DockCategoryItem[] = [
  {
    slug: "mattresses",
    label: "Mattresses",
    tagline: "7-Zone Ergonomic Natural Latex",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
    localFallback: "/navbar/mattress.png",
    slot: "category-mattress",
  },
  {
    slug: "pillows",
    label: "Pillows",
    tagline: "Cervical & Ergonomic Spinal Support",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
    localFallback: "/navbar/pillows.png",
    slot: "category-pillow",
  },
  {
    slug: "toppers",
    label: "Toppers",
    tagline: "Breathable Organic Comfort Layer",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
    localFallback: "/navbar/toppers.png",
    slot: "category-topper",
  },
  {
    slug: "baby-kids",
    label: "Baby + Kids",
    tagline: "Pediatric Certified Pure Latex",
    imageUrl: "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
    localFallback: "/navbar/baby-kids.png",
    slot: "category-babykids",
  },
];
