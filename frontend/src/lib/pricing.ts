/**
 * Shared INR pricing utility for Kotson web application.
 *
 * New display model:
 *   SELLING PRICE (bold)  = stored MRP  (what the customer actually pays)
 *   CROSSED-OUT price     = MRP × 1.40  (inflated "was" price for marketing display)
 *   BADGE                 = "(40% OFF)"
 *
 * calculateInflatedPrice: given the real selling price (MRP), returns the
 * inflated crossed-out "was" price = round(mrp × (1 + inflatePercent/100)).
 */
export function calculateInflatedPrice(mrpPaise: number, inflatePercent: number = 40): number {
  if (mrpPaise <= 0) return 0;
  if (inflatePercent <= 0) return mrpPaise;
  const mrpRupees = mrpPaise / 100;
  const inflatedRupees = Math.round(mrpRupees * (1 + inflatePercent / 100));
  return inflatedRupees * 100;
}

/** @deprecated Use calculateInflatedPrice. Kept for backward compat during migration. */
export const calculateSalePrice = calculateInflatedPrice;

