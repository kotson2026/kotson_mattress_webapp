"""Custom Product Requests (Bespoke/Customized Mattresses & Bedding) Router.

Workflow:
Customer selects product -> Enters custom/standard dimensions -> Previews -> Submits request.
Creates persistent request ticket KT-CUSTOM-XXXXXX for Owner Admin / Manager review,
measurement verification, customer follow-up, and quoting.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from lib.security import require_role, optional_user, OWNER, ADMIN, MANAGER, audit, now_utc
from lib.db import db
from lib.services import clean_doc
from models.custom_requests import CustomProductRequestIn, CustomRequestUpdateIn

logger = logging.getLogger(__name__)

router = APIRouter(tags=["custom-requests"])

TZ_IST = ZoneInfo("Asia/Kolkata")


def format_ist_dt(dt_val) -> str:
    """Format datetime or ISO string into human readable IST: '28 Sep 2026, 01:10 PM'."""
    if not dt_val:
        return "—"
    try:
        if isinstance(dt_val, datetime):
            dt = dt_val
        elif isinstance(dt_val, str):
            s = dt_val.strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            dt = datetime.fromisoformat(s)
        else:
            return str(dt_val)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        ist_dt = dt.astimezone(TZ_IST)
        return ist_dt.strftime("%d %b %Y, %I:%M %p")
    except Exception:
        return str(dt_val)


async def _next_seq(counter: str, prefix: str, width: int = 6) -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": counter}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"{prefix}{doc['seq']:0{width}d}"


# =============================================================================
# 1. PUBLIC: SUBMIT CUSTOM PRODUCT REQUEST
# =============================================================================

@router.post("/custom-requests")
async def submit_custom_request(
    payload: CustomProductRequestIn,
    user=Depends(optional_user),
):
    """Public customer endpoint to submit a customized product quotation request.
    Creates an authoritative persistent ticket with a unique KT-CUSTOM-XXXXXX number.
    """
    # 1. Generate unique server-authoritative request number
    req_number = await _next_seq("custom_product_request", "KT-CUSTOM-", 6)
    req_id = f"cpr_{uuid.uuid4().hex[:14]}"

    customer_id = user["id"] if user else None
    user_email = user.get("email") if user else payload.email

    created_iso = now_utc().isoformat()

    doc = {
        "id": req_id,
        "request_number": req_number,
        "customer_id": customer_id,
        "customer_name": payload.customer_name.strip(),
        "mobile": payload.mobile.strip(),
        "email": (payload.email or user_email or "").strip(),
        "city": (payload.city or "").strip(),
        "pincode": (payload.pincode or "").strip(),
        "product_id": payload.product_id,
        "product_name_snapshot": payload.product_name_snapshot.strip(),
        "product_slug": payload.product_slug,
        "category": payload.category,
        "product_image": payload.product_image,
        "size_mode": payload.size_mode,
        "standard_variant_id": payload.standard_variant_id,
        "standard_size_label": payload.standard_size_label,
        "length": str(payload.length),
        "breadth": str(payload.breadth),
        "height_or_thickness": str(payload.height_or_thickness),
        "measurement_unit": payload.measurement_unit or "inch",
        "status": "NEW",
        "assigned_to_user_id": None,
        "assigned_to_name": None,
        "customer_remarks": (payload.customer_remarks or "").strip(),
        "internal_remarks": None,
        "quoted_price": None,
        "quote_notes": None,
        "quote_date": None,
        "created_at": created_iso,
        "updated_at": created_iso,
    }

    await db.custom_product_requests.insert_one(doc)

    # Log audit entry
    await audit(
        user if user else {"email": payload.email or payload.mobile, "roles": ["customer"]},
        "custom_request.submitted",
        "custom_product_request",
        req_id,
        f"Custom request {req_number} submitted for {payload.product_name_snapshot} ({payload.length}×{payload.breadth}×{payload.height_or_thickness} in)"
    )

    logger.info("Created custom product request %s (%s) for %s", req_number, req_id, payload.customer_name)

    return {
        "success": True,
        "request_id": req_id,
        "request_number": req_number,
        "status": "NEW",
        "created_at": created_iso,
        "formatted_date": format_ist_dt(created_iso),
        "message": "Custom request submitted successfully.",
    }


# =============================================================================
# 2. OWNER ADMIN & MANAGER: LIST & FILTER CUSTOM REQUESTS
# =============================================================================

@router.get("/admin/custom-requests")
async def list_custom_requests(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """Admin and Manager operational table of custom product quotation requests.
    Includes authoritative counters for: New Requests, Under Review, Contacted, Quote Provided, Converted.
    """
    user_roles = user.get("roles", [])
    is_manager = MANAGER in user_roles and OWNER not in user_roles and ADMIN not in user_roles

    query: dict = {}

    # Managers only see requests assigned to them (or unassigned/new ones they can claim)
    if is_manager:
        query["$or"] = [
            {"assigned_to_user_id": user["id"]},
            {"assigned_to_user_id": None},
        ]

    # Status filter
    if status and status.upper() != "ALL":
        query["status"] = status.upper()

    # Search filter: customer name, mobile, request number, product name
    if q and q.strip():
        search_term = q.strip()
        query["$or"] = [
            {"request_number": {"$regex": search_term, "$options": "i"}},
            {"customer_name": {"$regex": search_term, "$options": "i"}},
            {"mobile": {"$regex": search_term, "$options": "i"}},
            {"email": {"$regex": search_term, "$options": "i"}},
            {"product_name_snapshot": {"$regex": search_term, "$options": "i"}},
        ]

    # Calculate authoritative top counters
    base_counter_q = {}
    if is_manager:
        base_counter_q["$or"] = [
            {"assigned_to_user_id": user["id"]},
            {"assigned_to_user_id": None},
        ]

    new_count = await db.custom_product_requests.count_documents({**base_counter_q, "status": "NEW"})
    under_review_count = await db.custom_product_requests.count_documents({**base_counter_q, "status": "UNDER_REVIEW"})
    contacted_count = await db.custom_product_requests.count_documents({**base_counter_q, "status": "CONTACTED"})
    quote_provided_count = await db.custom_product_requests.count_documents({**base_counter_q, "status": "QUOTE_PROVIDED"})
    converted_count = await db.custom_product_requests.count_documents({**base_counter_q, "status": "CONVERTED"})
    total_count = await db.custom_product_requests.count_documents(base_counter_q)

    # Fetch paginated items sorted newest first
    skip = (page - 1) * page_size
    cursor = db.custom_product_requests.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    items_raw = await cursor.to_list(page_size)

    total_filtered = await db.custom_product_requests.count_documents(query)

    enriched_items = []
    for item in items_raw:
        enriched_items.append({
            "id": item["id"],
            "request_number": item.get("request_number", item["id"]),
            "customer_name": item.get("customer_name", "Anonymous"),
            "mobile": item.get("mobile", "—"),
            "email": item.get("email"),
            "city": item.get("city"),
            "pincode": item.get("pincode"),
            "product_id": item.get("product_id"),
            "product_name": item.get("product_name_snapshot", "Custom Mattress"),
            "product_slug": item.get("product_slug"),
            "category": item.get("category"),
            "product_image": item.get("product_image"),
            "size_mode": item.get("size_mode", "custom"),
            "standard_size_label": item.get("standard_size_label"),
            "length": item.get("length"),
            "breadth": item.get("breadth"),
            "height_or_thickness": item.get("height_or_thickness"),
            "measurement_unit": item.get("measurement_unit", "in"),
            "dimensions_display": f"{item.get('length')} × {item.get('breadth')} × {item.get('height_or_thickness')} {item.get('measurement_unit', 'in')}",
            "status": item.get("status", "NEW"),
            "assigned_to_user_id": item.get("assigned_to_user_id"),
            "assigned_to_name": item.get("assigned_to_name") or "Unassigned",
            "customer_remarks": item.get("customer_remarks"),
            "internal_remarks": item.get("internal_remarks"),
            "quoted_price": item.get("quoted_price"),
            "quote_notes": item.get("quote_notes"),
            "quote_date": item.get("quote_date"),
            "created_at": item.get("created_at"),
            "formatted_date": format_ist_dt(item.get("created_at")),
            "updated_at": item.get("updated_at"),
        })

    return {
        "items": enriched_items,
        "total": total_filtered,
        "page": page,
        "page_size": page_size,
        "counters": {
            "new_count": new_count,
            "under_review_count": under_review_count,
            "contacted_count": contacted_count,
            "quote_provided_count": quote_provided_count,
            "converted_count": converted_count,
            "total_count": total_count,
        },
    }


# =============================================================================
# 3. OWNER ADMIN & MANAGER: GET REQUEST DETAILS
# =============================================================================

@router.get("/admin/custom-requests/{request_id}")
async def get_custom_request_detail(
    request_id: str,
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """Retrieve full request detail including customer details, dimensions, and quote notes."""
    req = await db.custom_product_requests.find_one({"id": request_id})
    if not req:
        # Try finding by request_number
        req = await db.custom_product_requests.find_one({"request_number": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Custom product request not found")

    cleaned = clean_doc(req)
    cleaned["formatted_date"] = format_ist_dt(cleaned.get("created_at"))
    cleaned["dimensions_display"] = f"{cleaned.get('length')} × {cleaned.get('breadth')} × {cleaned.get('height_or_thickness')} {cleaned.get('measurement_unit', 'in')}"
    return cleaned


# =============================================================================
# 4. OWNER ADMIN & MANAGER: UPDATE REQUEST (STATUS, ASSIGNMENT, QUOTE, REMARKS)
# =============================================================================

@router.patch("/admin/custom-requests/{request_id}")
async def update_custom_request(
    request_id: str,
    payload: CustomRequestUpdateIn,
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """Update status, manager assignment, internal remarks, or quoted price."""
    req = await db.custom_product_requests.find_one({"id": request_id})
    if not req:
        req = await db.custom_product_requests.find_one({"request_number": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Custom product request not found")

    patch: dict = {"updated_at": now_utc()}
    audit_notes = []

    # Status change
    if payload.status:
        valid_statuses = ["NEW", "UNDER_REVIEW", "CONTACTED", "QUOTE_PROVIDED", "CONVERTED", "CLOSED", "CANCELLED"]
        status_upper = payload.status.upper()
        if status_upper not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(valid_statuses)}")
        patch["status"] = status_upper
        audit_notes.append(f"Status changed from {req.get('status')} to {status_upper}")

    # Assignment change
    if payload.assigned_to_user_id is not None:
        patch["assigned_to_user_id"] = payload.assigned_to_user_id
        patch["assigned_to_name"] = payload.assigned_to_name
        audit_notes.append(f"Assigned to {payload.assigned_to_name or 'Unassigned'}")

    # Internal remarks
    if payload.internal_remarks is not None:
        patch["internal_remarks"] = payload.internal_remarks
        audit_notes.append("Updated internal remarks")

    # Quote recording
    if payload.quoted_price is not None:
        patch["quoted_price"] = payload.quoted_price
        patch["quote_notes"] = payload.quote_notes
        patch["quote_date"] = now_utc()
        audit_notes.append(f"Recorded quoted price ₹{payload.quoted_price:,.2f}")

    await db.custom_product_requests.update_one({"id": req["id"]}, {"$set": patch})

    # Log audit
    await audit(
        user,
        "custom_request.updated",
        "custom_product_request",
        req["id"],
        f"Updated {req.get('request_number')}: {'; '.join(audit_notes)}"
    )

    updated = await db.custom_product_requests.find_one({"id": req["id"]})
    cleaned = clean_doc(updated)
    cleaned["formatted_date"] = format_ist_dt(cleaned.get("created_at"))
    return {"success": True, "request": cleaned}
