// Hand-written mirrors of the backend Pydantic models — nothing infers across the HTTP boundary.
// Money is integer PAISE everywhere; format with inr() for display.

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  roles: string[];
  referral_code: string | null;
  referred_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthOut {
  user: User;
  guest_cart_merged: number;
}

export interface OtpSessionInfo {
  otp_token: string;
  phone: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  is_new_customer: boolean;
}

export interface SavedAddress {
  id: string;
  customer_id: string;
  label: string;
  full_name: string;
  phone: string;
  email: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponResult {
  valid: boolean;
  code: string;
  discount_paise: number;
  discount_type: string;
  discount_value: number;
  stackable_with_global_promo: boolean;
  message: string;
  coupon_id: string | null;
}

export type CheckoutStep =
  | "CART"
  | "PHONE_ENTRY"
  | "OTP_VERIFY"
  | "ADDRESS_SELECT"
  | "ADDRESS_ADD"
  | "PAYMENT"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILURE";



export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_slot: string;
  sort: number;
  product_count?: number;
  is_active: boolean;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  length: string | null;
  width: string | null;
  thickness: string | null;
  firmness: string | null;
  price: number; // paise - discounted selling price
  mrp: number | null; // paise - authoritative original MRP
  discount_amount?: number;
  discount_percent?: number;
  stock: number;
  reserved: number;
  free_stock: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category_slug: string;
  badge: string | null;
  rating: number | null;
  review_count: number;
  trial_days: number | null;
  warranty_years: number | null;
  images: string[];
  primary_image?: string;
  is_seed: boolean;
  is_active: boolean;
  sort: number;
  created_at: string;
  variants: Variant[];
  price_from: number | null;
  mrp_from?: number | null;
  discount_percent?: number;
  in_stock: boolean;
  features?: string[];
  specifications?: Record<string, string>;
  care_instructions?: string;
  is_best_seller?: boolean;
  short_description?: string;
}

export interface CartLine {
  variant_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  sku: string;
  size: string;
  length: string | null;
  width: string | null;
  thickness: string | null;
  firmness: string | null;
  qty: number;
  unit_price: number; // paise - selling price
  line_total: number; // paise - unit_price * qty
  mrp?: number | null; // paise - original MRP
  discount_amount?: number;
  discount_percent?: number;
  stock: number;
  free_stock: number;
  is_active: boolean;
  image?: string | null;
}

export interface CartView {
  items: CartLine[];
  item_count: number;
  subtotal: number;
  total_mrp?: number;
  total_discount?: number;
  referred_code: string | null;
  referral_status: "none" | "valid" | "invalid" | "self" | "no_published_rule";
  referral_discount: number;
  referral_note: string;
}

export interface OrderItem {
  variant_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  sku: string;
  size: string;
  length: string | null;
  width: string | null;
  thickness: string | null;
  firmness: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface OrderEvent {
  at: string;
  type: string;
  detail: string;
  actor: string;
}

export interface OrderAmounts {
  subtotal: number;
  discount: number;
  tax: number;
  tax_status: string;
  shipping: number;
  shipping_status: string;
  total: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  guest_access_token: string | null;
  channel: string;
  items: OrderItem[];
  address: Record<string, string>;
  amounts: OrderAmounts;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  fulfilment_status: "awaiting_payment" | "processing" | "shipped" | "delivered" | "cancelled";
  reservation_status: string;
  referral_code: string | null;
  stock_exception?: boolean;
  fulfilment_blocked?: boolean;
  order_source?: string;
  order_channel?: string;
  sale_date?: string;
  employee_id?: string | null;
  dealer_id?: string | null;
  source_note?: string | null;
  payment_verification_source?: string;
  manual_payment_ref?: string | null;
  manual_payment_remarks?: string | null;
  razorpay: Record<string, unknown>;
  events: OrderEvent[];
  created_at: string;
  is_test_data?: boolean;
  data_environment?: string;
  seed_batch_id?: string;
  seed_key?: string;
}

export interface GatewayInfo {
  state: "ready_test" | "ready_live" | "pending_keys" | "error";
  mode: string;
  key_id: string | null;
  rzp_order_id: string | null;
  amount: number;
  detail?: string;
}

export interface CheckoutStartOut {
  order_id: string;
  order_number: string;
  guest_access_token: string | null;
  amounts: OrderAmounts;
  gateway: GatewayInfo;
}

export interface CheckoutConfig {
  gateway: string;
  mode: string;
  state: "ready_test" | "ready_live" | "pending_keys" | "error";
  key_id: string | null;
  currency: string;
  reservation_ttl_minutes: number;
}

export interface Claim {
  key: string;
  label: string;
  body: string;
  status: "draft" | "published";
  evidence_status: "pending" | "approved";
  evidence_url: string;
  applies_to: string;
  conditions: string;
}

export interface CMSBlock {
  key: string;
  page: string;
  label: string;
  type: "text" | "json" | "richtext";
  value: string;
  status: "draft" | "published";
  updated_at: string;
  revisions: { value: string; status: string; at: string; by: string }[];
}

export interface AssetSlot {
  slot: string;
  section: string;
  alt_text: string;
  file_url: string;
  status: "placeholder" | "published";
  attribution: string;
  crop_desktop: string;
  crop_mobile: string;
}

export interface SiteSettings {
  company_name: string;
  support_email: string;
  support_phone: string;
  address: string;
  gst_rate: number | null;
  gst_status: string;
  shipping_flat_paise: number | null;
  shipping_status: string;
  free_shipping_enabled: boolean;
  razorpay_state: string;
  mail_state: string;
  analytics_consent: string;
  promotion_enabled?: boolean;
  promotion_discount_percent?: number;
  promotion_title?: string;
  promotion_discount_type?: string;
  promotion_scope?: string;
}

export interface LowStockRow {
  sku: string;
  product_name: string;
  size: string;
  free_stock: number;
}

export interface ManagerDashboard {
  awaiting_payment: number;
  to_process: number;
  processing: number;
  shipped: number;
  stock_exceptions: number;
  low_stock: LowStockRow[];
}

export interface Dashboard {
  revenue_paid_paise: number;
  paid_orders: number;
  orders_today: number;
  orders_week: number;
  awaiting_payment: number;
  stock_exceptions: number;
  low_stock: LowStockRow[];
  trend: { date: string; revenue_paise: number; orders: number }[];
  timezone: string;
}

export interface AuditEntry {
  id: string;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

export interface RewardEntry {
  id: string;
  order_number?: string;
  type: string;
  amount: number;
  status: "pending" | "approved" | "reversed" | "paid";
  created_at: string;
  user_id?: string;
  code?: string;
}

export interface ReferralRule {
  id: string;
  name: string;
  reward_type: "referee_discount" | "referrer_reward";
  value_type: "percent" | "fixed";
  value: number;
  min_spend_paise: number;
  first_order_only: boolean;
  status: "draft" | "published";
  attribution_window_days: number;
  created_at: string;
}

export interface ReferralMe {
  referral_code: string | null;
  share_url: string | null;
  clicks: number;
  attributed_signups: number;
  qualified_orders: number;
  rewards: RewardEntry[];
  published_rules: { name: string; reward_type: string; value_type: string; value: number; min_spend_paise: number; first_order_only: boolean }[];
  economics_configured: boolean;
  policy: string;
}

export interface Inquiry {
  id: string;
  customer_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  issue_type: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "normal" | "high";
  assignee_id: string | null;
  notes: { at: string; author_id: string; author_email: string; body: string }[];
  created_at: string;
}

export interface Dealer {
  id: string;
  user_id: string;
  org_name: string;
  gstin: string;
  territory: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  terms_status: string;
  created_at: string;
}

export interface DealerOrder {
  id: string;
  dealer_id: string;
  org_name: string;
  items: { variant_id: string; sku: string; product_name: string; size: string; qty: number }[];
  status: "quote_requested" | "quoted" | "approved" | "rejected" | "fulfilled";
  note: string;
  pricing_status: string;
  created_at: string;
  history?: { at: string; status: string; by: string; note: string }[];
}

export interface AffiliateMe {
  applied: boolean;
  status: "applied" | "approved" | "rejected" | null;
  campaign_status: string;
  note?: string;
  rewards?: RewardEntry[];
}

export interface CrmCustomer {
  id: string;
  email: string;
  name: string;
  created_at: string;
  verified_purchases: number;
  lifetime_spend_paise: number;
  last_order_at: string | null;
}

export interface CrmCustomerDetail {
  customer: { id: string; email: string; name: string; referral_code: string | null; referred_by: string | null; created_at: string };
  orders: { order_number: string; payment_status: string; fulfilment_status: string; total: number; created_at: string; items: OrderItem[] }[];
  notes: { id: string; body: string; author_email: string; created_at: string }[];
}

export interface TrackOut {
  order_number: string;
  payment_status: string;
  fulfilment_status: string;
  placed_at: string;
  items: { product_name: string; qty: number }[];
  events: { type: string; detail: string; at: string }[];
}

export interface Phase2LowStockItem {
  sku: string;
  product_name: string;
  category_slug: string;
  size: string;
  thickness: string | null;
  stock: number;
  reserved: number;
  free_stock: number;
  status: "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK";
}

export interface OwnerDashboardData {
  range: {
    preset: string;
    date_from: string;
    date_to: string;
  };
  product_orders: {
    mattresses: number;
    pillows: number;
    toppers: number;
    baby_kids: number;
    total_orders: number;
  };
  customer_activity: {
    signups: number;
    cart_users: number;
    purchased_customers: number;
  };
  dealer_network: {
    total_dealers: number;
    pending_approvals: number;
    dealer_sales_paise: number;
    dealer_orders: number;
  };
  low_stock_items: Phase2LowStockItem[];
}

export interface DashboardDrillDownData {
  type: string;
  category?: string;
  summary: {
    total_orders?: number;
    units_sold?: number;
    gross_sales_paise?: number;
    net_revenue_paise?: number;
    total_count?: number;
    total_sales_paise?: number;
  };
  items: any[];
}

export interface SalesSummaryResponse {
  kpi_row_1: {
    net_revenue_paise: number;
    gross_sales_paise: number;
    paid_orders: number;
    retail_orders: number;
    dealer_orders: number;
    walkin_orders: number;
    aov_paise: number;
    dealer_sales_paise: number;
    retail_sales_paise: number;
  };
  kpi_row_2: {
    new_registrations: number;
    refunds_reversals_paise: number;
    cancelled_orders: number;
    failed_payments: number;
    total_dealer_volume: number;
    manual_walkin_sales_paise: number;
  };
  trend: Array<{ label: string; revenue_paise: number; orders: number }>;
  by_source: Array<{ source: string; orders: number; revenue_paise: number }>;
  by_category: Array<{ category: string; orders: number; units: number; revenue_paise: number }>;
  by_location: Array<{ state: string; district: string; orders: number; revenue_paise: number }>;
  recent_transactions: Array<any>;
}

export interface ManualSaleItemIn {
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price: number;
  discount?: number;
}

export interface ManualSaleIn {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  sales_source: string;
  order_channel: string;
  employee_id?: string;
  dealer_id?: string;
  source_note?: string;
  sale_date: string;
  payment_method: string;
  manual_payment_ref?: string;
  manual_payment_remarks?: string;
  shipping_address: Record<string, string>;
  items: ManualSaleItemIn[];
}

