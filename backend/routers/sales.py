"""Sales and revenue analytics endpoint with date filters, source & buyer_type split, trend analysis, category/location breakdown, and export."""

import csv
import io
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lib.db import db
from lib.security import (
    ADMIN,
    CRM_MASTER,
    OWNER,
    require_role,
)

router = APIRouter()


class SalesSummaryResponse(BaseModel):
    preset: str
    date_from: str
    date_to: str
    buyer_type: str
    sales_source: str
    category: str
    # Row 1 KPIs
    net_revenue_paise: int
    gross_sales_paise: int
    paid_orders: int
    retail_paid_orders: int
    dealer_paid_orders: int
    walkin_paid_orders: int
    avg_order_value_paise: int
    dealer_sales_paise: int
    retail_sales_paise: int
    # Row 2 KPIs
    new_registrations: int
    refunds_reversals_paise: int
    cancelled_orders: int
    failed_payments: int
    total_dealer_volume: int
    manual_walkin_sales_paise: int
    # Breakdowns & Trends
    trend: list[dict] = []
    sales_by_source: list[dict] = []
    sales_by_category: list[dict] = []
    sales_by_location: list[dict] = []
    recent_transactions: list[dict] = []


def calculate_sales_date_range(preset: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> tuple[datetime, datetime, str]:
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


@router.get("/admin/sales/summary", response_model=SalesSummaryResponse)
async def admin_sales_summary(
    preset: str = Query("month", description="today | yesterday | week | month | last_month | custom"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    buyer_type: Optional[str] = Query("ALL", description="ALL | CUSTOMER | DEALER"),
    sales_source: Optional[str] = Query("ALL", description="ALL | DIRECT_WEBSITE | WEB_REFERRAL | DEALER | EMPLOYEE_ASSISTED | WALK_IN | MANUAL_OTHER"),
    state: Optional[str] = None,
    district: Optional[str] = None,
    category: Optional[str] = Query("ALL", description="ALL | mattresses | pillows | toppers | baby-kids"),
    user=Depends(require_role(OWNER, ADMIN, CRM_MASTER)),
):
    start_dt, end_dt, tzname = calculate_sales_date_range(preset, date_from, date_to)

    base_query: dict = {
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }

    if buyer_type and buyer_type.upper() in ("CUSTOMER", "DEALER"):
        base_query["buyer_type"] = buyer_type.upper()

    if sales_source and sales_source != "ALL":
        base_query["order_source"] = sales_source

    if state and state != "ALL":
        base_query["address.state"] = {"$regex": f"^{state.strip()}$", "$options": "i"}

    if district and district != "ALL":
        base_query["address.district"] = {"$regex": f"^{district.strip()}$", "$options": "i"}

    if category and category != "ALL":
        cat_prods = await db.products.find({"category_slug": category.strip().lower()}).to_list(100)
        p_ids = [p["id"] for p in cat_prods]
        base_query["items.product_id"] = {"$in": p_ids}

    # Query all orders in range
    orders_cursor = db.orders.find(base_query).sort("created_at", -1)
    orders = await orders_cursor.to_list(5000)

    # Products catalog for category resolution
    all_products = await db.products.find({}).to_list(500)
    prod_cat_map = {p["id"]: (p.get("category_slug") or "").lower() for p in all_products}

    gross_sales_paise = 0
    discount_paise = 0
    refunds_paise = 0
    paid_count = 0
    retail_paid_count = 0
    dealer_paid_count = 0
    walkin_paid_count = 0
    retail_sales_paise = 0
    dealer_sales_paise = 0
    manual_walkin_sales_paise = 0
    total_dealer_volume = 0
    cancelled_count = 0
    failed_count = 0

    # Trend buckets
    trend_buckets: dict[str, dict] = {}
    is_hourly = preset in ("today", "yesterday") or (end_dt - start_dt).total_seconds() <= 86400

    # Source breakdown buckets
    sources_stats: dict[str, dict] = {
        "DIRECT_WEBSITE": {"label": "Direct Website", "orders": 0, "revenue_paise": 0},
        "WEB_REFERRAL": {"label": "Website + Referral", "orders": 0, "revenue_paise": 0},
        "DEALER": {"label": "Dealer", "orders": 0, "revenue_paise": 0},
        "EMPLOYEE_ASSISTED": {"label": "Employee Assisted", "orders": 0, "revenue_paise": 0},
        "WALK_IN": {"label": "Walk-in / Store", "orders": 0, "revenue_paise": 0},
        "MANUAL_OTHER": {"label": "Manual / Other", "orders": 0, "revenue_paise": 0},
    }

    # Category breakdown buckets
    category_stats: dict[str, dict] = {
        "mattresses": {"label": "Mattresses", "orders": 0, "units": 0, "revenue_paise": 0},
        "pillows": {"label": "Pillows", "orders": 0, "units": 0, "revenue_paise": 0},
        "toppers": {"label": "Toppers", "orders": 0, "units": 0, "revenue_paise": 0},
        "baby-kids": {"label": "Baby + Kids", "orders": 0, "units": 0, "revenue_paise": 0},
        "other": {"label": "Other", "orders": 0, "units": 0, "revenue_paise": 0},
    }

    # Location breakdown buckets: state -> district
    location_stats: dict[str, dict] = {}
    recent_transactions: list[dict] = []

    for o in orders:
        pmt_status = o.get("payment_status", "pending")
        fulfil_status = o.get("fulfilment_status", "")
        b_type = o.get("buyer_type", "CUSTOMER")
        src = o.get("order_source") or ("WEB_REFERRAL" if o.get("referral_code") else "DIRECT_WEBSITE")
        amounts = o.get("amounts") or {}
        total = int(amounts.get("total", 0))
        discount = int(amounts.get("discount", 0))
        items = o.get("items") or []
        created_dt = o.get("sale_date") or o.get("created_at")

        if fulfil_status == "cancelled":
            cancelled_count += 1
        if pmt_status == "failed":
            failed_count += 1

        if pmt_status == "refunded":
            refunds_paise += total

        if pmt_status == "paid":
            gross_sales_paise += total
            discount_paise += discount
            paid_count += 1

            if b_type == "DEALER" or src == "DEALER":
                dealer_paid_count += 1
                dealer_sales_paise += total
                total_dealer_volume += sum(int(it.get("qty", 1)) for it in items)
            else:
                retail_paid_count += 1
                retail_sales_paise += total

            if src == "WALK_IN" or o.get("order_channel") == "ADMIN_MANUAL":
                walkin_paid_count += 1
                manual_walkin_sales_paise += total

            # Source bucket
            src_key = src if src in sources_stats else "MANUAL_OTHER"
            sources_stats[src_key]["orders"] += 1
            sources_stats[src_key]["revenue_paise"] += total

            # Trend bucket
            if hasattr(created_dt, "strftime"):
                if is_hourly:
                    bucket_key = created_dt.strftime("%H:00")
                else:
                    bucket_key = created_dt.strftime("%Y-%m-%d")
            else:
                bucket_key = str(created_dt)[:10]

            if bucket_key not in trend_buckets:
                trend_buckets[bucket_key] = {"time_label": bucket_key, "revenue_paise": 0, "orders_count": 0}
            trend_buckets[bucket_key]["revenue_paise"] += total
            trend_buckets[bucket_key]["orders_count"] += 1

            # Category bucket
            cats_in_order = set()
            for it in items:
                cat = prod_cat_map.get(it.get("product_id"), "")
                cat_key = cat if cat in category_stats else ("baby-kids" if "baby" in cat or "kids" in cat else "other")
                qty = int(it.get("qty", 1))
                line_rev = int(it.get("line_total", 0))
                category_stats[cat_key]["units"] += qty
                category_stats[cat_key]["revenue_paise"] += line_rev
                cats_in_order.add(cat_key)
            for c in cats_in_order:
                category_stats[c]["orders"] += 1

            # Location bucket
            addr = o.get("address") or {}
            st = addr.get("state") or "Unspecified"
            dist = addr.get("district") or addr.get("city") or "General"
            loc_key = f"{st}|{dist}"
            if loc_key not in location_stats:
                location_stats[loc_key] = {"state": st, "district": dist, "orders": 0, "revenue_paise": 0}
            location_stats[loc_key]["orders"] += 1
            location_stats[loc_key]["revenue_paise"] += total

            recent_transactions.append({
                "id": o.get("id"),
                "order_number": o.get("order_number"),
                "date": created_dt.isoformat() if hasattr(created_dt, "isoformat") else str(created_dt),
                "customer_name": addr.get("full_name") or o.get("email"),
                "email": o.get("email"),
                "products_summary": ", ".join(f"{it.get('product_name')} x{it.get('qty')}" for it in items),
                "sales_source": src,
                "amount_paise": total,
                "payment_status": pmt_status,
                "fulfilment_status": fulfil_status,
                "city": addr.get("city", ""),
                "state": addr.get("state", ""),
            })

    # Query refunds from db.refunds
    refunds_cursor = db.refunds.find({"created_at": {"$gte": start_dt, "$lte": end_dt}})
    refund_docs = await refunds_cursor.to_list(500)
    for ref in refund_docs:
        refunds_paise += int(ref.get("amount", 0))

    net_revenue_paise = max(0, gross_sales_paise - discount_paise - refunds_paise)
    avg_order_value_paise = (net_revenue_paise // paid_count) if paid_count > 0 else 0

    # New Customer Registrations in range
    new_customers_count = await db.users.count_documents({
        "roles": "customer",
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    })

    # Prepare Sources with percentages
    total_src_rev = sum(s["revenue_paise"] for s in sources_stats.values())
    sales_by_source_list = []
    for k, v in sources_stats.items():
        pct = round((v["revenue_paise"] / total_src_rev * 100), 1) if total_src_rev > 0 else 0.0
        sales_by_source_list.append({
            "source_key": k,
            "label": v["label"],
            "orders": v["orders"],
            "revenue_paise": v["revenue_paise"],
            "percentage": pct,
        })

    # Prepare Category List
    sales_by_category_list = [
        {"category_key": k, "label": v["label"], "orders": v["orders"], "units": v["units"], "revenue_paise": v["revenue_paise"]}
        for k, v in category_stats.items()
    ]

    # Prepare Location List sorted by revenue
    sales_by_location_list = sorted(list(location_stats.values()), key=lambda x: x["revenue_paise"], reverse=True)[:50]

    # Prepare Trend List sorted by time
    trend_list = sorted(list(trend_buckets.values()), key=lambda x: x["time_label"])

    return SalesSummaryResponse(
        preset=preset,
        date_from=start_dt.isoformat(),
        date_to=end_dt.isoformat(),
        buyer_type=buyer_type or "ALL",
        sales_source=sales_source or "ALL",
        category=category or "ALL",
        net_revenue_paise=net_revenue_paise,
        gross_sales_paise=gross_sales_paise,
        paid_orders=paid_count,
        retail_paid_orders=retail_paid_count,
        dealer_paid_orders=dealer_paid_count,
        walkin_paid_orders=walkin_paid_count,
        avg_order_value_paise=avg_order_value_paise,
        dealer_sales_paise=dealer_sales_paise,
        retail_sales_paise=retail_sales_paise,
        new_registrations=new_customers_count,
        refunds_reversals_paise=refunds_paise,
        cancelled_orders=cancelled_count,
        failed_payments=failed_count,
        total_dealer_volume=total_dealer_volume,
        manual_walkin_sales_paise=manual_walkin_sales_paise,
        trend=trend_list,
        sales_by_source=sales_by_source_list,
        sales_by_category=sales_by_category_list,
        sales_by_location=sales_by_location_list,
        recent_transactions=recent_transactions[:100],
    )


@router.get("/admin/sales/export")
async def export_sales_report(
    preset: str = Query("month"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    buyer_type: Optional[str] = "ALL",
    sales_source: Optional[str] = "ALL",
    state: Optional[str] = None,
    district: Optional[str] = None,
    category: Optional[str] = "ALL",
    user=Depends(require_role(OWNER, ADMIN, CRM_MASTER)),
):
    """Exports financial sales records matching all active filters."""
    start_dt, end_dt, _ = calculate_sales_date_range(preset, date_from, date_to)

    base_query: dict = {
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }
    if buyer_type and buyer_type.upper() in ("CUSTOMER", "DEALER"):
        base_query["buyer_type"] = buyer_type.upper()
    if sales_source and sales_source != "ALL":
        base_query["order_source"] = sales_source
    if state and state != "ALL":
        base_query["address.state"] = {"$regex": f"^{state.strip()}$", "$options": "i"}
    if district and district != "ALL":
        base_query["address.district"] = {"$regex": f"^{district.strip()}$", "$options": "i"}

    orders = await db.orders.find(base_query).sort("created_at", -1).to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order ID",
        "Order Number",
        "Sale Date",
        "Buyer Type",
        "Sales Source",
        "Order Channel",
        "Customer Name",
        "Email",
        "Phone",
        "City",
        "District",
        "State",
        "Products",
        "Gross Amount (INR)",
        "Discount (INR)",
        "Net Amount (INR)",
        "Payment Method",
        "Payment Status",
        "Fulfilment Status",
    ])

    for o in orders:
        addr = o.get("address") or {}
        amounts = o.get("amounts") or {}
        items = o.get("items") or []
        items_desc = "; ".join(f"{it.get('product_name')} x{it.get('qty')}" for it in items)
        dt = o.get("sale_date") or o.get("created_at")
        dt_str = dt.strftime("%Y-%m-%d %H:%M:%S") if hasattr(dt, "strftime") else str(dt)

        writer.writerow([
            o.get("id"),
            o.get("order_number"),
            dt_str,
            o.get("buyer_type", "CUSTOMER"),
            o.get("order_source", "DIRECT_WEBSITE"),
            o.get("order_channel", "WEBSITE"),
            addr.get("full_name") or o.get("email"),
            o.get("email") or "",
            addr.get("phone") or "",
            addr.get("city") or "",
            addr.get("district") or "",
            addr.get("state") or "",
            items_desc,
            f"{int(amounts.get('subtotal', amounts.get('total', 0))) / 100:.2f}",
            f"{int(amounts.get('discount', 0)) / 100:.2f}",
            f"{int(amounts.get('total', 0)) / 100:.2f}",
            o.get("payment_method") or "online",
            o.get("payment_status"),
            o.get("fulfilment_status"),
        ])

    output.seek(0)
    filename = f"kotson_sales_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
