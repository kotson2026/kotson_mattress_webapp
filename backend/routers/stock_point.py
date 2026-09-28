"""Stock Point Inventory & Stock Manager Router.
Authoritative stock point ledger, inventory balances, dispatches, and manager administration.
"""

import io
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from lib.db import db
from lib.security import (
    ADMIN,
    OWNER,
    STOCK_POINT_MANAGER,
    STOCK_POINT_ROLES,
    audit,
    hash_password,
    normalize_email,
    now_utc,
    require_role,
)
from lib.services import clean_doc
from models.stock_point import (
    AdjustStockIn,
    CreateDispatchIn,
    CreateManualItemIn,
    CreateStockManagerIn,
    ReceiveStockIn,
    utcnow,
)

router = APIRouter(prefix="/stock-point", tags=["stock-point"])

TZ_IST = ZoneInfo("Asia/Kolkata")


def format_ist(dt: Optional[datetime]) -> tuple[str, str, str]:
    """Returns (date_str, time_str, full_str) formatted in IST: e.g. ('28 Sep 2026', '04:42 PM', '28 Sep 2026, 04:42 PM')."""
    if not dt:
        return ("", "", "")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(TZ_IST)
    date_str = ist_dt.strftime("%d %b %Y")
    time_str = ist_dt.strftime("%I:%M %p")
    full_str = f"{date_str}, {time_str}"
    return (date_str, time_str, full_str)


def parse_date_range(preset: str = "all", date_from: Optional[str] = None, date_to: Optional[str] = None):
    now_local = datetime.now(TZ_IST)
    today_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    if preset == "today":
        start = today_start.astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
        return start, end
    elif preset == "yesterday":
        start = (today_start - timedelta(days=1)).astimezone(timezone.utc)
        end = (today_start - timedelta(microseconds=1)).astimezone(timezone.utc)
        return start, end
    elif preset in ("week", "last_7_days"):
        start = (today_start - timedelta(days=6)).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
        return start, end
    elif preset in ("month", "last_30_days"):
        start = (today_start - timedelta(days=29)).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
        return start, end
    elif preset == "this_month":
        start = today_start.replace(day=1).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
        return start, end
    elif preset == "last_month":
        first_this = today_start.replace(day=1)
        last_day_prev = first_this - timedelta(days=1)
        start = last_day_prev.replace(day=1).astimezone(timezone.utc)
        end = first_this.astimezone(timezone.utc) - timedelta(microseconds=1)
        return start, end
    elif preset == "custom" and date_from:
        try:
            start_local = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=TZ_IST)
            start = start_local.astimezone(timezone.utc)
            if date_to:
                end_local = datetime.strptime(date_to, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59, microsecond=999999, tzinfo=TZ_IST
                )
                end = end_local.astimezone(timezone.utc)
            else:
                end = now_local.astimezone(timezone.utc)
            return start, end
        except Exception:
            return None, None
    return None, None


async def _next_seq(counter: str, prefix: str, width: int = 6) -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": counter}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"{prefix}{doc['seq']:0{width}d}"


def get_product_unit(category_slug: str, variant_size: str = "") -> str:
    cat = (category_slug or "").lower()
    if "pillow" in cat:
        return "cm"
    if "mattress" in cat or "topper" in cat:
        return "inches"
    if "cm" in (variant_size or "").lower():
        return "cm"
    return "inches"


# =============================================================================
# 1. DASHBOARD & SUMMARY STATS
# =============================================================================

@router.get("/dashboard")
async def get_dashboard(user=Depends(require_role(*STOCK_POINT_ROLES))):
    """Authoritative Stock Point Dashboard metrics."""
    # 1. Get all active catalog products map
    products = await db.products.find({"is_active": {"$ne": False}}).to_list(1000)
    prod_map = {p["id"]: p for p in products}

    # 2. Get all catalog variants
    variants = await db.variants.find({"is_active": {"$ne": False}}).to_list(5000)

    # 3. Get all active manual stock items
    manual_items = await db.manual_stock_items.find({"is_active": {"$ne": False}}).to_list(5000)

    total_stock_units = 0
    mattresses_units = 0
    pillows_units = 0
    toppers_units = 0
    baby_kids_units = 0
    manual_items_units = 0
    low_stock_count = 0

    for v in variants:
        stock = int(v.get("stock", 0))
        reserved = int(v.get("reserved", 0))
        free = max(0, stock - reserved)
        total_stock_units += stock
        if free <= 5:
            low_stock_count += 1

        p = prod_map.get(v.get("product_id"))
        cat = (p.get("category_slug") if p else "").lower()
        if "mattress" in cat:
            mattresses_units += stock
        elif "pillow" in cat:
            pillows_units += stock
        elif "topper" in cat:
            toppers_units += stock
        elif "baby" in cat or "kid" in cat:
            baby_kids_units += stock

    for m in manual_items:
        m_stock = int(m.get("stock", 0))
        total_stock_units += m_stock
        manual_items_units += m_stock
        if m_stock <= 5:
            low_stock_count += 1

    # Today's dispatches and units out (in IST today)
    today_start_utc, today_end_utc = parse_date_range("today")
    today_match = {}
    if today_start_utc and today_end_utc:
        today_match["created_at"] = {"$gte": today_start_utc, "$lte": today_end_utc}

    today_dispatches = await db.stock_dispatches.find(today_match).to_list(2000)
    today_dispatches_count = len(today_dispatches)
    today_units_out = sum(int(d.get("total_units", 0)) for d in today_dispatches)

    # Recent 10 transactions
    recent_txs = (
        await db.stock_transactions.find({})
        .sort("created_at", -1)
        .limit(10)
        .to_list(10)
    )

    formatted_recent = []
    for tx in recent_txs:
        t_clean = clean_doc(tx)
        d_str, t_str, full_str = format_ist(tx.get("created_at"))
        t_clean["formatted_date"] = d_str
        t_clean["formatted_time"] = t_str
        t_clean["formatted_datetime"] = full_str
        formatted_recent.append(t_clean)

    return {
        "ok": True,
        "metrics": {
            "total_stock_units": total_stock_units,
            "mattresses_units": mattresses_units,
            "pillows_units": pillows_units,
            "toppers_units": toppers_units,
            "baby_kids_units": baby_kids_units,
            "manual_items_units": manual_items_units,
            "low_stock_count": low_stock_count,
            "today_dispatches_count": today_dispatches_count,
            "today_units_out": today_units_out,
        },
        "recent_activity": formatted_recent,
        "user_role": user.get("roles", ["stock_point_manager"])[0],
        "is_owner_admin": any(r in (OWNER, ADMIN, "owner_admin") for r in user.get("roles", [])),
    }


# =============================================================================
# 2. CURRENT INVENTORY TABLE (PAGINATED & SEARCHABLE)
# =============================================================================

@router.get("/inventory")
async def get_inventory(
    category: str = Query("all"),
    status: str = Query("all"),  # all | in_stock | low_stock | out_of_stock
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user=Depends(require_role(*STOCK_POINT_ROLES)),
):
    """Authoritative Current Inventory listing with server-side pagination & units."""
    products = await db.products.find({"is_active": {"$ne": False}}).to_list(1000)
    prod_map = {p["id"]: p for p in products}

    # Fetch variants and manual items
    variants = await db.variants.find({"is_active": {"$ne": False}}).to_list(5000)
    manual_items = await db.manual_stock_items.find({"is_active": {"$ne": False}}).to_list(5000)

    rows = []

    # 1. Map catalog variants
    for v in variants:
        p = prod_map.get(v.get("product_id"))
        if not p:
            continue
        cat_slug = (p.get("category_slug") or "").lower()
        cat_name = p.get("category_slug", "Mattresses").replace("-", " ").title()
        size_str = v.get("size") or "Standard"
        unit = get_product_unit(cat_slug, size_str)
        stock = int(v.get("stock", 0))
        reserved = int(v.get("reserved", 0))
        free = max(0, stock - reserved)

        if free <= 0:
            stock_status = "OUT OF STOCK"
        elif free <= 5:
            stock_status = "LOW STOCK"
        else:
            stock_status = "IN STOCK"

        d_str, t_str, full_str = format_ist(v.get("updated_at") or v.get("created_at") or now_utc())

        rows.append({
            "id": v["id"],
            "item_type": "CATALOG_VARIANT",
            "product_id": p["id"],
            "variant_id": v["id"],
            "manual_stock_item_id": None,
            "product_name": p["name"],
            "category": cat_name,
            "category_slug": cat_slug,
            "size": size_str,
            "unit": unit,
            "sku": v.get("sku", ""),
            "price": v.get("price", 0),
            "stock": stock,
            "available_quantity": stock,
            "reserved_quantity": reserved,
            "free_stock": free,
            "stock_status": stock_status,
            "last_updated": full_str,
            "last_updated_date": d_str,
            "last_updated_time": t_str,
        })

    # 2. Map manual stock items
    for m in manual_items:
        cat_name = m.get("category", "Manual Items")
        size_str = m.get("size") or "Custom Spec"
        unit = m.get("unit") or "pieces"
        stock = int(m.get("stock", 0))
        reserved = int(m.get("reserved", 0))
        free = max(0, stock - reserved)

        if free <= 0:
            stock_status = "OUT OF STOCK"
        elif free <= 5:
            stock_status = "LOW STOCK"
        else:
            stock_status = "IN STOCK"

        d_str, t_str, full_str = format_ist(m.get("updated_at") or m.get("created_at") or now_utc())

        rows.append({
            "id": m["id"],
            "item_type": "MANUAL_ITEM",
            "product_id": None,
            "variant_id": None,
            "manual_stock_item_id": m["id"],
            "product_name": m["name"],
            "category": cat_name,
            "category_slug": "manual",
            "size": size_str,
            "unit": unit,
            "sku": f"MANUAL-{m['id'][:6].upper()}",
            "price": 0,
            "stock": stock,
            "available_quantity": stock,
            "reserved_quantity": reserved,
            "free_stock": free,
            "stock_status": stock_status,
            "last_updated": full_str,
            "last_updated_date": d_str,
            "last_updated_time": t_str,
        })

    # Filters
    filtered = rows

    if category != "all":
        cat_lower = category.lower()
        if cat_lower == "manual":
            filtered = [r for r in filtered if r["item_type"] == "MANUAL_ITEM"]
        else:
            filtered = [r for r in filtered if cat_lower in r["category_slug"].lower() or cat_lower in r["category"].lower()]

    if status != "all":
        status_norm = status.replace("_", " ").upper()
        filtered = [r for r in filtered if r["stock_status"] == status_norm]

    if q:
        query_str = q.strip().lower()
        filtered = [
            r for r in filtered
            if query_str in r["product_name"].lower()
            or query_str in r["sku"].lower()
            or query_str in r["size"].lower()
            or query_str in r["category"].lower()
        ]

    # Sort: Low stock / Out of stock first, then product name
    status_priority = {"OUT OF STOCK": 0, "LOW STOCK": 1, "IN STOCK": 2}
    filtered.sort(key=lambda r: (status_priority.get(r["stock_status"], 3), r["product_name"], r["size"]))

    total = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered[start_idx:end_idx]
    pages = max(1, (total + limit - 1) // limit)

    return {
        "ok": True,
        "items": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


# =============================================================================
# 3. CATALOG TREE & SELECTION HELPER
# =============================================================================

@router.get("/catalog-tree")
async def get_catalog_tree(user=Depends(require_role(*STOCK_POINT_ROLES))):
    """Structured dropdown tree for Add Stock & Pack/Deliver dialogs."""
    products = await db.products.find({"is_active": {"$ne": False}}).to_list(1000)
    variants = await db.variants.find({"is_active": {"$ne": False}}).to_list(5000)
    manual_items = await db.manual_stock_items.find({"is_active": {"$ne": False}}).to_list(5000)

    # Group variants by product_id
    var_by_prod: Dict[str, list] = {}
    for v in variants:
        pid = v.get("product_id")
        if pid not in var_by_prod:
            var_by_prod[pid] = []
        var_by_prod[pid].append(v)

    # Categories
    categories_map: Dict[str, Dict[str, Any]] = {}
    for p in products:
        cat_slug = (p.get("category_slug") or "mattresses").lower()
        cat_title = cat_slug.replace("-", " ").title()
        if cat_slug not in categories_map:
            categories_map[cat_slug] = {"slug": cat_slug, "name": cat_title, "products": []}

        prod_vars = var_by_prod.get(p["id"], [])
        formatted_vars = []
        for v in prod_vars:
            unit = get_product_unit(cat_slug, v.get("size", ""))
            stock = int(v.get("stock", 0))
            formatted_vars.append({
                "id": v["id"],
                "sku": v.get("sku", ""),
                "size": v.get("size", "Standard"),
                "unit": unit,
                "stock": stock,
                "display": f"{v.get('size', 'Standard')} ({unit}) — Available: {stock}",
            })

        categories_map[cat_slug]["products"].append({
            "id": p["id"],
            "name": p["name"],
            "slug": p["slug"],
            "variants": formatted_vars,
        })

    # Manual items formatted
    manual_list = []
    for m in manual_items:
        stock = int(m.get("stock", 0))
        unit = m.get("unit", "pieces")
        manual_list.append({
            "id": m["id"],
            "name": m["name"],
            "category": m.get("category", "General"),
            "size": m.get("size", "Custom Spec"),
            "unit": unit,
            "stock": stock,
            "display": f"{m['name']} — {m.get('size', '')} ({unit}) — Available: {stock}",
        })

    return {
        "ok": True,
        "categories": list(categories_map.values()),
        "manual_items": manual_list,
    }


# =============================================================================
# 4. ADD / RECEIVE STOCK (OWNER ADMIN ONLY)
# =============================================================================

@router.post("/stock/receive")
async def receive_stock(input: ReceiveStockIn, user=Depends(require_role(OWNER, ADMIN))):
    """Add / Receive Stock. Atomically updates balance and creates immutable audit transaction."""
    qty = input.quantity
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity received must be greater than zero")

    now = utcnow()
    tx_date = input.received_date or now

    if input.item_type == "CATALOG_VARIANT":
        if not input.variant_id:
            raise HTTPException(status_code=400, detail="Variant ID is required for catalog stock receipt")
        variant = await db.variants.find_one({"id": input.variant_id})
        if not variant:
            raise HTTPException(status_code=404, detail="Catalogue variant not found")

        product = await db.products.find_one({"id": variant["product_id"]})
        product_name = product["name"] if product else "Catalogue Product"
        category_name = (product.get("category_slug") or "Mattresses").replace("-", " ").title() if product else "Mattresses"
        unit = get_product_unit(product.get("category_slug") if product else "", variant.get("size", ""))
        size_str = variant.get("size", "Standard")
        sku = variant.get("sku", "")

        # Atomic increment
        updated_var = await db.variants.find_one_and_update(
            {"id": input.variant_id},
            {"$inc": {"stock": qty}, "$set": {"updated_at": now}},
            return_document=True,
        )
        previous_qty = updated_var["stock"] - qty
        new_qty = updated_var["stock"]

        # Record in Stock Transactions Ledger
        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": "CATALOG_VARIANT",
            "product_id": variant["product_id"],
            "variant_id": input.variant_id,
            "manual_stock_item_id": None,
            "product_name": product_name,
            "category": category_name,
            "variant_size": size_str,
            "sku": sku,
            "unit": unit,
            "transaction_type": "STOCK_RECEIVED",
            "quantity_change": qty,
            "previous_quantity": previous_qty,
            "new_quantity": new_qty,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": input.reference_number,
            "supplier": input.supplier,
            "package_contents_summary": f"+{qty} × {product_name} ({size_str})",
            "remarks": input.remarks or f"Stock received from {input.supplier or 'Factory / Supplier'}",
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["owner"])[0],
            "created_at": tx_date,
        }
        await db.stock_transactions.insert_one(tx_doc)

        # Legacy inventory ledger sync for compatibility
        await db.inventory_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "variant_id": input.variant_id,
            "sku": sku,
            "delta": qty,
            "old_stock": previous_qty,
            "new_stock": new_qty,
            "reason": f"STOCK_RECEIVED: {input.remarks or 'Stock Receipt'}",
            "actor_id": user["id"],
            "actor_email": user.get("email"),
            "created_at": tx_date,
        })

    else:
        # MANUAL_ITEM
        if not input.manual_stock_item_id:
            raise HTTPException(status_code=400, detail="Manual stock item ID is required")
        manual_item = await db.manual_stock_items.find_one({"id": input.manual_stock_item_id})
        if not manual_item:
            raise HTTPException(status_code=404, detail="Manual stock item not found")

        updated_m = await db.manual_stock_items.find_one_and_update(
            {"id": input.manual_stock_item_id},
            {"$inc": {"stock": qty}, "$set": {"updated_at": now}},
            return_document=True,
        )
        previous_qty = updated_m["stock"] - qty
        new_qty = updated_m["stock"]

        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": "MANUAL_ITEM",
            "product_id": None,
            "variant_id": None,
            "manual_stock_item_id": input.manual_stock_item_id,
            "product_name": manual_item["name"],
            "category": manual_item.get("category", "Manual Items"),
            "variant_size": manual_item.get("size", "Custom Spec"),
            "sku": f"MANUAL-{manual_item['id'][:6].upper()}",
            "unit": manual_item.get("unit", "pieces"),
            "transaction_type": "STOCK_RECEIVED",
            "quantity_change": qty,
            "previous_quantity": previous_qty,
            "new_quantity": new_qty,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": input.reference_number,
            "supplier": input.supplier,
            "package_contents_summary": f"+{qty} × {manual_item['name']}",
            "remarks": input.remarks or f"Manual stock received from {input.supplier or 'Supplier'}",
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["owner"])[0],
            "created_at": tx_date,
        }
        await db.stock_transactions.insert_one(tx_doc)

    await audit(user, "stock_point.receive", "stock_transaction", tx_doc["id"], f"+{qty} stock received: {tx_doc['product_name']}")
    return {"ok": True, "transaction": clean_doc(tx_doc), "previous_quantity": previous_qty, "new_quantity": new_qty}


# =============================================================================
# 5. CREATE MANUAL STOCK ITEM (OWNER ADMIN ONLY)
# =============================================================================

@router.post("/manual-items")
async def create_manual_stock_item(input: CreateManualItemIn, user=Depends(require_role(OWNER, ADMIN))):
    """Create non-catalogue manual stock item (Internal Stock Point Only)."""
    now = utcnow()
    item_id = str(uuid.uuid4())
    doc = {
        "id": item_id,
        "name": input.name.strip(),
        "category": input.category.strip(),
        "size": input.size.strip() if input.size else "Custom Spec",
        "unit": input.unit.strip() or "pieces",
        "stock": input.initial_quantity,
        "reserved": 0,
        "remarks": input.remarks or "",
        "created_by_user_id": user["id"],
        "created_by_name": user.get("name") or user.get("email"),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.manual_stock_items.insert_one(doc)

    # If initial quantity > 0, record ledger entry
    if input.initial_quantity > 0:
        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": "MANUAL_ITEM",
            "product_id": None,
            "variant_id": None,
            "manual_stock_item_id": item_id,
            "product_name": doc["name"],
            "category": doc["category"],
            "variant_size": doc["size"],
            "sku": f"MANUAL-{item_id[:6].upper()}",
            "unit": doc["unit"],
            "transaction_type": "STOCK_RECEIVED",
            "quantity_change": input.initial_quantity,
            "previous_quantity": 0,
            "new_quantity": input.initial_quantity,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": "INITIAL_RECEIPT",
            "supplier": None,
            "package_contents_summary": f"Initial manual stock: {input.initial_quantity} × {doc['name']}",
            "remarks": input.remarks or "Initial manual stock item creation",
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["owner"])[0],
            "created_at": now,
        }
        await db.stock_transactions.insert_one(tx_doc)

    await audit(user, "stock_point.manual_item_create", "manual_stock_item", item_id, f"Created manual item {doc['name']}")
    return {"ok": True, "item": clean_doc(doc)}


# =============================================================================
# 6. ADJUST STOCK (OWNER ADMIN ONLY — AUDITED LEDGER)
# =============================================================================

@router.post("/stock/adjust")
async def adjust_stock(input: AdjustStockIn, user=Depends(require_role(OWNER, ADMIN))):
    """Audited physical count adjustment. Calculates delta and creates permanent ledger entry."""
    now = utcnow()
    target_qty = input.correct_quantity
    if target_qty < 0:
        raise HTTPException(status_code=400, detail="Stock balance cannot be adjusted to a negative number")

    if input.item_type == "CATALOG_VARIANT":
        if not input.variant_id:
            raise HTTPException(status_code=400, detail="Variant ID is required")
        variant = await db.variants.find_one({"id": input.variant_id})
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found")

        old_stock = int(variant.get("stock", 0))
        delta = target_qty - old_stock

        if delta == 0:
            return {"ok": True, "message": "Physical count matches recorded quantity. No adjustment needed.", "stock": old_stock}

        await db.variants.update_one({"id": input.variant_id}, {"$set": {"stock": target_qty, "updated_at": now}})

        product = await db.products.find_one({"id": variant["product_id"]})
        product_name = product["name"] if product else "Catalogue Product"
        category_name = (product.get("category_slug") or "Mattresses").replace("-", " ").title() if product else "Mattresses"
        unit = get_product_unit(product.get("category_slug") if product else "", variant.get("size", ""))

        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": "CATALOG_VARIANT",
            "product_id": variant["product_id"],
            "variant_id": input.variant_id,
            "manual_stock_item_id": None,
            "product_name": product_name,
            "category": category_name,
            "variant_size": variant.get("size", "Standard"),
            "sku": variant.get("sku", ""),
            "unit": unit,
            "transaction_type": "STOCK_ADJUSTMENT",
            "quantity_change": delta,
            "previous_quantity": old_stock,
            "new_quantity": target_qty,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": "STOCK_ADJUSTMENT",
            "package_contents_summary": f"Adjustment: {delta:+d} ({old_stock} -> {target_qty})",
            "remarks": input.reason,
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["owner"])[0],
            "created_at": now,
        }
        await db.stock_transactions.insert_one(tx_doc)

        # Legacy ledger sync
        await db.inventory_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "variant_id": input.variant_id,
            "sku": variant.get("sku", ""),
            "delta": delta,
            "old_stock": old_stock,
            "new_stock": target_qty,
            "reason": f"STOCK_ADJUSTMENT: {input.reason}",
            "actor_id": user["id"],
            "actor_email": user.get("email"),
            "created_at": now,
        })

    else:
        # MANUAL_ITEM
        if not input.manual_stock_item_id:
            raise HTTPException(status_code=400, detail="Manual stock item ID is required")
        manual_item = await db.manual_stock_items.find_one({"id": input.manual_stock_item_id})
        if not manual_item:
            raise HTTPException(status_code=404, detail="Manual item not found")

        old_stock = int(manual_item.get("stock", 0))
        delta = target_qty - old_stock

        if delta == 0:
            return {"ok": True, "message": "Physical count matches recorded quantity. No adjustment needed.", "stock": old_stock}

        await db.manual_stock_items.update_one({"id": input.manual_stock_item_id}, {"$set": {"stock": target_qty, "updated_at": now}})

        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": "MANUAL_ITEM",
            "product_id": None,
            "variant_id": None,
            "manual_stock_item_id": input.manual_stock_item_id,
            "product_name": manual_item["name"],
            "category": manual_item.get("category", "Manual Items"),
            "variant_size": manual_item.get("size", "Custom Spec"),
            "sku": f"MANUAL-{manual_item['id'][:6].upper()}",
            "unit": manual_item.get("unit", "pieces"),
            "transaction_type": "STOCK_ADJUSTMENT",
            "quantity_change": delta,
            "previous_quantity": old_stock,
            "new_quantity": target_qty,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": "STOCK_ADJUSTMENT",
            "package_contents_summary": f"Adjustment: {delta:+d} ({old_stock} -> {target_qty})",
            "remarks": input.reason,
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["owner"])[0],
            "created_at": now,
        }
        await db.stock_transactions.insert_one(tx_doc)

    await audit(user, "stock_point.adjust", "stock_transaction", tx_doc["id"], f"Adjusted stock {delta:+d}: {input.reason}")
    return {"ok": True, "previous_quantity": old_stock, "new_quantity": target_qty, "delta": delta}


# =============================================================================
# 7. PACK / DELIVER PRODUCT — ATOMIC MULTI-ITEM DISPATCH
# =============================================================================

@router.post("/dispatch")
async def create_dispatch(input: CreateDispatchIn, user=Depends(require_role(*STOCK_POINT_ROLES))):
    """Atomic multi-item dispatch deduction. Never allows negative stock; concurrency safe."""
    # 1. Idempotency Check
    if input.idempotency_key:
        existing = await db.stock_dispatches.find_one({"idempotency_key": input.idempotency_key})
        if existing:
            return {"ok": True, "dispatch": clean_doc(existing), "idempotent_replay": True}

    if not input.items:
        raise HTTPException(status_code=400, detail="At least one item must be included in the dispatch package")

    now = utcnow()
    decremented_items = []
    prepared_items_snapshots = []
    total_units = 0

    try:
        # Phase 1: Atomically test & decrement each item in sequence
        for item in input.items:
            qty = item.quantity
            if qty <= 0:
                raise HTTPException(status_code=400, detail="Item dispatch quantity must be at least 1")

            if item.item_type == "CATALOG_VARIANT":
                if not item.variant_id:
                    raise HTTPException(status_code=400, detail="variant_id is required for catalogue items")

                # Atomic conditional decrement: stock must be >= qty
                updated_v = await db.variants.find_one_and_update(
                    {"id": item.variant_id, "stock": {"$gte": qty}},
                    {"$inc": {"stock": -qty}, "$set": {"updated_at": now}},
                    return_document=True,
                )
                if not updated_v:
                    # Fetch current balance for descriptive error
                    curr_v = await db.variants.find_one({"id": item.variant_id})
                    curr_stock = curr_v.get("stock", 0) if curr_v else 0
                    p = await db.products.find_one({"id": curr_v.get("product_id")}) if curr_v else None
                    p_name = p.get("name") if p else "Selected Variant"
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {p_name} ({curr_v.get('size', '') if curr_v else ''}). Only {curr_stock} units currently available. Cannot dispatch {qty} units.",
                    )

                decremented_items.append({"type": "CATALOG_VARIANT", "id": item.variant_id, "qty": qty})
                product = await db.products.find_one({"id": updated_v["product_id"]})
                p_name = product["name"] if product else "Catalogue Product"
                cat_name = (product.get("category_slug") or "Mattresses").replace("-", " ").title() if product else "Mattresses"
                unit = get_product_unit(product.get("category_slug") if product else "", updated_v.get("size", ""))

                prepared_items_snapshots.append({
                    "item_type": "CATALOG_VARIANT",
                    "product_id": updated_v["product_id"],
                    "variant_id": item.variant_id,
                    "manual_stock_item_id": None,
                    "product_name": p_name,
                    "category": cat_name,
                    "variant_size": updated_v.get("size", "Standard"),
                    "sku": updated_v.get("sku", ""),
                    "unit": unit,
                    "quantity": qty,
                    "previous_stock": updated_v["stock"] + qty,
                    "new_stock": updated_v["stock"],
                })
                total_units += qty

            else:
                # MANUAL_ITEM
                if not item.manual_stock_item_id:
                    raise HTTPException(status_code=400, detail="manual_stock_item_id is required")

                updated_m = await db.manual_stock_items.find_one_and_update(
                    {"id": item.manual_stock_item_id, "stock": {"$gte": qty}},
                    {"$inc": {"stock": -qty}, "$set": {"updated_at": now}},
                    return_document=True,
                )
                if not updated_m:
                    curr_m = await db.manual_stock_items.find_one({"id": item.manual_stock_item_id})
                    curr_stock = curr_m.get("stock", 0) if curr_m else 0
                    m_name = curr_m.get("name") if curr_m else "Manual Item"
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {m_name}. Only {curr_stock} units available. Cannot dispatch {qty} units.",
                    )

                decremented_items.append({"type": "MANUAL_ITEM", "id": item.manual_stock_item_id, "qty": qty})
                prepared_items_snapshots.append({
                    "item_type": "MANUAL_ITEM",
                    "product_id": None,
                    "variant_id": None,
                    "manual_stock_item_id": item.manual_stock_item_id,
                    "product_name": updated_m["name"],
                    "category": updated_m.get("category", "Manual Items"),
                    "variant_size": updated_m.get("size", "Custom Spec"),
                    "sku": f"MANUAL-{updated_m['id'][:6].upper()}",
                    "unit": updated_m.get("unit", "pieces"),
                    "quantity": qty,
                    "previous_stock": updated_m["stock"] + qty,
                    "new_stock": updated_m["stock"],
                })
                total_units += qty

    except HTTPException:
        # Atomic rollback of any items decremented so far in this failed dispatch
        for dec in decremented_items:
            if dec["type"] == "CATALOG_VARIANT":
                await db.variants.update_one({"id": dec["id"]}, {"$inc": {"stock": dec["qty"]}})
            else:
                await db.manual_stock_items.update_one({"id": dec["id"]}, {"$inc": {"stock": dec["qty"]}})
        raise

    except Exception as exc:
        for dec in decremented_items:
            if dec["type"] == "CATALOG_VARIANT":
                await db.variants.update_one({"id": dec["id"]}, {"$inc": {"stock": dec["qty"]}})
            else:
                await db.manual_stock_items.update_one({"id": dec["id"]}, {"$inc": {"stock": dec["qty"]}})
        raise HTTPException(status_code=500, detail=f"Unexpected error during dispatch stock deduction: {exc}")

    # Generate sequential unique dispatch number
    dispatch_number = await _next_seq("stock_dispatch", "KT-DSP-", 6)
    dispatch_id = str(uuid.uuid4())

    # Build package contents text if not provided
    contents_summary = input.package_contents
    if not contents_summary:
        lines = [f"{snap['quantity']} × {snap['product_name']} ({snap['variant_size']})" for snap in prepared_items_snapshots]
        contents_summary = ", ".join(lines)

    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": dispatch_number,
        "dispatch_type": input.dispatch_type,
        "order_id": input.order_id,
        "reference_number": input.reference_number or (f"ORD-{input.order_id[:8]}" if input.order_id else "DIRECT_DISPATCH"),
        "package_contents": contents_summary,
        "remarks": input.remarks or "",
        "idempotency_key": input.idempotency_key,
        "items": prepared_items_snapshots,
        "total_units": total_units,
        "created_by_user_id": user["id"],
        "created_by_name": user.get("name") or user.get("email"),
        "created_by_role": user.get("roles", ["stock_point_manager"])[0],
        "created_at": now,
    }
    await db.stock_dispatches.insert_one(dispatch_doc)

    # Record each item in permanent Stock Transaction Ledger
    for snap in prepared_items_snapshots:
        tx_doc = {
            "id": str(uuid.uuid4()),
            "item_type": snap["item_type"],
            "product_id": snap["product_id"],
            "variant_id": snap["variant_id"],
            "manual_stock_item_id": snap["manual_stock_item_id"],
            "product_name": snap["product_name"],
            "category": snap["category"],
            "variant_size": snap["variant_size"],
            "sku": snap["sku"],
            "unit": snap["unit"],
            "transaction_type": "STOCK_DISPATCHED",
            "quantity_change": -snap["quantity"],
            "previous_quantity": snap["previous_stock"],
            "new_quantity": snap["new_stock"],
            "dispatch_id": dispatch_id,
            "dispatch_number": dispatch_number,
            "dispatch_type": input.dispatch_type,
            "order_id": input.order_id,
            "reference_number": dispatch_doc["reference_number"],
            "package_contents_summary": contents_summary,
            "remarks": input.remarks or f"Dispatched via {input.dispatch_type.replace('_', ' ').title()}",
            "created_by_user_id": user["id"],
            "created_by_name": user.get("name") or user.get("email"),
            "created_by_role": user.get("roles", ["stock_point_manager"])[0],
            "created_at": now,
        }
        await db.stock_transactions.insert_one(tx_doc)

        if snap["item_type"] == "CATALOG_VARIANT" and snap["variant_id"]:
            await db.inventory_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "variant_id": snap["variant_id"],
                "sku": snap["sku"],
                "delta": -snap["quantity"],
                "old_stock": snap["previous_stock"],
                "new_stock": snap["new_stock"],
                "reason": f"STOCK_DISPATCHED ({dispatch_number}): {input.remarks or input.dispatch_type}",
                "actor_id": user["id"],
                "actor_email": user.get("email"),
                "created_at": now,
            })

    await audit(user, "stock_point.dispatch", "stock_dispatch", dispatch_id, f"Dispatch {dispatch_number}: {total_units} units")
    return {"ok": True, "dispatch": clean_doc(dispatch_doc)}


# =============================================================================
# 8. STOCK MOVEMENT HISTORY & DISPATCHES LIST
# =============================================================================

@router.get("/movements")
async def get_movements(
    preset: str = Query("all"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    transaction_type: str = Query("all"),  # all | STOCK_RECEIVED | STOCK_DISPATCHED | STOCK_ADJUSTMENT
    dispatch_type: str = Query("all"),     # all | ONLINE_ORDER | OFFLINE_ORDER | DEALER | FRIENDS_INTERNAL | OTHER
    category: str = Query("all"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user=Depends(require_role(*STOCK_POINT_ROLES)),
):
    """Permanent Stock Movement History with server-side pagination and rich audit attributes."""
    query: Dict[str, Any] = {}

    start_utc, end_utc = parse_date_range(preset, date_from, date_to)
    if start_utc and end_utc:
        query["created_at"] = {"$gte": start_utc, "$lte": end_utc}

    if transaction_type != "all":
        query["transaction_type"] = transaction_type.upper()

    if dispatch_type != "all":
        query["dispatch_type"] = dispatch_type.upper()

    if category != "all":
        cat_lower = category.lower()
        if cat_lower == "manual":
            query["item_type"] = "MANUAL_ITEM"
        else:
            query["category"] = {"$regex": cat_lower, "$options": "i"}

    if q:
        query_str = q.strip()
        query["$or"] = [
            {"product_name": {"$regex": query_str, "$options": "i"}},
            {"dispatch_number": {"$regex": query_str, "$options": "i"}},
            {"reference_number": {"$regex": query_str, "$options": "i"}},
            {"remarks": {"$regex": query_str, "$options": "i"}},
            {"created_by_name": {"$regex": query_str, "$options": "i"}},
            {"sku": {"$regex": query_str, "$options": "i"}},
        ]

    total = await db.stock_transactions.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.stock_transactions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    txs = await cursor.to_list(limit)

    formatted = []
    for tx in txs:
        c = clean_doc(tx)
        d_str, t_str, full_str = format_ist(tx.get("created_at"))
        c["formatted_date"] = d_str
        c["formatted_time"] = t_str
        c["formatted_datetime"] = full_str
        formatted.append(c)

    pages = max(1, (total + limit - 1) // limit)
    return {
        "ok": True,
        "items": formatted,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


@router.get("/dispatches")
async def get_dispatches(
    preset: str = Query("all"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    dispatch_type: str = Query("all"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user=Depends(require_role(*STOCK_POINT_ROLES)),
):
    """List dispatches with details and package contents."""
    query: Dict[str, Any] = {}

    start_utc, end_utc = parse_date_range(preset, date_from, date_to)
    if start_utc and end_utc:
        query["created_at"] = {"$gte": start_utc, "$lte": end_utc}

    if dispatch_type != "all":
        query["dispatch_type"] = dispatch_type.upper()

    if q:
        query_str = q.strip()
        query["$or"] = [
            {"dispatch_number": {"$regex": query_str, "$options": "i"}},
            {"reference_number": {"$regex": query_str, "$options": "i"}},
            {"package_contents": {"$regex": query_str, "$options": "i"}},
            {"remarks": {"$regex": query_str, "$options": "i"}},
            {"created_by_name": {"$regex": query_str, "$options": "i"}},
        ]

    total = await db.stock_dispatches.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.stock_dispatches.find(query).sort("created_at", -1).skip(skip).limit(limit)
    dispatches = await cursor.to_list(limit)

    formatted = []
    for d in dispatches:
        c = clean_doc(d)
        d_str, t_str, full_str = format_ist(d.get("created_at"))
        c["formatted_date"] = d_str
        c["formatted_time"] = t_str
        c["formatted_datetime"] = full_str
        formatted.append(c)

    pages = max(1, (total + limit - 1) // limit)
    return {
        "ok": True,
        "items": formatted,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


@router.get("/dispatches/{id}")
async def get_dispatch_details(id: str, user=Depends(require_role(*STOCK_POINT_ROLES))):
    """Get full details of a single dispatch."""
    dispatch = await db.stock_dispatches.find_one({"$or": [{"id": id}, {"dispatch_number": id}]})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch record not found")

    c = clean_doc(dispatch)
    d_str, t_str, full_str = format_ist(dispatch.get("created_at"))
    c["formatted_date"] = d_str
    c["formatted_time"] = t_str
    c["formatted_datetime"] = full_str
    return {"ok": True, "dispatch": c}


# =============================================================================
# 9. EXCEL EXPORT (.XLSX) FOR MOVEMENTS AND CURRENT STOCK
# =============================================================================

@router.get("/export/movements")
async def export_movements_excel(
    preset: str = Query("all"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    transaction_type: str = Query("all"),
    dispatch_type: str = Query("all"),
    category: str = Query("all"),
    q: Optional[str] = Query(None),
    user=Depends(require_role(*STOCK_POINT_ROLES)),
):
    """Export filtered stock movement ledger to real Excel (.xlsx) across all matching pages."""
    query: Dict[str, Any] = {}

    start_utc, end_utc = parse_date_range(preset, date_from, date_to)
    if start_utc and end_utc:
        query["created_at"] = {"$gte": start_utc, "$lte": end_utc}

    if transaction_type != "all":
        query["transaction_type"] = transaction_type.upper()

    if dispatch_type != "all":
        query["dispatch_type"] = dispatch_type.upper()

    if category != "all":
        cat_lower = category.lower()
        if cat_lower == "manual":
            query["item_type"] = "MANUAL_ITEM"
        else:
            query["category"] = {"$regex": cat_lower, "$options": "i"}

    if q:
        query_str = q.strip()
        query["$or"] = [
            {"product_name": {"$regex": query_str, "$options": "i"}},
            {"dispatch_number": {"$regex": query_str, "$options": "i"}},
            {"reference_number": {"$regex": query_str, "$options": "i"}},
            {"remarks": {"$regex": query_str, "$options": "i"}},
            {"created_by_name": {"$regex": query_str, "$options": "i"}},
            {"sku": {"$regex": query_str, "$options": "i"}},
        ]

    txs = await db.stock_transactions.find(query).sort("created_at", -1).to_list(10000)

    # Build Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Stock Movements"

    headers = [
        "Date (IST)",
        "Time (IST)",
        "Transaction ID",
        "Dispatch Number",
        "Transaction Type",
        "Dispatch Type",
        "Product",
        "Category",
        "Variant / Size",
        "Unit",
        "Quantity Change",
        "Previous Quantity",
        "New Quantity",
        "Reference Number",
        "Package Contents",
        "Remarks",
        "Updated By",
        "Role",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="16241C", end_color="16241C", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align

    ws.row_dimensions[1].height = 26

    for tx in txs:
        d_str, t_str, _ = format_ist(tx.get("created_at"))
        change = tx.get("quantity_change", 0)
        change_str = f"{change:+d}" if change != 0 else "0"

        row_data = [
            d_str,
            t_str,
            tx.get("id", ""),
            tx.get("dispatch_number") or "-",
            tx.get("transaction_type", ""),
            tx.get("dispatch_type") or "-",
            tx.get("product_name", ""),
            tx.get("category", ""),
            tx.get("variant_size", ""),
            tx.get("unit", ""),
            change_str,
            tx.get("previous_quantity", 0),
            tx.get("new_quantity", 0),
            tx.get("reference_number") or "-",
            tx.get("package_contents_summary") or "-",
            tx.get("remarks") or "-",
            tx.get("created_by_name", ""),
            tx.get("created_by_role", ""),
        ]
        ws.append(row_data)

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 40)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"kotson_stock_movements_{datetime.now(TZ_IST).strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/current-stock")
async def export_current_stock_excel(
    category: str = Query("all"),
    user=Depends(require_role(*STOCK_POINT_ROLES)),
):
    """Export current stock balance to real Excel (.xlsx)."""
    products = await db.products.find({"is_active": {"$ne": False}}).to_list(1000)
    prod_map = {p["id"]: p for p in products}
    variants = await db.variants.find({"is_active": {"$ne": False}}).to_list(5000)
    manual_items = await db.manual_stock_items.find({"is_active": {"$ne": False}}).to_list(5000)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Current Stock"

    headers = [
        "Product",
        "Category",
        "Variant / Size",
        "Unit",
        "SKU",
        "Available Quantity",
        "Reserved Quantity",
        "Free Stock",
        "Stock Status",
        "Last Updated (IST)",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="16241C", end_color="16241C", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align

    ws.row_dimensions[1].height = 26

    # 1. Catalog Variants
    for v in variants:
        p = prod_map.get(v.get("product_id"))
        if not p:
            continue
        cat_slug = (p.get("category_slug") or "").lower()
        if category != "all" and category.lower() not in cat_slug:
            continue

        cat_name = p.get("category_slug", "Mattresses").replace("-", " ").title()
        size_str = v.get("size", "Standard")
        unit = get_product_unit(cat_slug, size_str)
        stock = int(v.get("stock", 0))
        reserved = int(v.get("reserved", 0))
        free = max(0, stock - reserved)
        status_str = "OUT OF STOCK" if free <= 0 else ("LOW STOCK" if free <= 5 else "IN STOCK")
        _, _, full_str = format_ist(v.get("updated_at") or v.get("created_at") or now_utc())

        ws.append([
            p["name"],
            cat_name,
            size_str,
            unit,
            v.get("sku", ""),
            stock,
            reserved,
            free,
            status_str,
            full_str,
        ])

    # 2. Manual items
    if category in ("all", "manual"):
        for m in manual_items:
            cat_name = m.get("category", "Manual Items")
            size_str = m.get("size", "Custom Spec")
            unit = m.get("unit", "pieces")
            stock = int(m.get("stock", 0))
            reserved = int(m.get("reserved", 0))
            free = max(0, stock - reserved)
            status_str = "OUT OF STOCK" if free <= 0 else ("LOW STOCK" if free <= 5 else "IN STOCK")
            _, _, full_str = format_ist(m.get("updated_at") or m.get("created_at") or now_utc())

            ws.append([
                m["name"],
                cat_name,
                size_str,
                unit,
                f"MANUAL-{m['id'][:6].upper()}",
                stock,
                reserved,
                free,
                status_str,
                full_str,
            ])

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 40)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"kotson_current_stock_{datetime.now(TZ_IST).strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# =============================================================================
# 10. ECOMMERCE ORDER INTEGRATION (SEARCH TO AUTO-LOAD ORDER ITEMS)
# =============================================================================

@router.get("/orders/search")
async def search_orders_for_dispatch(q: str = Query(..., min_length=2), user=Depends(require_role(*STOCK_POINT_ROLES))):
    """Search ecommerce orders to auto-populate package contents."""
    q_str = q.strip()
    orders = (
        await db.orders.find({
            "$or": [
                {"order_number": {"$regex": q_str, "$options": "i"}},
                {"email": {"$regex": q_str, "$options": "i"}},
                {"address.phone": {"$regex": q_str, "$options": "i"}},
                {"address.full_name": {"$regex": q_str, "$options": "i"}},
            ]
        })
        .sort("created_at", -1)
        .limit(10)
        .to_list(10)
    )

    results = []
    for o in orders:
        items = []
        for line in o.get("items", []):
            items.append({
                "variant_id": line.get("variant_id"),
                "product_name": line.get("product_name"),
                "sku": line.get("sku"),
                "size": line.get("size"),
                "qty": line.get("qty", 1),
            })
        d_str, t_str, full_str = format_ist(o.get("created_at"))
        results.append({
            "order_id": o["id"],
            "order_number": o.get("order_number"),
            "customer_name": o.get("address", {}).get("full_name") or o.get("email"),
            "city": o.get("address", {}).get("city", ""),
            "payment_status": o.get("payment_status"),
            "fulfilment_status": o.get("fulfilment_status"),
            "items": items,
            "created_at_formatted": full_str,
        })
    return {"ok": True, "orders": results}


# =============================================================================
# 11. STOCK MANAGERS ADMINISTRATION (OWNER ADMIN ONLY)
# =============================================================================

@router.get("/managers")
async def list_stock_managers(user=Depends(require_role(OWNER, ADMIN))):
    """List Stock Point Managers."""
    managers = await db.users.find({"roles": STOCK_POINT_MANAGER}).to_list(200)
    results = []
    for m in managers:
        c = clean_doc(m)
        d_str, t_str, full_str = format_ist(m.get("created_at"))
        c["created_at_formatted"] = full_str
        c.pop("password_hash", None)
        results.append(c)
    return {"ok": True, "managers": results}


@router.post("/managers")
async def create_stock_manager(input: CreateStockManagerIn, user=Depends(require_role(OWNER, ADMIN))):
    """Create a new Stock Point Manager account."""
    email = normalize_email(str(input.email))
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail=f"A user with email '{email}' already exists")

    now = utcnow()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": input.name.strip(),
        "phone": input.phone.strip(),
        "roles": [STOCK_POINT_MANAGER],
        "department": "Warehouse & Stock Point",
        "designation": "Stock Point Manager",
        "reporting_to": user.get("id"),
        "capabilities": ["stock_point_ops", "dispatch_products", "export_stock"],
        "password_hash": hash_password(input.password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(doc)
    await audit(user, "stock_point.create_manager", "user", doc["id"], f"Created Stock Manager {email}")

    res = clean_doc(doc)
    res.pop("password_hash", None)
    return {"ok": True, "manager": res}


@router.patch("/managers/{uid}/status")
async def update_manager_status(uid: str, is_active: bool = Query(...), user=Depends(require_role(OWNER, ADMIN))):
    """Deactivate or activate a Stock Point Manager without deleting historical attribution."""
    mgr = await db.users.find_one({"id": uid, "roles": STOCK_POINT_MANAGER})
    if not mgr:
        raise HTTPException(status_code=404, detail="Stock Point Manager not found")

    await db.users.update_one({"id": uid}, {"$set": {"is_active": is_active, "updated_at": utcnow()}})
    action = "Activated" if is_active else "Deactivated"
    await audit(user, "stock_point.manager_status", "user", uid, f"{action} Stock Manager {mgr.get('email')}")
    return {"ok": True, "is_active": is_active, "message": f"Stock Manager {action} successfully"}


async def ensure_stock_point_demo() -> None:
    """Ensure demo Stock Point Manager and sample manual item exist for instant operations and testing."""
    email = "stock@kotsonmattress.com"
    if not await db.users.find_one({"email": email}):
        doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": "Ramesh (Stock Manager)",
            "phone": "9876543219",
            "roles": [STOCK_POINT_MANAGER],
            "department": "Warehouse & Stock Point",
            "designation": "Stock Point Manager",
            "capabilities": ["stock_point_ops", "dispatch_products", "export_stock"],
            "password_hash": hash_password("Kotson-Stock-2026!"),
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.users.insert_one(doc)

    # If manual_stock_items is empty, seed initial display sample
    if await db.manual_stock_items.count_documents({}) == 0:
        now = now_utc()
        m1_id = str(uuid.uuid4())
        await db.manual_stock_items.insert_one({
            "id": m1_id,
            "name": "Exhibition Display Natural Latex Sample Block",
            "category": "Marketing & Display",
            "size": "24 × 24 × 4 in",
            "unit": "pieces",
            "stock": 8,
            "reserved": 0,
            "remarks": "Demo sample units for Vijayawada & Hyderabad showroom displays",
            "is_active": True,
            "created_by_user_id": "seed-owner",
            "created_by_name": "Kotson Owner",
            "created_at": now,
            "updated_at": now,
        })
        await db.stock_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "item_type": "MANUAL_ITEM",
            "product_id": None,
            "variant_id": None,
            "manual_stock_item_id": m1_id,
            "product_name": "Exhibition Display Natural Latex Sample Block",
            "category": "Marketing & Display",
            "variant_size": "24 × 24 × 4 in",
            "sku": f"MANUAL-{m1_id[:6].upper()}",
            "unit": "pieces",
            "transaction_type": "STOCK_RECEIVED",
            "quantity_change": 8,
            "previous_quantity": 0,
            "new_quantity": 8,
            "dispatch_id": None,
            "dispatch_number": None,
            "dispatch_type": None,
            "order_id": None,
            "reference_number": "FACTORY_BATCH_01",
            "supplier": "Kotson Kerala Facility",
            "package_contents_summary": "8 × Exhibition Display Natural Latex Sample Block",
            "remarks": "Initial stock receipt for retail showroom demos",
            "created_by_user_id": "seed-owner",
            "created_by_name": "Kotson Owner",
            "created_by_role": "owner",
            "created_at": now,
        })
