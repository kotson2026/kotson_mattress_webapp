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


class DimensionRule(BaseModel):
    min: float = 30.0
    max: float = 84.0
    step: float = 1.0
    allowed_values: Optional[List[float]] = None


class CustomizationOptionValue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    display_label: str = ""
    image: str = ""
    description: str = ""
    additional_price: int = 0  # paise
    enabled: bool = True
    sort_order: int = 0


class CustomizationOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str  # e.g. "Cover Material", "Firmness"
    display_label: str = ""
    required: bool = True
    enabled: bool = True
    sort_order: int = 0
    values: List[CustomizationOptionValue] = []


class CustomPricingRule(BaseModel):
    pricing_mode: str = "quote_pending"  # "quote_pending" | "formula" | "base_variant_ratio"
    base_rate_per_sq_inch_paise: int = 0
    thickness_multiplier: float = 1.0
    min_price_paise: Optional[int] = None
    promotion_eligible: bool = False


class ProductCustomizationConfig(BaseModel):
    enabled: bool = False
    unit: str = "inch"  # "inch" | "cm"
    dimensions: Dict[str, DimensionRule] = {}
    options: List[CustomizationOption] = []
    pricing: CustomPricingRule = Field(default_factory=CustomPricingRule)


class ProductStoryFeature(BaseModel):
    icon: Optional[str] = None
    title: str = ""
    description: str = ""


class ProductStorySection(BaseModel):
    enabled: bool = True
    eyebrow: Optional[str] = None
    heading: Optional[str] = None
    description: Optional[str] = None
    features: List[ProductStoryFeature] = []


class ProductSuitabilityItem(BaseModel):
    label: str = ""
    value: str = ""
    icon: Optional[str] = None


class ProductLifestyleSection(BaseModel):
    enabled: bool = True
    image_url: Optional[str] = None
    eyebrow: Optional[str] = None
    heading: Optional[str] = None
    description: Optional[str] = None
    suitability_items: List[ProductSuitabilityItem] = []
    bullet_features: List[str] = []


class ProductConstructionLayer(BaseModel):
    order: int = 1
    name: str = ""
    description: str = ""
    icon: Optional[str] = None
    image_url: Optional[str] = None


class ProductConstructionSection(BaseModel):
    enabled: bool = True
    eyebrow: Optional[str] = "WHAT'S INSIDE?"
    heading: Optional[str] = "What's Inside"
    description: Optional[str] = None
    image_url: Optional[str] = None
    layers: List[ProductConstructionLayer] = []


class ProductFitGuideItem(BaseModel):
    name: str = ""
    subtitle: Optional[str] = None
    dimensions: Optional[str] = None
    specs: Optional[str] = None
    link_slug: Optional[str] = None


class ProductFitGuideSection(BaseModel):
    enabled: bool = False
    eyebrow: Optional[str] = "FIND THE RIGHT FIT"
    heading: Optional[str] = "Find the Right Fit"
    description: Optional[str] = None
    items: List[ProductFitGuideItem] = []


class ProductStorytellingConfig(BaseModel):
    story: Optional[ProductStorySection] = None
    lifestyle: Optional[ProductLifestyleSection] = None
    construction: Optional[ProductConstructionSection] = None
    fit_guide: Optional[ProductFitGuideSection] = None
    certification_ids: List[str] = []


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
    customization: Optional[ProductCustomizationConfig] = None
    storytelling: Optional[ProductStorytellingConfig] = None
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
    customization: Optional[ProductCustomizationConfig] = None
    storytelling: Optional[ProductStorytellingConfig] = None
    variants: Optional[List[VariantIn]] = None


class InventoryAdjustIn(BaseModel):
    variant_id: str
    delta: int  # +n restock / -n shrinkage
    reason: str = Field(min_length=3, max_length=300)
