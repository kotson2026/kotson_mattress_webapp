"""Blog models for Kotson Owner Admin CMS and public storefront."""

from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, Field

from models.users import utcnow


class BlogImage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    alt_text: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class BlogCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = ""
    content_markdown: Optional[str] = ""
    conclusion_markdown: Optional[str] = ""
    cover_image: Optional[str] = ""
    content_images: List[BlogImage] = []
    conclusion_images: List[BlogImage] = []
    seo_title: Optional[str] = ""
    seo_description: Optional[str] = ""
    keywords: List[str] = []
    tags: List[str] = []
    status: str = "draft"  # draft, published, scheduled, archived
    scheduled_at: Optional[datetime] = None


class BlogUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content_markdown: Optional[str] = None
    conclusion_markdown: Optional[str] = None
    cover_image: Optional[str] = None
    content_images: Optional[List[BlogImage]] = None
    conclusion_images: Optional[List[BlogImage]] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    keywords: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class BlogOut(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: str
    content_markdown: str
    conclusion_markdown: str
    cover_image: Optional[str] = None
    content_images: List[BlogImage] = []
    conclusion_images: List[BlogImage] = []
    seo_title: str
    seo_description: str
    keywords: List[str] = []
    tags: List[str] = []
    status: str
    author_id: str
    author_name: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None


class BlogListOut(BaseModel):
    items: List[BlogOut]
    total: int
    page: int
    limit: int
