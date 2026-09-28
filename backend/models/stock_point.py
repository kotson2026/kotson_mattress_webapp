"""Pydantic models for Stock Point inventory management, transactions, and dispatches."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ReceiveStockIn(BaseModel):
    item_type: Literal["CATALOG_VARIANT", "MANUAL_ITEM"] = "CATALOG_VARIANT"
    variant_id: Optional[str] = None
    manual_stock_item_id: Optional[str] = None
    quantity: int = Field(gt=0, description="Quantity received must be at least 1")
    supplier: Optional[str] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    received_date: Optional[datetime] = None


class CreateManualItemIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    category: str = Field(min_length=2, max_length=80)
    size: Optional[str] = ""
    unit: str = Field(default="pieces", max_length=40)
    initial_quantity: int = Field(default=0, ge=0)
    remarks: Optional[str] = ""


class AdjustStockIn(BaseModel):
    item_type: Literal["CATALOG_VARIANT", "MANUAL_ITEM"] = "CATALOG_VARIANT"
    variant_id: Optional[str] = None
    manual_stock_item_id: Optional[str] = None
    correct_quantity: int = Field(ge=0, description="Correct verified physical stock count")
    reason: str = Field(min_length=3, max_length=500, description="Detailed mandatory reason for stock adjustment")


class DispatchItemIn(BaseModel):
    item_type: Literal["CATALOG_VARIANT", "MANUAL_ITEM"] = "CATALOG_VARIANT"
    variant_id: Optional[str] = None
    manual_stock_item_id: Optional[str] = None
    quantity: int = Field(ge=1, description="Quantity to pack/dispatch")


class CreateDispatchIn(BaseModel):
    dispatch_type: Literal["ONLINE_ORDER", "OFFLINE_ORDER", "DEALER", "FRIENDS_INTERNAL", "OTHER"]
    order_id: Optional[str] = None
    reference_number: Optional[str] = None
    package_contents: Optional[str] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None
    items: List[DispatchItemIn] = Field(min_length=1)


class CreateStockManagerIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=6, max_length=128)
