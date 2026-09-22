"""CRM domain models: source events, contacts, leads, pipelines, campaigns, follow-ups,
calls and the disposition/engagement-form configuration.

Authoritative invariants encoded here:
  * A CRM lead stage changes ONLY through an explicit stage change or an approved paid-order
    conversion rule — never as a side effect of saving a call or completing a follow-up.
  * Source events carry a unique idempotency key so retries never multiply leads.
  * CRM never owns customer/cart/order truth; it references them by stable ID.
"""

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from models.users import utcnow


def _id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------- source events

SourceKind = Literal["registration", "cart_intent", "checkout_started", "contact", "dealer_inquiry", "manual", "import"]


class SourceEvent(BaseModel):
    """Append-only intake record. `event_key` is unique — the dedup/idempotency anchor."""

    id: str = Field(default_factory=_id)
    event_key: str  # e.g. "registration:<user_id>" or "cart_intent:<user_id>:<cart_id>"
    kind: SourceKind
    customer_id: Optional[str] = None
    guest_session: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    campaign_code: Optional[str] = None
    referral_code: Optional[str] = None
    variant_id: Optional[str] = None
    product_name: Optional[str] = None
    cart_id: Optional[str] = None
    order_id: Optional[str] = None
    consent_marketing: bool = False
    payload: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------- pipelines

class Stage(BaseModel):
    code: str = Field(min_length=2, max_length=40)  # stable internal code
    label: str = Field(min_length=1, max_length=60)  # editable display label
    sort: int = 0
    is_won: bool = False
    is_lost: bool = False


class Pipeline(BaseModel):
    id: str = Field(default_factory=_id)
    code: str
    name: str = Field(min_length=2, max_length=80)
    kind: Literal["intake", "sales", "service"] = "sales"
    stages: List[Stage] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class PipelineIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    kind: Literal["intake", "sales", "service"] = "sales"
    stages: List[Stage] = Field(default_factory=list)


class Campaign(BaseModel):
    id: str = Field(default_factory=_id)
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=80)
    source_kind: str = "manual"  # maps inbound source -> campaign
    pipeline_id: Optional[str] = None
    is_active: bool = True
    # Ad metrics stay explicitly disconnected until a real data source is integrated.
    ad_metrics_source: Literal["not_connected"] = "not_connected"
    created_at: datetime = Field(default_factory=utcnow)


class CampaignIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=80)
    source_kind: str = "manual"
    pipeline_id: Optional[str] = None


# ---------------------------------------------------------------- leads

LeadKind = Literal["registration", "cart_opportunity", "sales", "service", "dealer"]


class Lead(BaseModel):
    id: str = Field(default_factory=_id)
    lead_number: str
    kind: LeadKind
    # Contact identity — customer_id when identified; guests only when they gave contact details.
    customer_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    pipeline_id: Optional[str] = None
    stage_code: str = "new"
    # Qualification is explicit: a registration lead is NOT a sales-qualified lead.
    qualification: Literal["registered", "cart_intent", "sales_qualified", "converted", "disqualified"] = "registered"
    campaign_code: Optional[str] = None
    source_kind: SourceKind = "manual"
    source_event_ids: List[str] = Field(default_factory=list)
    # Assignment lineage
    master_id: Optional[str] = None
    manager_id: Optional[str] = None
    employee_id: Optional[str] = None
    # Commerce context (read-only references)
    product_interest: Optional[str] = None
    cart_id: Optional[str] = None
    converted_order_id: Optional[str] = None
    converted_at: Optional[datetime] = None
    consent_marketing: bool = False
    is_open: bool = True
    stage_history: List[dict] = Field(default_factory=list)
    assignment_history: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LeadManualIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)
    pipeline_id: Optional[str] = None
    campaign_code: Optional[str] = None
    product_interest: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=2000)


class StageChangeIn(BaseModel):
    """The ONLY way a stage moves by hand. Reason is mandatory for the audit trail."""

    stage_code: str = Field(min_length=2, max_length=40)
    reason: str = Field(min_length=3, max_length=400)


class AssignIn(BaseModel):
    lead_ids: List[str] = Field(min_length=1, max_length=200)
    manager_id: Optional[str] = None
    employee_id: Optional[str] = None
    reason: str = Field(min_length=3, max_length=300)


# ---------------------------------------------------------------- follow-ups

class FollowUp(BaseModel):
    id: str = Field(default_factory=_id)
    lead_id: str
    due_at: datetime  # stored UTC, displayed IST
    reason: str
    status: Literal["pending", "completed", "cancelled"] = "pending"
    owner_id: str  # staff responsible
    created_by: str
    completed_at: Optional[datetime] = None
    completion_note: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class FollowUpIn(BaseModel):
    due_at: datetime
    reason: str = Field(min_length=3, max_length=300)
    owner_id: Optional[str] = None


class FollowUpCompleteIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=1000)


# ---------------------------------------------------------------- call configuration

class Connectivity(BaseModel):
    id: str = Field(default_factory=_id)
    code: str  # stable
    label: str
    is_active: bool = False  # drafts until the owner approves wording
    sort: int = 0


class Disposition(BaseModel):
    id: str = Field(default_factory=_id)
    code: str
    label: str
    connectivity_code: str  # backend enforces this pairing
    requires_outcome: bool = False
    is_active: bool = False
    sort: int = 0


class CallOutcome(BaseModel):
    id: str = Field(default_factory=_id)
    code: str
    label: str
    is_active: bool = False
    sort: int = 0


class ConfigPatch(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=80)
    is_active: Optional[bool] = None
    requires_outcome: Optional[bool] = None
    sort: Optional[int] = None


# ---------------------------------------------------------------- engagement forms

FieldType = Literal["text", "textarea", "number", "select", "multiselect", "checkbox", "radio"]


class FormField(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=120)
    type: FieldType = "text"
    required: bool = False
    options: List[str] = Field(default_factory=list)
    sort: int = 0


class EngagementForm(BaseModel):
    id: str = Field(default_factory=_id)
    code: str
    name: str
    version: int = 1
    fields: List[FormField] = Field(default_factory=list)
    is_active: bool = False
    summary_field: Literal["off", "optional", "required"] = "optional"
    created_at: datetime = Field(default_factory=utcnow)


class EngagementFormIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    fields: List[FormField] = Field(default_factory=list)
    summary_field: Literal["off", "optional", "required"] = "optional"


# ---------------------------------------------------------------- calls

class CallIn(BaseModel):
    """Manual call log. Connectivity -> disposition -> outcome (when required) -> form answers.
    Never carries recording/duration claims: no telephony provider is integrated."""

    connectivity_code: str
    disposition_code: str
    outcome_code: Optional[str] = None
    form_answers: dict = Field(default_factory=dict)
    summary: Optional[str] = Field(default=None, max_length=4000)
    idempotency_key: Optional[str] = Field(default=None, max_length=80)
    # Optional separate follow-up scheduled alongside the call
    follow_up_due_at: Optional[datetime] = None
    follow_up_reason: Optional[str] = Field(default=None, max_length=300)


class Call(BaseModel):
    id: str = Field(default_factory=_id)
    lead_id: str
    connectivity_code: str
    connectivity_label: str
    disposition_code: str
    disposition_label: str
    outcome_code: Optional[str] = None
    outcome_label: Optional[str] = None
    form_code: Optional[str] = None
    form_version: Optional[int] = None
    form_snapshot: List[dict] = Field(default_factory=list)  # field defs at call time
    form_answers: dict = Field(default_factory=dict)
    summary: Optional[str] = None
    verified_telephony: bool = False  # manual log — never claimed as provider-verified
    agent_id: str
    agent_email: str
    idempotency_key: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------- service cases

class ServiceCase(BaseModel):
    id: str = Field(default_factory=_id)
    case_number: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    category: str = "product_advice"
    subject: str
    body: str
    status: Literal["open", "in_progress", "waiting_customer", "escalated", "resolved", "closed"] = "open"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    assignee_id: Optional[str] = None
    resolution: Optional[str] = None
    trail: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)


class ServiceCaseIn(BaseModel):
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    category: str = "product_advice"
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=4000)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class ServiceCasePatch(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    resolution: Optional[str] = Field(default=None, max_length=2000)
    note: Optional[str] = Field(default=None, max_length=2000)
