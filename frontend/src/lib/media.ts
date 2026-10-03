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
  "becf1398-8387-4f2c-a4bd-729072937fdf": "/seven-zones/seven-zones-hero.webp",
  "af7dc6e9-091c-496e-ad79-c5638c2915e1": "/stores/kotson-store.jpg",
};

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "/stores/kotson-store.jpg";

  const trimmed = url.trim();
  if (!trimmed) return "/stores/kotson-store.jpg";

  // Normalize legacy phototourl URLs
  if (trimmed.includes("phototourl.com")) {
    for (const [key, replacement] of Object.entries(LEGACY_URL_MAP)) {
      if (trimmed.includes(key)) {
        return replacement;
      }
    }
    return trimmed;
  }

  // Already a Supabase Storage public URL
  if (trimmed.includes("supabase.co/storage/v1/object/public/")) {
    return trimmed;
  }

  // Absolute external URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Relative public asset URL (e.g. "/stores/kotson-store.jpg")
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // Supabase Storage object path (e.g., "uploads/img.png" or "cms/hero.png" or "kotson-media/...")
  const cleanPath = trimmed.startsWith("kotson-media/") ? trimmed.replace(/^kotson-media\//, "") : trimmed;
  return `${SUPABASE_STORAGE_BASE}/${cleanPath}`;
}

