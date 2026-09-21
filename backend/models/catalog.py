"""Catalog models: categories, products, variants (money = integer paise)."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from models.users import utcnow


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    description: str = ""
    image_slot: str = ""
    sort: int = 0
    is_active: bool = True


class Variant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    sku: str
    size: str
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    price: int  # paise
    mrp: Optional[int] = None  # paise
    stock: int = 0
    reserved: int = 0
    is_active: bool = True


class VariantOut(Variant):
    free_stock: int = 0


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    tagline: str = ""
    description: str = ""
    category_slug: str
    badge: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    trial_days: Optional[int] = None
    warranty_years: Optional[int] = None
    images: List[str] = []
    is_seed: bool = False
    is_active: bool = True
    sort: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class ProductOut(Product):
    variants: List[VariantOut] = []
    price_from: Optional[int] = None
    in_stock: bool = False


class ProductUpsertIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=160)
    tagline: str = ""
    description: str = ""
    category_slug: str
    badge: Optional[str] = None
    trial_days: Optional[int] = None
    warranty_years: Optional[int] = None
    is_active: bool = True


class VariantIn(BaseModel):
    sku: str = Field(min_length=3, max_length=48)
    size: str = Field(min_length=1, max_length=60)
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    price: int = Field(gt=0)  # paise, authoritative server-side
    mrp: Optional[int] = None
    stock: int = Field(ge=0, default=0)


class InventoryAdjustIn(BaseModel):
    variant_id: str
    delta: int  # +n restock / -n shrinkage
    reason: str = Field(min_length=3, max_length=300)
