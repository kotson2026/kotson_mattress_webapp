"""Models and schemas for Custom Product Requests (Bespoke/Customized Mattresses & Bedding)."""

from typing import Optional, Literal, Union
from pydantic import BaseModel, Field


class CustomProductRequestIn(BaseModel):
    product_id: str
    product_name_snapshot: str = Field(min_length=2, max_length=150)
    product_slug: str
    category: Optional[str] = None
    product_image: Optional[str] = None

    size_mode: Literal["custom", "standard"] = "custom"
    standard_variant_id: Optional[str] = None
    standard_size_label: Optional[str] = None

    length: Union[float, int, str]
    breadth: Union[float, int, str]
    height_or_thickness: Union[float, int, str]
    measurement_unit: str = "inch"

    customer_name: str = Field(min_length=2, max_length=100)
    mobile: str = Field(min_length=10, max_length=15)
    email: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    customer_remarks: Optional[str] = None


class CustomRequestUpdateIn(BaseModel):
    status: Optional[str] = None  # NEW | UNDER_REVIEW | CONTACTED | QUOTE_PROVIDED | CONVERTED | CLOSED | CANCELLED
    assigned_to_user_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    internal_remarks: Optional[str] = None
    quoted_price: Optional[float] = None
    quote_notes: Optional[str] = None
