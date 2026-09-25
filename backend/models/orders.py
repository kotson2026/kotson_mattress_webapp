"""Cart, checkout and order models. Immutable snapshots after payment."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from models.users import AddressIn, utcnow


class CartItemIn(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=10)


class CartItemPatch(BaseModel):
    variant_id: str
    qty: int = Field(ge=0, le=10)  # 0 removes the line


class ReferralApplyIn(BaseModel):
    code: Optional[str] = Field(default=None, max_length=32)


class CartLine(BaseModel):
    variant_id: str
    product_id: str
    product_slug: str
    product_name: str
    sku: str
    size: str
    length: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    qty: int
    unit_price: int  # paise, recalculated server-side every read (selling price)
    line_total: int  # unit_price * qty
    mrp: Optional[int] = None  # paise, authoritative original MRP
    discount_amount: Optional[int] = 0
    discount_percent: Optional[float] = 0.0
    stock: int
    free_stock: int
    is_active: bool
    image: Optional[str] = None


class MoneyLine(BaseModel):
    label: str
    amount: int = 0  # paise
    status: str = "final"  # final | pending_configuration | not_applicable


class CartView(BaseModel):
    items: List[CartLine] = []
    item_count: int = 0
    subtotal: int = 0
    total_mrp: Optional[int] = 0
    total_discount: Optional[int] = 0
    referred_code: Optional[str] = None
    referral_status: str = "none"  # none | valid | invalid | self | no_published_rule
    referral_discount: int = 0
    referral_note: str = ""


class OrderItemSnapshot(BaseModel):
    variant_id: str
    product_id: str
    product_slug: str
    product_name: str
    sku: str
    size: str
    length: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    qty: int
    unit_price: int
    line_total: int
    mrp: Optional[int] = None
    discount_amount: Optional[int] = 0
    discount_percent: Optional[float] = 0.0


class OrderEvent(BaseModel):
    at: datetime = Field(default_factory=utcnow)
    type: str
    detail: str = ""
    actor: str = "system"


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    user_id: Optional[str] = None
    email: str
    guest_access_token: Optional[str] = None
    channel: str = "retail"  # retail | dealer
    buyer_type: str = "CUSTOMER"  # CUSTOMER | DEALER
    order_source: str = "DIRECT_WEBSITE"  # DIRECT_WEBSITE | WEB_REFERRAL | DEALER | EMPLOYEE_ASSISTED | WALK_IN | MANUAL_OTHER
    sales_source: str = "DIRECT_WEBSITE"  # DIRECT_WEBSITE | CRM | DEALER | REFERRAL | WALK_IN | MANUAL_OTHER
    crm_lead_id: Optional[str] = None
    crm_employee_id: Optional[str] = None
    crm_manager_id: Optional[str] = None
    crm_pipeline_id: Optional[str] = None
    crm_campaign_id: Optional[str] = None
    order_channel: str = "WEBSITE"  # WEBSITE | ADMIN_MANUAL
    sale_date: datetime = Field(default_factory=utcnow)
    employee_id: Optional[str] = None
    dealer_id: Optional[str] = None
    source_note: Optional[str] = None
    payment_verification_source: str = "PAYMENT_GATEWAY"  # PAYMENT_GATEWAY | ADMIN_RECORDED
    manual_payment_ref: Optional[str] = None
    manual_payment_remarks: Optional[str] = None
    items: List[OrderItemSnapshot] = []
    address: dict = {}
    amounts: dict = {}  # subtotal, discount, tax, tax_status, shipping, shipping_status, total (paise)
    payment_status: str = "pending"  # pending | paid | failed | refunded
    fulfilment_status: str = "awaiting_payment"  # awaiting_payment | processing | ready_for_dispatch | dispatched | shipped | out_for_delivery | delivered | cancelled | returned | refunded
    reservation_status: str = "active"
    referral_code: Optional[str] = None
    referred_by_user_id: Optional[str] = None
    razorpay: dict = {}
    events: List[OrderEvent] = []
    created_at: datetime = Field(default_factory=utcnow)


class CheckoutStartIn(BaseModel):
    address: AddressIn
    referral_code: Optional[str] = Field(default=None, max_length=32)
    guest_access: bool = True


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ManualSaleItemIn(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=100)
    unit_price: int = Field(ge=0)  # paise
    discount: int = Field(default=0, ge=0)  # paise


class ManualSaleIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=20)
    email: Optional[str] = None
    order_source: str = Field(default="WALK_IN")
    employee_id: Optional[str] = None
    dealer_id: Optional[str] = None
    source_note: Optional[str] = None
    items: List[ManualSaleItemIn] = Field(min_length=1)
    payment_method: str = Field(default="cash")
    payment_status: str = Field(default="paid")
    manual_payment_ref: Optional[str] = None
    amount_received: Optional[int] = None
    payment_remarks: Optional[str] = None
    payment_date: Optional[datetime] = None
    address: dict = Field(default_factory=dict)
    sale_date: Optional[datetime] = None

