"""CMS content blocks, trust claims, assets, settings, CRM, dealer, referral models."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from models.users import utcnow


class CMSBlock(BaseModel):
    key: str
    page: str = "home"
    label: str = ""
    type: str = "text"  # text | json | richtext
    value: str = ""
    status: str = "draft"  # draft | published
    updated_at: datetime = Field(default_factory=utcnow)
    revisions: List[dict] = []


class CMSBlockUpdate(BaseModel):
    value: str


class Claim(BaseModel):
    key: str
    label: str
    body: str = ""
    status: str = "draft"  # draft | published
    evidence_status: str = "pending"  # pending | approved
    evidence_url: str = ""
    applies_to: str = "site"  # site | product:<slug>
    conditions: str = ""


class ClaimUpdate(BaseModel):
    body: Optional[str] = None
    status: Optional[str] = None
    evidence_url: Optional[str] = None
    evidence_status: Optional[str] = None
    applies_to: Optional[str] = None
    conditions: Optional[str] = None


class AssetSlot(BaseModel):
    slot: str
    section: str = ""
    alt_text: str = ""
    file_url: str = ""
    status: str = "placeholder"  # placeholder | published
    attribution: str = ""
    crop_desktop: str = ""
    crop_mobile: str = ""


class AssetUpdate(BaseModel):
    alt_text: Optional[str] = None
    file_url: Optional[str] = None
    status: Optional[str] = None
    attribution: Optional[str] = None
    crop_desktop: Optional[str] = None
    crop_mobile: Optional[str] = None


class SettingsOut(BaseModel):
    company_name: str = "KOTSON NATURALS PRIVATE LIMITED"
    support_email: str = ""
    support_phone: str = ""
    address: str = ""
    gst_rate: Optional[float] = None  # never inferred — owner sets explicitly
    gst_status: str = "pending_configuration"
    shipping_flat_paise: Optional[int] = None
    shipping_status: str = "pending_configuration"
    free_shipping_enabled: bool = False
    razorpay_state: str = "pending_keys"
    mail_state: str = "pending_provider"
    analytics_consent: str = "not_configured"


class SettingsUpdate(BaseModel):
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    address: Optional[str] = None
    gst_rate: Optional[float] = None
    shipping_flat_paise: Optional[int] = None
    free_shipping_enabled: Optional[bool] = None


class InquiryNote(BaseModel):
    at: datetime = Field(default_factory=utcnow)
    author_id: str
    author_email: str
    body: str


class Inquiry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    subject: str
    message: str
    issue_type: str = "general"  # general | order | product | dealer | referral
    status: str = "open"  # open | in_progress | resolved
    priority: str = "normal"  # low | normal | high
    assignee_id: Optional[str] = None
    notes: List[InquiryNote] = []
    created_at: datetime = Field(default_factory=utcnow)


class InquiryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    phone: Optional[str] = None
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)
    issue_type: str = "general"


class InquiryPatch(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    note: Optional[str] = None


class CRMNoteIn(BaseModel):
    body: str = Field(min_length=2, max_length=2000)


class DealerApplyIn(BaseModel):
    org_name: str = Field(min_length=2, max_length=160)
    gstin: str = Field(min_length=10, max_length=20)
    territory: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=10, max_length=15)


class DealerOut(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_name: str
    gstin: str = ""
    territory: str = ""
    phone: str = ""
    status: str = "pending"  # pending | approved | rejected
    terms_status: str = "pending_configuration"  # margins/credit never assumed
    created_at: datetime = Field(default_factory=utcnow)


class DealerAdminPatch(BaseModel):
    status: Optional[str] = None
    territory: Optional[str] = None
    terms_status: Optional[str] = None


class DealerOrderItemIn(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=500)


class DealerOrderIn(BaseModel):
    items: List[DealerOrderItemIn] = Field(min_length=1)
    note: str = ""


class ReferralRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    reward_type: str = "referee_discount"  # referee_discount | referrer_reward
    value_type: str = "percent"  # percent | fixed
    value: int = 0  # percent (0-100) or paise
    min_spend_paise: int = 0
    first_order_only: bool = True
    status: str = "draft"  # draft | published — nothing is promised until published
    attribution_window_days: int = 30
    created_at: datetime = Field(default_factory=utcnow)


class ReferralRuleIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    reward_type: str = "referee_discount"
    value_type: str = "percent"
    value: int = Field(ge=0)
    min_spend_paise: int = Field(ge=0, default=0)
    first_order_only: bool = True
    attribution_window_days: int = Field(ge=1, le=365, default=30)


class ReferralRulePatch(BaseModel):
    status: Optional[str] = None


class AffiliateProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    status: str = "applied"  # applied | approved | rejected
    campaign_status: str = "pending_configuration"  # owner configures economics
    created_at: datetime = Field(default_factory=utcnow)
