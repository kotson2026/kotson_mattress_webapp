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
    imageUrl: "/navbar/mattress.png",
    localFallback: "/navbar/mattress.png",
    slot: "category-mattress",
  },
  {
    slug: "pillows",
    label: "Pillows",
    tagline: "Cervical & Ergonomic Spinal Support",
    imageUrl: "/navbar/pillows.png",
    localFallback: "/navbar/pillows.png",
    slot: "category-pillow",
  },
  {
    slug: "toppers",
    label: "Toppers",
    tagline: "Breathable Organic Comfort Layer",
    imageUrl: "/navbar/toppers.png",
    localFallback: "/navbar/toppers.png",
    slot: "category-topper",
  },
  {
    slug: "baby-kids",
    label: "Baby + Kids",
    tagline: "Pediatric Certified Pure Latex",
    imageUrl: "/navbar/baby-kids.png",
    localFallback: "/navbar/baby-kids.png",
    slot: "category-babykids",
  },
];
