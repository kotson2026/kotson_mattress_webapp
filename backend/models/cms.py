"""CMS models for dynamic pages, sections, navigation, footer, branding, and publication versions."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from models.users import utcnow


class CMSSection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # hero_video, announcement_bar, category_grid, shark_tank_feature, mattress_layer_breakdown, seven_zones_support, organic_latex_process, certifications_badges, testimonials_slider, cta_banner, etc.
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    asset_id: Optional[str] = None
    order: int = 0
    is_visible: bool = True
    config: Dict[str, Any] = {}


class CMSPage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    title: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    status: str = "published"  # published | draft
    page_type: str = "content"  # content | system | commerce
    sections: List[CMSSection] = []
    is_system_page: bool = False  # home, collections, about, contact, track-order
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CMSPageCreate(BaseModel):
    slug: str
    title: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    status: Optional[str] = "draft"
    page_type: Optional[str] = "content"
    is_system_page: Optional[bool] = False
    sections: Optional[List[CMSSection]] = []


class CMSPageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    status: Optional[str] = None
    sections: Optional[List[CMSSection]] = None


class CMSNavItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    href: str
    order: int = 0
    is_visible: bool = True
    badge: Optional[str] = None
    children: List[Dict[str, Any]] = []


class HeaderConfig(BaseModel):
    announcement_enabled: bool = True
    announcement_text: str = "Sleep Better Tonight — Get 100 Nights Risk-Free Trial + Free Shipping Pan India"
    announcement_link: Optional[str] = "/collections/mattresses"
    phone_hotline: str = "+91 98765 43210"
    nav_items: List[CMSNavItem] = []
    show_search: bool = True
    show_cart: bool = True


class FooterColumn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    links: List[Dict[str, str]] = []  # [{"label": "Mattresses", "href": "/collections/mattresses"}]


CMSFooterBlock = FooterColumn


class FooterConfig(BaseModel):
    tagline: str = "Ergonomically engineered for deep sleep and spinal alignment."
    columns: List[FooterColumn] = []
    social_links: Dict[str, str] = {
        "instagram": "https://instagram.com/kotsonmattress",
        "facebook": "https://facebook.com/kotsonmattress",
        "youtube": "https://youtube.com/@kotsonmattress",
        "linkedin": "https://linkedin.com/company/kotsonmattress"
    }
    copyright_text: str = "© 2026 Kotson Mattress Co. All rights reserved."
    show_trust_badges: bool = True
    show_newsletter: bool = True


class BrandingConfig(BaseModel):
    main_logo_url: str = "/logo.png"
    light_logo_url: Optional[str] = "/logo-light.png"
    dark_logo_url: Optional[str] = "/logo-dark.png"
    favicon_url: Optional[str] = "/favicon.ico"
    og_image_url: Optional[str] = "/og-image.jpg"
    primary_color: str = "#16241C"
    accent_color: str = "#C69249"
    background_color: str = "#FAF8F5"
    history: List[Dict[str, Any]] = []
