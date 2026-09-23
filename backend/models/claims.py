"""Models for Claims & Trust Hub: Certifications and Tested Claims."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from models.users import utcnow


class CertificationCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    issuer: str = Field(min_length=2, max_length=150)
    cert_number: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    badge_image_url: Optional[str] = None
    file_url: Optional[str] = None
    verification_url: Optional[str] = None
    applicable_products: List[str] = ["ALL"]
    display_order: int = 0
    is_visible: bool = True
    status: str = "VERIFIED"  # VERIFIED | PENDING_RENEWAL | EXPIRED | DRAFT
    is_test_data: bool = False


class CertificationUpdate(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    cert_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    badge_image_url: Optional[str] = None
    file_url: Optional[str] = None
    verification_url: Optional[str] = None
    applicable_products: Optional[List[str]] = None
    display_order: Optional[int] = None
    is_visible: Optional[bool] = None
    status: Optional[str] = None


class ClaimCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    metric_proof: str
    category: str = "Materials"  # Materials | Ergonomics | Durability | Trial & Warranty | Safety
    applicable_products: List[str] = ["ALL"]
    evidence_doc_url: Optional[str] = None
    verification_status: str = "VERIFIED"  # VERIFIED | DRAFT | EXPIRED | HIDDEN
    verification_notes: Optional[str] = None
    display_order: int = 0
    is_visible: bool = True
    is_test_data: bool = False


class ClaimUpdate(BaseModel):
    title: Optional[str] = None
    metric_proof: Optional[str] = None
    category: Optional[str] = None
    applicable_products: Optional[List[str]] = None
    evidence_doc_url: Optional[str] = None
    verification_status: Optional[str] = None
    verification_notes: Optional[str] = None
    display_order: Optional[int] = None
    is_visible: Optional[bool] = None
