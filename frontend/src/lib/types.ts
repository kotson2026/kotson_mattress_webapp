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
  phone_verified?: boolean;
  phone_verified_at?: string | null;
  phone_verification_provider?: string | null;
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

export interface DimensionRule {
  min: number;
  max: number;
  step: number;
  allowed_values?: number[] | null;
}

export interface CustomizationOptionValue {
  id: string;
  name: string;
  display_label?: string;
  image?: string;
  description?: string;
  additional_price: number; // paise
  enabled: boolean;
  sort_order?: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  display_label?: string;
  required: boolean;
  enabled: boolean;
  sort_order?: number;
  values: CustomizationOptionValue[];
}

export interface CustomPricingRule {
  pricing_mode: "quote_pending" | "formula" | "base_variant_ratio";
  base_rate_per_sq_inch_paise?: number;
  thickness_multiplier?: number;
  min_price_paise?: number | null;
  promotion_eligible?: boolean;
}

export interface ProductCustomizationConfig {
  enabled: boolean;
  unit: "inch" | "cm";
  dimensions: Record<string, DimensionRule>;
  options: CustomizationOption[];
  pricing: CustomPricingRule;
}

export interface ProductStoryFeature {
  icon?: string;
  title: string;
  description: string;
}

export interface ProductStorySection {
  enabled: boolean;
  eyebrow?: string;
  heading?: string;
  description?: string;
  features?: ProductStoryFeature[];
}

export interface ProductSuitabilityItem {
  label: string;
  value: string;
  icon?: string;
}

export interface ProductLifestyleSection {
  enabled: boolean;
  image_url?: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
  suitability_items?: ProductSuitabilityItem[];
  bullet_features?: string[];
}

export interface ProductConstructionLayer {
  order: number;
  name: string;
  description: string;
  icon?: string;
  image_url?: string;
}

export interface ProductConstructionSection {
  enabled: boolean;
  eyebrow?: string;
  heading?: string;
  description?: string;
  image_url?: string;
  layers?: ProductConstructionLayer[];
}

export interface ProductFitGuideItem {
  name: string;
  subtitle?: string;
  dimensions?: string;
  specs?: string;
  link_slug?: string;
}

export interface ProductFitGuideSection {
  enabled: boolean;
  eyebrow?: string;
  heading?: string;
  description?: string;
  items?: ProductFitGuideItem[];
}

export interface ProductStorytellingConfig {
  story?: ProductStorySection;
  lifestyle?: ProductLifestyleSection;
  construction?: ProductConstructionSection;
  fit_guide?: ProductFitGuideSection;
  certification_ids?: string[];
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
  customization?: ProductCustomizationConfig;
  storytelling?: ProductStorytellingConfig;
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
  image_url?: string | null;
  is_custom?: boolean;
  custom_configuration_id?: string | null;
  custom_dimensions?: Record<string, any> | null;
  custom_options?: any[] | null;
  custom_pricing_status?: string | null;
  custom_quote_label?: string | null;
  referral_discount?: number;
  coupon_discount?: number;
  referral_rule_id?: string | null;
  referral_rule_name?: string | null;
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
  coupon_code?: string | null;
  coupon_status?: string | null;
  coupon_discount?: number;
  coupon_message?: string;
  final_total?: number;
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
  title?: string;
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
  status?: string;
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

export interface BlogImage {
  id: string;
  url: string;
  alt_text: string;
  created_at?: string;
}

export interface BlogStoryNav {
  title: string;
  slug: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  conclusion_markdown: string;
  cover_image?: string;
  content_images: BlogImage[];
  conclusion_images: BlogImage[];
  seo_title: string;
  seo_description: string;
  keywords: string[];
  tags: string[];
  status: "draft" | "published" | "scheduled" | "archived";
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  scheduled_at?: string | null;
  archived_at?: string | null;
  prev_story?: BlogStoryNav | null;
  next_story?: BlogStoryNav | null;
  related_stories?: Blog[];
}

export interface BlogListResponse {
  items: Blog[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// STOCK POINT MODULE TYPES
// =============================================================================

export interface StockPointDashboardMetrics {
  total_stock_units: number;
  mattresses_units: number;
  pillows_units: number;
  toppers_units: number;
  baby_kids_units: number;
  manual_items_units: number;
  low_stock_count: number;
  today_dispatches_count: number;
  today_units_out: number;
}

export interface InventoryItem {
  id: string;
  item_type: "CATALOG_VARIANT" | "MANUAL_ITEM";
  product_id?: string | null;
  variant_id?: string | null;
  manual_stock_item_id?: string | null;
  product_name: string;
  category: string;
  category_slug: string;
  size: string;
  unit: string;
  sku: string;
  price: number;
  stock: number;
  available_quantity: number;
  reserved_quantity: number;
  free_stock: number;
  stock_status: "IN STOCK" | "LOW STOCK" | "OUT OF STOCK";
  last_updated: string;
  last_updated_date: string;
  last_updated_time: string;
}

export interface StockTransaction {
  id: string;
  item_type: "CATALOG_VARIANT" | "MANUAL_ITEM";
  product_id?: string | null;
  variant_id?: string | null;
  manual_stock_item_id?: string | null;
  product_name: string;
  category: string;
  variant_size: string;
  sku?: string | null;
  unit: string;
  transaction_type: "STOCK_RECEIVED" | "STOCK_DISPATCHED" | "STOCK_ADJUSTMENT";
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  dispatch_id?: string | null;
  dispatch_number?: string | null;
  dispatch_type?: "ONLINE_ORDER" | "OFFLINE_ORDER" | "DEALER" | "FRIENDS_INTERNAL" | "OTHER" | null;
  order_id?: string | null;
  reference_number?: string | null;
  supplier?: string | null;
  package_contents_summary?: string | null;
  remarks: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_role: string;
  created_at: string;
  formatted_date: string;
  formatted_time: string;
  formatted_datetime: string;
}

export interface StockDispatchItem {
  item_type: "CATALOG_VARIANT" | "MANUAL_ITEM";
  product_id?: string | null;
  variant_id?: string | null;
  manual_stock_item_id?: string | null;
  product_name: string;
  category: string;
  variant_size: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
}

export interface StockDispatch {
  id: string;
  dispatch_number: string;
  dispatch_type: "ONLINE_ORDER" | "OFFLINE_ORDER" | "DEALER" | "FRIENDS_INTERNAL" | "OTHER";
  order_id?: string | null;
  reference_number?: string | null;
  package_contents: string;
  remarks: string;
  items: StockDispatchItem[];
  total_units: number;
  created_by_user_id: string;
  created_by_name: string;
  created_by_role: string;
  created_at: string;
  formatted_date: string;
  formatted_time: string;
  formatted_datetime: string;
}

export interface StockManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  department?: string;
  designation?: string;
  is_active: boolean;
  created_at: string;
  created_at_formatted: string;
}

export interface CatalogTreeVariant {
  id: string;
  sku: string;
  size: string;
  unit: string;
  stock: number;
  display: string;
}

export interface CatalogTreeProduct {
  id: string;
  name: string;
  slug: string;
  variants: CatalogTreeVariant[];
}

export interface CatalogTreeCategory {
  slug: string;
  name: string;
  products: CatalogTreeProduct[];
}

export interface CatalogTreeManualItem {
  id: string;
  name: string;
  category: string;
  size: string;
  unit: string;
  stock: number;
  display: string;
}

// ==========================================
// REFER & EARN ENTERPRISE ENGINE TYPES
// ==========================================

export interface ReferralOverviewMetrics {
  total_referrers: number;
  total_referral_leads: number;
  referral_sales: number;
  referral_sales_value: number;
  customer_discounts_given?: number;
  pending_commission: number;
  approved_commission: number;
  total_commission_earned: number;
  pending_withdrawals: number;
  total_withdrawn_paid: number;
  funnel?: {
    visits: number;
    leads: number;
    accounts_created: number;
    carts_active: number;
    checkout_started: number;
    sales: number;
    conversion_rate: number;
  };
}


export interface ProductReferralRule {
  id: string;
  rule_name: string;
  product_ids: string[];
  product_id?: string | null;
  products?: { id: string; name: string; category?: string; price?: number }[];
  product_names?: string;
  categories?: string;
  commission_type: "PERCENTAGE" | "FLAT" | "FIXED";
  commission_value: number;
  commission_basis?: "selling_price" | "net_price";
  commission_calc_type?: "per_unit" | "per_line";
  discount_type: "PERCENTAGE" | "FLAT" | "FIXED";
  discount_value: number;
  discount_calc_type?: "per_unit" | "per_line";
  is_active: boolean;
  status?: string;
  effective_from?: string | null;
  effective_until?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReferralSettings {
  id?: string;
  allow_promotion_stacking: boolean;
  promotion_stacking_mode: "combine" | "better_discount" | "exclusive";
  coupon_stacking_mode: "allow" | "disallow" | "better_discount";
  commission_price_basis: "selling_price" | "net_price";
  flat_quantity_semantics: "per_unit" | "per_line";
  allow_self_referral: boolean;
  attribution_ttl_days: number;
  updated_at?: string;
}

export interface ReferrerKYCInfo {
  pan_masked?: string | null;
  name_as_per_pan?: string | null;
  pan_name?: string | null;
  doc_url?: string | null;
  status: "NOT_SUBMITTED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  verified_at?: string | null;
  rejection_reason?: string | null;
}

export interface ReferrerBankInfo {
  account_holder_name?: string | null;
  account_number_masked?: string | null;
  ifsc_code?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  status: "NOT_ADDED" | "PENDING_VERIFICATION" | "VERIFIED" | "NEEDS_CORRECTION";
  verified_at?: string | null;
  rejection_reason?: string | null;
}

export interface ReferrerRow {
  user_id: string;
  name: string;
  referral_code: string;
  email: string;
  phone: string;
  leads_count: number;
  sales_count: number;
  sales_value: number;
  pending_amount: number;
  available_amount: number;
  reserved_amount: number;
  total_earned: number;
  paid_amount: number;
  kyc_status: "NOT_SUBMITTED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  bank_status: "NOT_ADDED" | "PENDING_VERIFICATION" | "VERIFIED" | "NEEDS_CORRECTION";
  status: string;
  created_at: string;
}

export interface ReferrersResponse {
  total: number;
  page: number;
  limit: number;
  referrers: ReferrerRow[];
}

export interface ReferrerDetail {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    referral_code: string;
    date_joined: string;
    status: string;
  };
  kyc: ReferrerKYCInfo;
  bank: ReferrerBankInfo;
  performance: {
    total_leads: number;
    total_sales: number;
    sales_value: number;
    conversion_rate: number;
    pending_commission: number;
    available_commission: number;
    reserved_commission: number;
    total_earned: number;
    total_paid: number;
  };
  leads: {
    id: string;
    code: string;
    customer_name: string;
    customer_email_masked: string;
    source: string;
    status: string;
    attributed_date: string;
    converted: boolean;
    order_number?: string | null;
    sale_value?: number | null;
  }[];
  sales: {
    order_id: string;
    order_number: string;
    order_date: string;
    eligible_sale_value: number;
    commission_rule: string;
    commission_amount: number;
    commission_status: "pending" | "approved" | "reversed" | "paid" | "rejected";
  }[];
  commission_ledger: {
    id: string;
    order_number: string;
    eligible_sale_amount: number;
    commission_amount: number;
    rule_name: string;
    rule_value: number;
    rule_type: string;
    status: string;
    created_at: string;
    approved_at?: string | null;
    reversed_at?: string | null;
  }[];
  withdrawals: {
    id: string;
    request_number: string;
    amount: number;
    tds_rate: number;
    tds_amount: number;
    net_payable: number;
    status: string;
    created_at: string;
    payout_details?: {
      utr_number?: string;
      payment_method?: string;
      payment_date?: string;
    };
  }[];
}

export interface WithdrawalItem {
  id: string;
  request_number: string;
  user_id: string;
  user_name: string;
  user_email: string;
  referral_code: string;
  amount: number;
  tds_rule_snapshot: any;
  tds_rate: number;
  tds_amount: number;
  net_payable: number;
  kyc_status: string;
  bank_status: string;
  pan_masked: string;
  bank_account_masked: string;
  bank_name: string;
  status: "REQUESTED" | "UNDER_REVIEW" | "ON_HOLD" | "REJECTED" | "APPROVED" | "PROCESSING" | "PAID";
  hold_reason?: string | null;
  rejection_reason?: string | null;
  payout_details?: {
    paid_amount: number;
    tds_amount: number;
    net_amount: number;
    utr_number: string;
    payment_method: string;
    payment_date: string;
    updated_by: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WithdrawalsMetrics {
  pending_requests: number;
  on_hold: number;
  approved: number;
  processing: number;
  paid: number;
  rejected: number;
  total_requested: number;
  total_paid: number;
  tds_deducted: number;
}

export interface WithdrawalsResponse {
  total: number;
  page: number;
  limit: number;
  metrics: WithdrawalsMetrics;
  withdrawals: WithdrawalItem[];
}

export interface TaxSettings {
  id?: string;
  tds_enabled: boolean;
  payment_nature: string;
  pan_available_rate: number;
  pan_not_available_rate: number;
  applicable_threshold: number;
  effective_from: string;
  effective_until?: string | null;
  notes?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface ReferralPortalData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    referral_code: string;
    share_url: string;
    kyc: ReferrerKYCInfo;
    bank: ReferrerBankInfo;
  };
  wallet: {
    pending_commission: number;
    available_to_withdraw: number;
    reserved_for_withdrawal: number;
    total_earned: number;
    paid_commission: number;
  };
  performance: {
    total_leads: number;
    total_sales: number;
    sales_value: number;
    conversion_rate: number;
  };
  leads: any[];
  sales: any[];
  earnings_by_product?: {
    product_name: string;
    category: string;
    sales_count: number;
    commission_earned: number;
  }[];
  withdrawals: any[];
  tax_settings: {
    tds_enabled: boolean;
    pan_available_rate: number;
    pan_not_available_rate: number;
    applicable_threshold: number;
    payment_nature: string;
  };
}



