"""Asset Library models."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from models.users import utcnow


class AssetCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    url: str
    category: str = "Product Media"  # Logos | Homepage | Navigation | Product Media | Banners | Videos | Certifications | Trust | Icons | Dealer Assets | Referral Assets | Other
    dimensions: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_kb: Optional[float] = None
    file_type: Optional[str] = "image/webp"
    alt_text: Optional[str] = None
    tags: List[str] = []
    is_test_data: bool = False


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    alt_text: Optional[str] = None
    tags: Optional[List[str]] = None
    url: Optional[str] = None
    dimensions: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_kb: Optional[float] = None


class AssetOut(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    url: str
    category: str = "Other"
    dimensions: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_kb: Optional[float] = None
    file_type: Optional[str] = None
    alt_text: Optional[str] = None
    tags: List[str] = []
    used_in_count: int = 0
    is_test_data: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
