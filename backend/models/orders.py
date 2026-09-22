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
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    qty: int
    unit_price: int  # paise, recalculated server-side every read
    line_total: int
    stock: int
    free_stock: int
    is_active: bool


class MoneyLine(BaseModel):
    label: str
    amount: int = 0  # paise
    status: str = "final"  # final | pending_configuration | not_applicable


class CartView(BaseModel):
    items: List[CartLine] = []
    item_count: int = 0
    subtotal: int = 0
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
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    qty: int
    unit_price: int
    line_total: int


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
    items: List[OrderItemSnapshot] = []
    address: dict = {}
    amounts: dict = {}  # subtotal, discount, tax, tax_status, shipping, shipping_status, total (paise)
    payment_status: str = "pending"  # pending | paid | failed | refunded
    fulfilment_status: str = "awaiting_payment"  # awaiting_payment | processing | shipped | delivered | cancelled
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
