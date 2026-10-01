import { apiPost } from "./api";

export const PENDING_CART_KEY = "kotson_pending_cart_item";

export interface PendingCartItem {
  product_id: string;
  variant_id: string;
  product_name?: string;
  product_slug?: string;
  size?: string;
  quantity?: number;
}

export function savePendingCartItem(item: PendingCartItem) {
  try {
    sessionStorage.setItem(PENDING_CART_KEY, JSON.stringify(item));
  } catch (e) {
    console.warn("Could not save pending cart item:", e);
  }
}

export function getPendingCartItem(): PendingCartItem | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CART_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCartItem;
  } catch {
    return null;
  }
}

export function clearPendingCartItem() {
  try {
    sessionStorage.removeItem(PENDING_CART_KEY);
  } catch (e) {
    console.warn("Could not clear pending cart item:", e);
  }
}

export async function restorePendingCartItem(): Promise<{ restored: boolean; item?: PendingCartItem }> {
  const item = getPendingCartItem();
  if (!item || !item.variant_id) return { restored: false };

  // Remove immediately before network call to prevent duplicate cart items on retry/callback
  clearPendingCartItem();

  try {
    await apiPost("/cart/items", {
      variant_id: item.variant_id,
      qty: Math.max(1, item.quantity || 1),
    });
    return { restored: true, item };
  } catch (err) {
    console.error("Failed to restore pending cart item:", err);
    return { restored: false, item };
  }
}
