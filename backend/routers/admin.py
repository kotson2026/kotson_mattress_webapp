"""Owner/admin console backend: dashboard, staff, settings (masked integration state), audit, rewards."""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.security import (
    ADMIN,
    MANAGER,
    OWNER,
    STAFF_ROLES,
    audit,
    hash_password,
    normalize_email,
    now_utc,
    require_role,
)
from lib.services import clean_doc
from models.content import SettingsOut, SettingsUpdate
from models.users import StaffCreateIn, StaffInviteIn, StaffUpdateIn, UserOut

router = APIRouter()


def get_dashboard_dates(preset: str = "month", date_from: Optional[str] = None, date_to: Optional[str] = None):
    tzname = os.environ.get("APP_TZ", "Asia/Kolkata")
    try:
        tz = ZoneInfo(tzname)
    except Exception:
        tz = timezone.utc
    now_local = datetime.now(tz)
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    if preset == "today":
        start = today_start_local.astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "yesterday":
        yesterday_start = today_start_local - timedelta(days=1)
        yesterday_end = today_start_local - timedelta(microseconds=1)
        start = yesterday_start.astimezone(timezone.utc)
        end = yesterday_end.astimezone(timezone.utc)
    elif preset == "week":
        start = (today_start_local - timedelta(days=6)).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "month":
        start = today_start_local.replace(day=1).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "last_month":
        first_this_month = today_start_local.replace(day=1)
        last_day_prev = first_this_month - timedelta(days=1)
        start = last_day_prev.replace(day=1).astimezone(timezone.utc)
        end = first_this_month.astimezone(timezone.utc) - timedelta(microseconds=1)
    elif preset == "custom" and date_from:
        try:
            start = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
        except Exception:
            start = today_start_local.replace(day=1).astimezone(timezone.utc)
        if date_to:
            try:
                end = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                if end.tzinfo is None:
                    end = end.replace(tzinfo=timezone.utc)
            except Exception:
                end = now_local.astimezone(timezone.utc)
        else:
            end = now_local.astimezone(timezone.utc)
    else:
        start = today_start_local.replace(day=1).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)

    return start, end, tzname


@router.get("/admin/dashboard")
async def dashboard(
    preset: str = "month",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN, "crm_master")),
):
    start, end, tzname = get_dashboard_dates(preset, date_from, date_to)

    # 1. Product mapping to categories
    products = await db.products.find({}).to_list(500)
    prod_cat_map = {p["id"]: (p.get("category_slug") or "").lower() for p in products}

    # 2. Paid orders in selected period
    paid_query = {
        "payment_status": "paid",
        "created_at": {"$gte": start, "$lte": end},
    }
    paid_orders = await db.orders.find(paid_query).sort("created_at", -1).to_list(5000)

    # 3. Product Orders counting (Counting orders NOT units!)
    product_orders = {
        "mattresses": {"orders": 0, "units": 0, "gross_paise": 0, "net_paise": 0},
        "pillows": {"orders": 0, "units": 0, "gross_paise": 0, "net_paise": 0},
        "toppers": {"orders": 0, "units": 0, "gross_paise": 0, "net_paise": 0},
        "baby_kids": {"orders": 0, "units": 0, "gross_paise": 0, "net_paise": 0},
    }

    category_keys = {
        "mattresses": "mattresses",
        "pillows": "pillows",
        "toppers": "toppers",
        "baby-kids": "baby_kids",
        "baby_kids": "baby_kids",
    }

    unique_purchasers = set()
    total_revenue_paise = 0

    for o in paid_orders:
        buyer_id = o.get("user_id") or o.get("email")
        if buyer_id:
            unique_purchasers.add(buyer_id)
        total_revenue_paise += int((o.get("amounts") or {}).get("total", 0))

        seen_cats_in_order = set()
        for item in o.get("items", []):
            cat = prod_cat_map.get(item.get("product_id"), "")
            canonical_cat = category_keys.get(cat)
            if not canonical_cat:
                pname = (item.get("product_name") or "").lower()
                pslug = (item.get("product_slug") or "").lower()
                if "mattress" in pname or "mattress" in pslug:
                    canonical_cat = "mattresses"
                elif "pillow" in pname or "pillow" in pslug:
                    canonical_cat = "pillows"
                elif "topper" in pname or "topper" in pslug:
                    canonical_cat = "toppers"
                elif "baby" in pname or "kids" in pname:
                    canonical_cat = "baby_kids"

            if canonical_cat in product_orders:
                qty = int(item.get("qty", 1))
                line_total = int(item.get("line_total", 0))
                product_orders[canonical_cat]["units"] += qty
                product_orders[canonical_cat]["gross_paise"] += line_total
                product_orders[canonical_cat]["net_paise"] += line_total
                seen_cats_in_order.add(canonical_cat)

        for cat in seen_cats_in_order:
            product_orders[cat]["orders"] += 1

    # 4. Customer Activity in selected period
    customer_signups = await db.users.count_documents({
        "roles": "customer",
        "created_at": {"$gte": start, "$lte": end},
    })

    # Add-to-cart unique users
    cart_events = await db.source_events.distinct("customer_id", {
        "kind": {"$in": ["cart_intent", "add_to_cart"]},
        "created_at": {"$gte": start, "$lte": end},
    })
    active_cart_users = await db.carts.distinct("user_id", {
        "items.0": {"$exists": True},
        "updated_at": {"$gte": start, "$lte": end},
    })
    unique_cart_users = len(set([u for u in cart_events + active_cart_users if u]))

    # 5. Dealer Network Stats
    total_dealers = await db.dealers.count_documents({"status": "approved"})
    pending_dealers = await db.dealers.count_documents({
        "status": {"$in": ["applied", "pending", "pending_review"]}
    })
    dealer_orders = [o for o in paid_orders if o.get("buyer_type") == "DEALER" or o.get("order_source") == "DEALER"]
    dealer_sales_paise = sum(int((o.get("amounts") or {}).get("total", 0)) for o in dealer_orders)
    dlr_b2b = await db.dealer_orders.find({
        "status": {"$in": ["approved", "fulfilled"]},
        "created_at": {"$gte": start, "$lte": end},
    }).to_list(1000)
    dealer_sales_paise += sum(int((o.get("amounts") or {}).get("total", 0)) for o in dlr_b2b)
    total_dealer_orders_count = len(dealer_orders) + len(dlr_b2b)

    # 6. Current Low Stock (≤ 5 Free Units) — INDEPENDENT of date filter
    low_variants = await db.variants.aggregate([
        {"$match": {"$expr": {"$lte": [{"$subtract": ["$stock", "$reserved"]}, 5]}}},
        {"$sort": {"stock": 1}},
        {"$limit": 50},
    ]).to_list(50)

    low_stock = []
    for v in low_variants:
        p = await db.products.find_one({"id": v["product_id"]})
        free_stock = max(0, v.get("stock", 0) - v.get("reserved", 0))
        if free_stock <= 0:
            stock_status = "OUT OF STOCK"
        elif free_stock <= 2:
            stock_status = "CRITICAL"
        else:
            stock_status = "LOW STOCK"

        low_stock.append({
            "sku": v.get("sku"),
            "variant_id": v.get("id"),
            "product_id": v.get("product_id"),
            "product_name": p.get("name") if p else v.get("sku"),
            "category": p.get("category_slug", "mattresses") if p else "",
            "size": v.get("size", "Standard"),
            "current_stock": v.get("stock", 0),
            "reserved": v.get("reserved", 0),
            "free_stock": free_stock,
            "stock_status": stock_status,
        })

    return {
        "preset": preset,
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "timezone": tzname,
        # Section 1: Product Orders
        "product_orders": {
            "mattress_orders": product_orders["mattresses"]["orders"],
            "mattress_units": product_orders["mattresses"]["units"],
            "mattress_gross_paise": product_orders["mattresses"]["gross_paise"],
            "pillow_orders": product_orders["pillows"]["orders"],
            "pillow_units": product_orders["pillows"]["units"],
            "pillow_gross_paise": product_orders["pillows"]["gross_paise"],
            "topper_orders": product_orders["toppers"]["orders"],
            "topper_units": product_orders["toppers"]["units"],
            "topper_gross_paise": product_orders["toppers"]["gross_paise"],
            "baby_kids_orders": product_orders["baby_kids"]["orders"],
            "baby_kids_units": product_orders["baby_kids"]["units"],
            "baby_kids_gross_paise": product_orders["baby_kids"]["gross_paise"],
        },
        # Section 2: Customer Activity
        "customer_activity": {
            "total_signups": customer_signups,
            "add_to_cart_users": unique_cart_users,
            "purchased_unique_customers": len(unique_purchasers),
        },
        # Section 3: Dealer Network
        "dealer_network": {
            "total_dealers": total_dealers,
            "pending_approvals": pending_dealers,
            "dealer_sales_paise": dealer_sales_paise,
            "dealer_orders_count": total_dealer_orders_count,
        },
        # Section 4: Current Low Stock
        "low_stock": low_stock,
        # Legacy summary compatibility
        "revenue_paid_paise": total_revenue_paise,
        "paid_orders": len(paid_orders),
    }


@router.get("/admin/dashboard/drill-down")
async def dashboard_drill_down(
    kind: str,  # product_orders | customer_signups | cart_users | purchased_customers | dealers | pending_dealers | dealer_sales
    category: Optional[str] = None,  # mattresses | pillows | toppers | baby_kids
    preset: str = "month",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN, "crm_master")),
):
    start, end, _ = get_dashboard_dates(preset, date_from, date_to)

    if kind == "product_orders":
        cat_query = category.lower().replace("-", "_") if category else "mattresses"
        products = await db.products.find({}).to_list(500)
        prod_cat_map = {p["id"]: (p.get("category_slug") or "").lower().replace("-", "_") for p in products}

        paid_orders = await db.orders.find({
            "payment_status": "paid",
            "created_at": {"$gte": start, "$lte": end},
        }).sort("created_at", -1).to_list(2000)

        rows = []
        total_units = 0
        total_gross = 0

        for o in paid_orders:
            matching_items = []
            for it in o.get("items", []):
                cat = prod_cat_map.get(it.get("product_id"), "")
                pname = (it.get("product_name") or "").lower()
                pslug = (it.get("product_slug") or "").lower()
                is_match = (
                    cat == cat_query or
                    (cat_query == "mattresses" and "mattress" in pname) or
                    (cat_query == "pillows" and "pillow" in pname) or
                    (cat_query == "toppers" and "topper" in pname) or
                    (cat_query == "baby_kids" and ("baby" in pname or "kids" in pname))
                )
                if is_match:
                    matching_items.append(it)
                    total_units += int(it.get("qty", 1))
                    total_gross += int(it.get("line_total", 0))

            if matching_items:
                addr = o.get("address") or {}
                amounts = o.get("amounts") or {}
                rows.append({
                    "order_id": o.get("id"),
                    "order_number": o.get("order_number"),
                    "order_date": o.get("sale_date") or o.get("created_at"),
                    "customer_name": addr.get("full_name") or o.get("email"),
                    "mobile": addr.get("phone") or "",
                    "products": [
                        {
                            "name": it.get("product_name"),
                            "size": it.get("size"),
                            "thickness": it.get("thickness"),
                            "qty": it.get("qty"),
                            "unit_price": it.get("unit_price"),
                            "discount": it.get("discount", 0),
                            "line_total": it.get("line_total"),
                        }
                        for it in matching_items
                    ],
                    "order_amount": amounts.get("total", 0),
                    "payment_method": o.get("payment_method") or "online",
                    "payment_status": o.get("payment_status"),
                    "order_status": o.get("fulfilment_status"),
                    "sales_source": o.get("order_source") or "DIRECT_WEBSITE",
                    "delivery_status": o.get("fulfilment_status"),
                    "city": addr.get("city") or "",
                    "state": addr.get("state") or "",
                    "employee_id": o.get("employee_id"),
                    "dealer_id": o.get("dealer_id"),
                    "is_test_data": bool(o.get("is_test_data")),
                })

        return {
            "kind": kind,
            "category": cat_query,
            "summary": {
                "total_orders": len(rows),
                "units_sold": total_units,
                "gross_sales_paise": total_gross,
                "net_revenue_paise": total_gross,
            },
            "rows": rows,
        }

    elif kind == "customer_signups":
        users = await db.users.find({
            "roles": "customer",
            "created_at": {"$gte": start, "$lte": end},
        }).sort("created_at", -1).to_list(500)

        rows = []
        for u in users:
            orders = await db.orders.find({"user_id": u["id"], "payment_status": "paid"}).to_list(100)
            lifetime_spend = sum(int((o.get("amounts") or {}).get("total", 0)) for o in orders)
            rows.append({
                "customer_id": u["id"],
                "name": u.get("name") or u.get("email"),
                "phone": u.get("phone") or "",
                "email": u.get("email"),
                "registration_date": u.get("created_at"),
                "registration_source": "Website Registration",
                "city": (u.get("address") or {}).get("city", "—"),
                "state": (u.get("address") or {}).get("state", "—"),
                "referral_source": u.get("referral_code") or "Organic",
                "orders_count": len(orders),
                "lifetime_spend_paise": lifetime_spend,
                "last_activity": u.get("updated_at") or u.get("created_at"),
                "is_test_data": bool(u.get("is_test_data")),
            })
        return {"kind": kind, "total": len(rows), "rows": rows}

    elif kind == "cart_users":
        # Get users who added items to cart in period
        carts = await db.carts.find({"items.0": {"$exists": True}}).sort("updated_at", -1).to_list(200)
        rows = []
        for c in carts:
            uid = c.get("user_id")
            user_doc = await db.users.find_one({"id": uid}) if uid else None
            cart_value = sum(int(it.get("line_total", it.get("unit_price", 0) * it.get("qty", 1))) for it in c.get("items", []))
            purchased = await db.orders.find_one({"cart_token": c.get("token"), "payment_status": "paid"})
            rows.append({
                "cart_id": c.get("id"),
                "customer": user_doc.get("name") if user_doc else "Guest Shopper",
                "phone": user_doc.get("phone", "") if user_doc else "",
                "email": user_doc.get("email", "") if user_doc else "",
                "products_count": len(c.get("items", [])),
                "items": c.get("items", []),
                "cart_value_paise": cart_value,
                "last_activity": c.get("updated_at") or c.get("created_at"),
                "checkout_started": bool(c.get("checkout_started")),
                "purchased": bool(purchased),
                "assigned_employee": "Support Agent",
                "is_test_data": bool(c.get("is_test_data") or (user_doc and user_doc.get("is_test_data"))),
            })
        return {"kind": kind, "total": len(rows), "rows": rows}

    elif kind == "purchased_customers":
        orders = await db.orders.find({"payment_status": "paid", "created_at": {"$gte": start, "$lte": end}}).to_list(2000)
        customer_groups = {}
        for o in orders:
            key = o.get("user_id") or o.get("email")
            if not key:
                continue
            if key not in customer_groups:
                addr = o.get("address") or {}
                customer_groups[key] = {
                    "customer_name": addr.get("full_name") or o.get("email"),
                    "email": o.get("email"),
                    "phone": addr.get("phone") or "",
                    "orders": [],
                    "city": addr.get("city") or "",
                    "state": addr.get("state") or "",
                }
            customer_groups[key]["orders"].append(o)

        rows = []
        for key, cg in customer_groups.items():
            ords = sorted(cg["orders"], key=lambda x: x.get("created_at"))
            total_orders = len(ords)
            total_units = sum(int(it.get("qty", 1)) for od in ords for it in od.get("items", []))
            lifetime_val = sum(int((od.get("amounts") or {}).get("total", 0)) for od in ords)
            aov = lifetime_val // total_orders if total_orders > 0 else 0
            last_item = (ords[-1].get("items") or [{}])[0].get("product_name", "Kotson Mattress")

            rows.append({
                "customer_name": cg["customer_name"],
                "email": cg["email"],
                "phone": cg["phone"],
                "first_order_date": ords[0].get("created_at"),
                "last_order_date": ords[-1].get("created_at"),
                "total_orders": total_orders,
                "total_units": total_units,
                "lifetime_spend_paise": lifetime_val,
                "aov_paise": aov,
                "last_purchased_product": last_item,
                "city": cg["city"],
                "state": cg["state"],
                "is_test_data": any(bool(od.get("is_test_data")) for od in ords),
            })

        return {"kind": kind, "total": len(rows), "rows": rows}

    elif kind == "dealer_sales":
        dealers = await db.dealers.find({}).to_list(100)
        dealer_map = {d["id"]: d for d in dealers}
        d_orders = await db.orders.find({
            "payment_status": "paid",
            "$or": [{"buyer_type": "DEALER"}, {"order_source": "DEALER"}],
            "created_at": {"$gte": start, "$lte": end},
        }).sort("created_at", -1).to_list(500)

        rows = []
        for o in d_orders:
            d_info = dealer_map.get(o.get("dealer_id") or "") or {}
            addr = o.get("address") or {}
            amounts = o.get("amounts") or {}
            items = o.get("items") or []
            rows.append({
                "dealer_name": d_info.get("org_name") or addr.get("full_name") or "Authorized Partner",
                "order_id": o.get("id"),
                "order_number": o.get("order_number"),
                "date": o.get("created_at"),
                "products_summary": ", ".join(f"{it.get('product_name')} x{it.get('qty')}" for it in items),
                "total_qty": sum(int(it.get("qty", 1)) for it in items),
                "gross_amount_paise": amounts.get("subtotal", amounts.get("total", 0)),
                "discount_paise": amounts.get("discount", 0),
                "net_amount_paise": amounts.get("total", 0),
                "payment_status": o.get("payment_status"),
                "order_status": o.get("fulfilment_status"),
                "delivery_status": o.get("fulfilment_status"),
                "is_test_data": bool(o.get("is_test_data")),
            })
        return {"kind": kind, "total": len(rows), "rows": rows}

    return {"kind": kind, "rows": []}



CAPABILITIES_CATALOG = [
    {"key": "orders.view", "name": "View Orders", "category": "Sales & Orders", "description": "Can browse and search customer orders"},
    {"key": "orders.edit", "name": "Edit Orders", "category": "Sales & Orders", "description": "Can update order items, address, and internal notes"},
    {"key": "dispatch.manage", "name": "Dispatch & Fulfilment", "category": "Fulfilment", "description": "Can generate labels, pack, and mark shipments delivered"},
    {"key": "catalog.view", "name": "View Catalog", "category": "Product & Inventory", "description": "Can browse products and stock levels"},
    {"key": "catalog.edit", "name": "Manage Catalog", "category": "Product & Inventory", "description": "Can create/edit products, prices, and variants"},
    {"key": "crm.view", "name": "View CRM", "category": "CRM & Support", "description": "Can access customer records and call logs"},
    {"key": "crm.assign", "name": "Assign Leads", "category": "CRM & Support", "description": "Can assign calls and inquiries to team members"},
    {"key": "dealers.manage", "name": "Dealer Network", "category": "B2B & Partners", "description": "Can approve dealers and set commercial terms"},
    {"key": "referrals.manage", "name": "Refer & Earn", "category": "Growth & Rewards", "description": "Can approve rewards and process withdrawals"},
    {"key": "reports.view", "name": "Financial Reports", "category": "Executive", "description": "Can view revenue, margins, and sales analytics"},
    {"key": "website.edit", "name": "Edit Website (CMS)", "category": "Website", "description": "Can draft pages, banners, and section content"},
    {"key": "website.publish", "name": "Publish Live Website", "category": "Website", "description": "Can trigger live website deployment and rollback"},
    {"key": "staff.manage", "name": "Manage Staff Access", "category": "Administration", "description": "Can invite, edit, or deactivate staff members"},
    {"key": "settings.manage", "name": "System Settings", "category": "Administration", "description": "Can modify company profile and payment integrations"},
]


@router.get("/admin/staff/overview")
async def staff_overview(user=Depends(require_role(OWNER, ADMIN))):
    """Staff & Access KPI metrics."""
    total_staff = await db.users.count_documents({"roles": {"$in": STAFF_ROLES}})
    active_staff = await db.users.count_documents({"roles": {"$in": STAFF_ROLES}, "is_active": True})
    managers = await db.users.count_documents({"roles": "manager", "is_active": True})
    employees = await db.users.count_documents({"roles": "employee", "is_active": True})
    inactive = total_staff - active_staff

    return {
        "total_staff": total_staff,
        "active_staff": active_staff,
        "managers": managers,
        "employees": employees,
        "inactive": inactive,
    }


@router.get("/admin/staff/capabilities-catalog")
async def staff_capabilities_catalog(user=Depends(require_role(OWNER, ADMIN))):
    """Returns the master matrix of capabilities and descriptions."""
    return CAPABILITIES_CATALOG


@router.get("/admin/staff")
async def staff_list(
    role: Optional[str] = None,
    q: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {"roles": {"$in": STAFF_ROLES}}
    if role and role != "ALL":
        query["roles"] = role.lower()
    if q:
        query["$or"] = [
            {"name": {"$regex": q.strip(), "$options": "i"}},
            {"email": {"$regex": q.strip(), "$options": "i"}},
            {"phone": {"$regex": q.strip(), "$options": "i"}},
            {"department": {"$regex": q.strip(), "$options": "i"}},
        ]
    docs = await db.users.find(query).sort("created_at", -1).to_list(200)
    return [clean_doc(d) for d in docs]


@router.post("/admin/staff", status_code=201)
async def create_staff_member(input: StaffCreateIn, user=Depends(require_role(OWNER, ADMIN))):
    email = normalize_email(str(input.email))
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail=f"A user with email '{email}' already exists")

    # Map role input to system roles
    role_map = {
        "OWNER_ADMIN": ["owner", "admin"],
        "CRM_MASTER_ADMIN": ["admin", "crm_master"],
        "MANAGER": ["manager"],
        "EMPLOYEE": ["employee"],
    }
    assigned_roles = role_map.get(input.role, ["employee"])
    
    # Generate password or use provided
    initial_password = input.password or secrets.token_urlsafe(10)
    
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": input.name.strip(),
        "phone": input.phone.strip(),
        "roles": assigned_roles,
        "department": input.department or "Operations",
        "designation": input.designation or "Specialist",
        "reporting_to": input.reporting_to,
        "capabilities": input.capabilities or [],
        "password_hash": hash_password(initial_password),
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.users.insert_one(doc)
    await audit(user, "staff.create", "user", doc["id"], f"Created {input.role} account for {email}")
    
    res = clean_doc(doc)
    res["initial_password"] = initial_password
    return res


@router.put("/admin/staff/{uid}")
async def update_staff_member(uid: str, input: StaffUpdateIn, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.users.find_one({"id": uid})
    if not existing:
        raise HTTPException(status_code=404, detail="Staff member not found")

    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if input.role:
        role_map = {
            "OWNER_ADMIN": ["owner", "admin"],
            "CRM_MASTER_ADMIN": ["admin", "crm_master"],
            "MANAGER": ["manager"],
            "EMPLOYEE": ["employee"],
        }
        patch["roles"] = role_map.get(input.role, ["employee"])
        del patch["role"]

    patch["updated_at"] = now_utc()
    await db.users.update_one({"id": uid}, {"$set": patch})
    await audit(user, "staff.update", "user", uid, f"Updated staff details: {list(patch.keys())}")
    
    updated = await db.users.find_one({"id": uid})
    return clean_doc(updated)


@router.post("/admin/staff/{uid}/toggle-status")
async def toggle_staff_status(uid: str, user=Depends(require_role(OWNER))):
    existing = await db.users.find_one({"id": uid})
    if not existing:
        raise HTTPException(status_code=404, detail="Staff member not found")

    # Prevent owner from deactivating own account
    if uid == user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot deactivate your own active session")

    new_status = not existing.get("is_active", True)
    await db.users.update_one({"id": uid}, {"$set": {"is_active": new_status, "updated_at": now_utc()}})
    
    action_label = "Reactivated" if new_status else "Deactivated"
    await audit(user, "staff.status_toggle", "user", uid, f"{action_label} account for {existing.get('email')}")
    return {"status": "success", "is_active": new_status, "message": f"Staff account {action_label.lower()} successfully"}


@router.get("/manager/dashboard")
async def manager_dashboard(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Operational-only tiles. Deliberately excludes revenue — managers get no pricing/financial visibility."""
    awaiting = await db.orders.count_documents({"payment_status": "pending"})
    to_process = await db.orders.count_documents({"payment_status": "paid", "fulfilment_status": "awaiting_payment"})
    processing = await db.orders.count_documents({"fulfilment_status": "processing"})
    shipped = await db.orders.count_documents({"fulfilment_status": "shipped"})
    exceptions = await db.orders.count_documents({"fulfilment_status": "stock_exception"})
    low = await db.variants.aggregate([
        {"$match": {"is_active": True}},
        {"$addFields": {"free_stock": {"$subtract": ["$stock", "$reserved"]}}},
        {"$match": {"free_stock": {"$lte": 5}}},
        {"$sort": {"free_stock": 1}},
        {"$limit": 20},
    ]).to_list(20)
    names = {p["id"]: p["name"] for p in await db.products.find({}, {"id": 1, "name": 1}).to_list(500)}
    return {
        "awaiting_payment": awaiting,
        "to_process": to_process,
        "processing": processing,
        "shipped": shipped,
        "stock_exceptions": exceptions,
        "low_stock": [
            {
                "sku": v["sku"],
                "product_name": names.get(v["product_id"], "—"),
                "size": v.get("size", "—"),
                "free_stock": v["free_stock"],
            }
            for v in low
        ],
    }


@router.get("/admin/settings", response_model=SettingsOut)
async def get_settings(user=Depends(require_role(OWNER, ADMIN))):
    s = await db.settings.find_one({"id": "site"}) or {}
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    out = SettingsOut(**clean_doc(s)) if s.get("id") else SettingsOut()
    if kid.startswith("rzp_live_"):
        out.razorpay_state = "ready_live"
    elif kid:
        out.razorpay_state = "ready_test_mode"
    else:
        out.razorpay_state = "pending_keys"
    return out


@router.put("/admin/settings", response_model=SettingsOut)
async def put_settings(input: SettingsUpdate, user=Depends(require_role(OWNER, ADMIN))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if "gst_rate" in patch and patch["gst_rate"] is not None and not (0 <= patch["gst_rate"] <= 28):
        raise HTTPException(status_code=422, detail="GST rate must be between 0 and 28%")
    await db.settings.update_one({"id": "site"}, {"$set": patch, "$setOnInsert": {"id": "site"}}, upsert=True)
    if any(k.startswith("promotion_") for k in patch):
        from lib.pricing import ensure_promotions_and_mrps
        await ensure_promotions_and_mrps()
    await audit(user, "settings.update", "settings", "site", str(patch))
    s = await db.settings.find_one({"id": "site"}) or {}
    out = SettingsOut(**clean_doc(s))
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    if kid.startswith("rzp_live_"):
        out.razorpay_state = "ready_live"
    elif kid:
        out.razorpay_state = "ready_test_mode"
    else:
        out.razorpay_state = "pending_keys"
    return out


@router.get("/admin/audit", dependencies=[])
async def audit_log(
    limit: int = 100,
    q: Optional[str] = None,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN))
):
    import re
    query: dict = {}
    if action:
        query["action"] = {"$regex": f"^{re.escape(action)}", "$options": "i"}
    if entity:
        query["entity"] = entity
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"action": rx}, {"entity": rx}, {"actor_email": rx}, {"detail": rx}, {"entity_id": rx}]
    docs = await db.audit_log.find(query).sort("created_at", -1).to_list(min(limit, 500))
    return [{"id": d["id"], "actor_email": d.get("actor_email"), "action": d["action"], "entity": d["entity"],
             "entity_id": d["entity_id"], "detail": d.get("detail", ""), "created_at": d["created_at"]} for d in docs]


@router.get("/admin/rewards", dependencies=[])
async def rewards_list(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.reward_ledger.find({}).sort("created_at", -1).to_list(300)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/rewards/{rid}")
async def reward_update(rid: str, input: dict, user=Depends(require_role(OWNER))):
    status = input.get("status")
    if status not in ("approved", "reversed", "paid"):
        raise HTTPException(status_code=422, detail="status must be approved | reversed | paid")
    doc = await db.reward_ledger.find_one_and_update({"id": rid}, {"$set": {"status": status, "resolved_by": user["email"], "resolved_at": now_utc()}})
    if not doc:
        raise HTTPException(status_code=404, detail="Reward entry not found")
    await audit(user, "reward.update", "reward", rid, f"-> {status} (manual bank transfer confirmation; no payout integration)")
    return {"ok": True, "status": status}


@router.get("/admin/affiliates", dependencies=[])
async def affiliates_list(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.affiliates.find({}).sort("created_at", -1).to_list(200)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/affiliates/{aid}")
async def affiliate_update(aid: str, input: dict, user=Depends(require_role(OWNER, ADMIN))):
    status = input.get("status")
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be approved | rejected")
    doc = await db.affiliates.find_one_and_update({"id": aid}, {"$set": {"status": status}})
    if not doc:
        raise HTTPException(status_code=404, detail="Affiliate application not found")
    if status == "approved":
        await db.users.update_one({"id": doc["user_id"]}, {"$addToSet": {"roles": "affiliate"}})
    await audit(user, "affiliate.update", "affiliate", aid, f"-> {status}")
    return {"ok": True, "status": status}
