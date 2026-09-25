"""Catalog models: categories, products, variants (money = integer paise)."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from models.users import utcnow


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    description: str = ""
    image_url: str = ""
    image_slot: str = ""
    sort: int = 0
    product_count: int = 0
    is_active: bool = True
    is_hidden: bool = False
    is_archived: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class CategoryIn(BaseModel):
    slug: Optional[str] = None
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    image_url: str = ""
    sort: int = 0
    is_active: bool = True


class Variant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    sku: str
    size: str
    length: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    price: int  # paise, authoritative selling price
    mrp: Optional[int] = None  # paise
    stock: int = 0
    reserved: int = 0
    weight_kg: Optional[float] = None
    is_active: bool = True
    status: str = "ACTIVE"  # ACTIVE | PAUSED | DISCONTINUED
    referral_reward: Optional[Dict[str, Any]] = None  # type: percent/fixed, value
    dealer_share: Optional[Dict[str, Any]] = None  # type: percent/fixed, value


class VariantOut(Variant):
    free_stock: int = 0
    discount_amount: Optional[int] = 0
    discount_percent: Optional[float] = 0.0


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    tagline: str = ""
    short_description: str = ""
    description: str = ""
    category_slug: str
    subcategory: Optional[str] = None
    sku: Optional[str] = None
    brand: str = "Kotson Naturals"
    material: str = "100% Botanical Natural Latex"
    product_type: str = "Mattress"
    status: str = "ACTIVE"  # ACTIVE | PAUSED | ARCHIVED
    website_visibility: str = "VISIBLE"  # VISIBLE | HIDDEN
    badge: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    trial_days: Optional[int] = None
    warranty_years: Optional[int] = None
    return_eligibility: bool = True
    cta_button_name: str = "Shop Now"
    images: List[str] = []
    primary_image: Optional[str] = None
    videos: List[str] = []
    tags: List[str] = []
    features: List[str] = []
    specifications: Dict[str, str] = {}
    care_instructions: str = ""
    seo: Dict[str, str] = {}
    is_featured: bool = False
    is_new_arrival: bool = False
    is_best_seller: bool = False
    show_mrp: bool = True
    show_discount: bool = True
    display_order: int = 0
    referral_reward: Optional[Dict[str, Any]] = None
    dealer_pricing: Optional[Dict[str, Any]] = None
    is_seed: bool = False
    is_active: bool = True
    sort: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = None


class ProductOut(Product):
    variants: List[VariantOut] = []
    price_from: Optional[int] = None
    mrp_from: Optional[int] = None
    discount_percent: Optional[float] = 0.0
    in_stock: bool = False
    total_stock: int = 0


class VariantIn(BaseModel):
    id: Optional[str] = None
    sku: str = Field(min_length=3, max_length=48)
    size: str = Field(min_length=1, max_length=60)
    length: Optional[str] = None
    width: Optional[str] = None
    thickness: Optional[str] = None
    firmness: Optional[str] = None
    price: int = Field(gt=0)  # paise, authoritative server-side
    mrp: Optional[int] = None
    stock: int = Field(ge=0, default=0)
    weight_kg: Optional[float] = None
    status: str = "ACTIVE"
    referral_reward: Optional[Dict[str, Any]] = None
    dealer_share: Optional[Dict[str, Any]] = None


class ProductUpsertIn(BaseModel):
    slug: Optional[str] = None
    name: str = Field(min_length=2, max_length=160)
    tagline: str = ""
    short_description: str = ""
    description: str = ""
    category_slug: str
    subcategory: Optional[str] = None
    sku: Optional[str] = None
    brand: str = "Kotson Naturals"
    material: str = "100% Botanical Natural Latex"
    product_type: str = "Mattress"
    status: str = "ACTIVE"
    website_visibility: str = "VISIBLE"
    badge: Optional[str] = None
    trial_days: Optional[int] = None
    warranty_years: Optional[int] = None
    return_eligibility: bool = True
    cta_button_name: str = "Shop Now"
    images: List[str] = []
    videos: List[str] = []
    tags: List[str] = []
    features: List[str] = []
    specifications: Dict[str, str] = {}
    care_instructions: str = ""
    seo: Dict[str, str] = {}
    is_featured: bool = False
    is_new_arrival: bool = False
    is_best_seller: bool = False
    show_mrp: bool = True
    show_discount: bool = True
    display_order: int = 0
    referral_reward: Optional[Dict[str, Any]] = None
    dealer_pricing: Optional[Dict[str, Any]] = None
    is_active: bool = True
    variants: Optional[List[VariantIn]] = None


class InventoryAdjustIn(BaseModel):
    variant_id: str
    delta: int  # +n restock / -n shrinkage
    reason: str = Field(min_length=3, max_length=300)
