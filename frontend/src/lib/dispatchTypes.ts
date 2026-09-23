export interface DispatchOverviewMetrics {
  awaiting_dispatch: number;
  ready_to_pack: number;
  packed: number;
  in_transit: number;
  delivered: number;
  delivery_exceptions: number;
  return_requests: number;
  trial_requests: number;
  stock_exceptions?: number;
}

export interface DispatchOverviewSla {
  target_hours: number;
  orders_measured: number;
  within_target: number;
  adherence_percentage: number | null;
  status_text: string;
}

export interface DispatchOverviewResponse {
  awaiting_dispatch: number;
  ready_to_pack: number;
  packed: number;
  in_transit: number;
  delivered: number;
  delivery_exceptions: number;
  return_requests: number;
  trial_requests: number;
  stock_exceptions?: number;
  sla: DispatchOverviewSla;
}

export interface DispatchOrderItem {
  variant_id: string;
  product_name: string;
  sku: string;
  size?: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface DispatchShipment {
  id: string;
  order_id: string;
  carrier: string;
  awb_number: string;
  status: string;
  tracking_url?: string;
  dispatched_at?: string;
  delivered_at?: string;
}

export interface DispatchOrderRow {
  order_id: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  phone: string;
  email: string;
  products_summary: string;
  items: DispatchOrderItem[];
  units: number;
  order_value_paise: number;
  payment_status: string;
  sales_source: string;
  fulfilment_method: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  address: any;
  order_status: string;
  stock_status: string;
  dispatch_status: string;
  age_text: string;
  warehouse_id: string;
  latest_shipment?: DispatchShipment | null;
  is_test_data?: boolean;
}

export interface DispatchOrdersResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  rows: DispatchOrderRow[];
}

export interface ReturnRequestRow {
  id: string;
  request_number: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  raised_by?: string;
  reason: string;
  kind?: string;
  condition?: string;
  status: string;
  restocked?: boolean;
  refund_info?: any;
  replacement_order_id?: string;
  replacement_order_number?: string;
  items?: any[];
  created_at: string;
  is_test_data?: boolean;
}

export interface ReturnsResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  rows: ReturnRequestRow[];
}

export interface TrialRow {
  order_id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string;
  mattress_name: string;
  sku: string;
  purchase_amount_paise: number;
  delivered_date: string;
  trial_start: string;
  trial_end: string;
  days_used: number;
  days_remaining: number;
  trial_status: string;
  claim_info?: any;
  is_test_data?: boolean;
}

export interface TrialsResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  rows: TrialRow[];
}

export interface CarrierRow {
  id: string;
  code: string;
  name: string;
  status: string;
  service_type: string;
  api_connected: boolean;
  tracking_url_pattern?: string;
  supported_regions?: string[];
  orders_shipped: number;
  in_transit: number;
  delivered: number;
  exceptions: number;
  avg_delivery_days: string;
  notes?: string;
}

export interface CarriersResponse {
  rows: CarrierRow[];
}
