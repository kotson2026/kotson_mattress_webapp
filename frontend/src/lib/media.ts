/**
 * Canonical Kotson Media URL Resolver
 * Resolves Supabase Storage object paths, canonical public URLs, local static fallback URLs,
 * and normalizes legacy phototourl expired URLs to valid canonical paths.
 */

const SUPABASE_STORAGE_BASE = "https://buodzslvzkungwufdkca.supabase.co/storage/v1/object/public/kotson-media";

const LEGACY_URL_MAP: Record<string, string> = {
  "5f3360d1-de72-4db6-b87b-fd03e0286836": "/stores/kotson-store.jpg",
  "8f77abc6-0f41-42df-8b46-df110ccc137c": "/mattress-layers/mattress-construction.webp",
  "feb051a4-db5e-4b7e-95ff-81f431f54595": "/seven-zones/seven-zones-hero.webp",
  "fdcc5d89-9660-48c9-8356-3c13ea2156c8": "/categories/customizable-products.png",
  "58e2ca4e-ebff-4af3-be34-e3e84717dbb8": "/navbar/mattress.png",
  "db2b927f-f73a-4acf-aa46-ca3f72a19d43": "/navbar/pillows.png",
  "d8cd5b3e-7b3c-4614-8cd3-293abc8d1526": "/navbar/toppers.png",
  "c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238": "/navbar/baby-kids.png",
};

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  // Normalize legacy phototourl URLs
  if (trimmed.includes("phototourl.com")) {
    for (const [key, replacement] of Object.entries(LEGACY_URL_MAP)) {
      if (trimmed.includes(key)) {
        return replacement;
      }
    }
    return "/stores/kotson-store.jpg";
  }

  // Absolute URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Relative public asset URL
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // Supabase Storage object path (e.g., "uploads/img.png" or "cms/hero.png")
  const cleanPath = trimmed.startsWith("kotson-media/") ? trimmed.replace(/^kotson-media\//, "") : trimmed;
  return `${SUPABASE_STORAGE_BASE}/${cleanPath}`;
}
