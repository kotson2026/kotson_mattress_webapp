"""Pydantic models and schemas for Refer & Earn Module."""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class KYCSubmissionIn(BaseModel):
    pan_number: str = Field(min_length=10, max_length=10)
    pan_name: str = Field(min_length=2, max_length=120)
    pan_doc_url: Optional[str] = None


class BankDetailsIn(BaseModel):
    account_holder_name: str = Field(min_length=2, max_length=120)
    account_number: str = Field(min_length=6, max_length=30)
    confirm_account_number: str = Field(min_length=6, max_length=30)
    ifsc_code: str = Field(min_length=11, max_length=11)
    bank_name: Optional[str] = None
    branch: Optional[str] = None


class VerificationActionIn(BaseModel):
    action: str = Field(..., description="Action to perform: approve, verify, verified, reject, needs_correction")
    reason: Optional[str] = None


class WithdrawalRequestIn(BaseModel):
    amount: float = Field(gt=0)


class WithdrawalActionIn(BaseModel):
    utr_number: str = Field(min_length=4, max_length=50)
    payment_method: str = "NEFT/RTGS"  # NEFT/RTGS | IMPS | UPI
    payment_date: Optional[str] = None
    note: Optional[str] = None


class WithdrawalReviewIn(BaseModel):
    action: Literal["approve", "hold", "reject", "APPROVE", "HOLD", "REJECT"]
    reason: Optional[str] = None
    review_date: Optional[str] = None


class TaxSettingsIn(BaseModel):
    tds_enabled: bool = True
    payment_nature: str = "Commission / Brokerage - Section 393, Income-tax Act 2025"
    pan_available_rate: float = Field(ge=0, le=100, default=5.0)
    pan_not_available_rate: float = Field(ge=0, le=100, default=20.0)
    applicable_threshold: float = Field(ge=0, default=15000.0)
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    notes: Optional[str] = None


class CommissionRuleIn(BaseModel):
    rule_name: str = Field(min_length=2, max_length=100)
    reward_type: Literal["PERCENTAGE", "FIXED"] = "PERCENTAGE"
    value: float = Field(gt=0)
    min_order_value: float = Field(ge=0, default=0.0)
    product_id: Optional[str] = None  # None indicates Global Tier
    first_order_only: bool = False
    is_active: bool = True
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    notes: Optional[str] = None


class ProductReferralRuleIn(BaseModel):
    rule_name: str = Field(min_length=2, max_length=120)
    product_ids: List[str] = Field(min_length=1)

    # Referrer Commission
    commission_type: Literal["PERCENTAGE", "FLAT", "FIXED"] = "PERCENTAGE"
    commission_value: float = Field(gt=0)
    commission_basis: Literal["selling_price", "net_price"] = "selling_price"
    commission_calc_type: Literal["per_unit", "per_line"] = "per_unit"

    # Customer Referral Discount
    discount_type: Literal["PERCENTAGE", "FLAT", "FIXED"] = "PERCENTAGE"
    discount_value: float = Field(ge=0)
    discount_calc_type: Literal["per_unit", "per_line"] = "per_unit"

    is_active: bool = True
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    notes: Optional[str] = None


class BulkRuleActionIn(BaseModel):
    rule_ids: List[str] = Field(min_length=1)
    action: Literal["activate", "deactivate", "delete"]


class ReferralSettingsIn(BaseModel):
    allow_promotion_stacking: bool = True
    promotion_stacking_mode: Literal["combine", "better_discount", "exclusive"] = "combine"
    coupon_stacking_mode: Literal["allow", "disallow", "better_discount"] = "disallow"
    commission_price_basis: Literal["selling_price", "net_price"] = "selling_price"
    flat_quantity_semantics: Literal["per_unit", "per_line"] = "per_unit"
    allow_self_referral: bool = False
    attribution_ttl_days: int = 90
    attribution_policy: Literal["first_touch", "last_touch"] = "first_touch"


class ReferralClickIn(BaseModel):
    code: str
    path: Optional[str] = "/"


class ReferralValidateIn(BaseModel):
    code: str


class PaymentCancelIn(BaseModel):
    order_id: str
    order_number: Optional[str] = None
    cart_token: Optional[str] = None
    reason: Optional[str] = "User closed/dismissed payment modal"

