// CRM (Sections F/G) + order-operations (Section H) types.
// Hand-written mirrors of the Pydantic models — kept in sync in the same edit.

export interface SourceEvent {
  id: string;
  event_key: string;
  kind: string;
  customer_id: string | null;
  guest_session: string | null;
  email: string | null;
  phone: string | null;
  product_name: string | null;
  order_id: string | null;
  created_at: string;
}

export interface Stage {
  code: string;
  label: string;
  sort: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Pipeline {
  id: string;
  code: string;
  name: string;
  kind: "intake" | "sales" | "service";
  stages: Stage[];
  is_active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  code: string;
  name: string;
  source_kind: string;
  pipeline_id: string | null;
  is_active: boolean;
  ad_metrics_source: "not_connected";
  created_at: string;
}

export type LeadQualification = "registered" | "cart_intent" | "sales_qualified" | "converted" | "disqualified";

export interface Lead {
  id: string;
  lead_number: string;
  kind: "registration" | "cart_opportunity" | "sales" | "service" | "dealer";
  customer_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  pipeline_id: string | null;
  stage_code: string;
  qualification: LeadQualification;
  campaign_code: string | null;
  source_kind: string;
  source_event_ids: string[];
  master_id: string | null;
  manager_id: string | null;
  employee_id: string | null;
  product_interest: string | null;
  cart_id: string | null;
  converted_order_id: string | null;
  converted_at: string | null;
  consent_marketing: boolean;
  is_open: boolean;
  stage_history: { at: string; from: string; to: string; actor: string; reason: string }[];
  assignment_history: { at: string; actor: string; reason: string; manager_id?: string | null; employee_id?: string | null }[];
  created_at: string;
  updated_at: string;
}

export interface LeadPage {
  total: number;
  limit: number;
  offset: number;
  rows: Lead[];
}

export interface LeadOrderContext {
  order_number: string;
  payment_status: string;
  fulfilment_status: string;
  total: number;
  created_at: string;
}

export interface CrmCall {
  id: string;
  lead_id: string;
  connectivity_code: string;
  connectivity_label: string;
  disposition_code: string;
  disposition_label: string;
  outcome_code: string | null;
  outcome_label: string | null;
  form_code: string | null;
  form_version: number | null;
  form_snapshot: FormFieldDef[];
  form_answers: Record<string, unknown>;
  summary: string | null;
  verified_telephony: boolean;
  agent_id: string;
  agent_email: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  lead_id: string;
  due_at: string;
  reason: string;
  status: "pending" | "completed" | "cancelled";
  owner_id: string;
  created_by: string;
  completed_at: string | null;
  completion_note: string | null;
  created_at: string;
}

export interface FollowUpRow extends FollowUp {
  lead: { id: string; name: string; lead_number: string; phone: string | null; email: string | null; stage_code: string } | null;
  due_at_ist: string;
  last_call_at: string | null;
}

export interface CrmNote {
  id: string;
  body: string;
  author_email: string;
  created_at: string;
}

export interface ServiceCase {
  id: string;
  case_number: string;
  customer_id: string | null;
  order_id: string | null;
  order_number: string | null;
  category: string;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "waiting_customer" | "escalated" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  resolution: string | null;
  trail: { at: string; actor: string; note?: string | null }[];
  created_at: string;
}

export interface LeadWorkspace {
  lead: Lead;
  source_events: SourceEvent[];
  calls: CrmCall[];
  follow_ups: FollowUp[];
  notes: CrmNote[];
  cases: ServiceCase[];
  orders: LeadOrderContext[];
}

// --- call configuration ---

export interface ConnectivityOpt {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort: number;
}

export interface DispositionOpt extends ConnectivityOpt {
  connectivity_code: string;
  requires_outcome: boolean;
}

export interface OutcomeOpt extends ConnectivityOpt {}

export interface FormFieldDef {
  code: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "multiselect" | "checkbox" | "radio";
  required: boolean;
  options: string[];
  sort: number;
}

export interface EngagementFormDef {
  id: string;
  code: string;
  name: string;
  version: number;
  fields: FormFieldDef[];
  is_active: boolean;
  summary_field: "off" | "optional" | "required";
  created_at: string;
}

export interface CallConfig {
  connectivities: ConnectivityOpt[];
  dispositions: DispositionOpt[];
  outcomes: OutcomeOpt[];
  forms: EngagementFormDef[];
  configured: boolean;
  active_counts: { connectivities: number; dispositions: number };
}

export interface CrmOverview {
  registrations: number;
  cart_opportunities: number;
  sales_qualified: number;
  converted_paid_orders: number;
  open_leads: number;
  new_today_ist: number;
  conversion_rate_pct: number;
  conversion_denominator: string;
  attributed_revenue_paise: number;
  revenue_basis: string;
  follow_ups_due: number;
  follow_ups_overdue: number;
  calls_logged: number;
  calls_connected: number;
  unique_leads_contacted: number;
  call_telephony_verified: boolean;
  ad_spend: string;
  impressions: string;
  roas: string;
  timezone: string;
}

export interface TeamReportRow {
  staff_id: string;
  name: string;
  email: string;
  roles: string[];
  assigned_leads: number;
  conversions: number;
  calls_logged: number;
  connected_calls: number;
  connect_rate_pct: number;
  follow_ups_overdue: number;
  cases_resolved: number;
}

// --- order operations (Section H) ---

export interface DispatchLine {
  variant_id: string;
  product_name: string;
  sku: string;
  ordered: number;
  shipped: number;
  pending: number;
}

export interface DispatchRow {
  order_id: string;
  order_number: string;
  customer: string | null;
  fulfilment_status: string;
  placed_at: string;
  total: number;
  items: DispatchLine[];
  fully_shipped: boolean;
  shipments: number;
}

export interface DispatchQueue {
  total: number;
  stock_exceptions: number;
  rows: DispatchRow[];
}

export interface Shipment {
  id: string;
  shipment_number: string;
  order_id: string;
  items: { variant_id: string; sku: string; product_name: string; qty: number }[];
  carrier: string | null;
  tracking_reference: string | null;
  tracking_url: string | null;
  tracking_is_manual: boolean;
  status: "created" | "dispatched" | "in_transit" | "out_for_delivery" | "delivered" | "delivery_failed" | "returned";
  pickup_at: string | null;
  milestones: { at: string; status: string; actor?: string; note?: string | null; source?: string }[];
  created_by: string;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  request_number: string;
  order_id: string;
  order_number: string;
  kind: "return" | "trial" | "warranty" | "cancellation";
  reason: string;
  items: { variant_id: string; qty: number }[];
  status: string;
  policy_version: string;
  raised_by: string;
  raised_by_role: string | null;
  restocked: boolean;
  trail: { at: string; actor: string; status: string; note?: string | null }[];
  created_at: string;
}

export interface PublicTracking {
  order_number: string;
  payment_status: string;
  fulfilment_status: string;
  placed_at: string;
  items: { product_name: string; qty: number }[];
  shipments: {
    shipment_number: string;
    status: string;
    carrier: string | null;
    tracking_reference: string | null;
    tracking_url: string | null;
    tracking_is_manual: boolean;
    items: { product_name: string; qty: number }[];
    milestones: { status: string; at: string; note: string | null }[];
  }[];
  tracking_note: string;
}
