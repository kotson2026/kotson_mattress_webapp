"""Test suite for Kotson Owner Admin Console Phase 2:
Dashboard, Sales & Revenue, and Orders (with manual sale and category counting)."""

import pytest
import httpx
from datetime import datetime, timezone

BASE = "http://127.0.0.1:8001/api"


@pytest.fixture
async def owner_client():
    client = httpx.AsyncClient(base_url=BASE, timeout=15.0)
    # Login as owner
    resp = await client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
    assert resp.status_code == 200, f"Owner login failed: {resp.text}"
    yield client
    await client.aclose()


@pytest.mark.anyio
async def test_dashboard_and_category_order_counting(owner_client: httpx.AsyncClient):
    # 1. Fetch dashboard with default 'month'
    resp = await owner_client.get("/admin/dashboard?preset=month")
    assert resp.status_code == 200
    data = resp.json()

    assert "product_orders" in data
    assert "customer_activity" in data
    assert "dealer_network" in data
    assert "low_stock" in data

    po = data["product_orders"]
    assert "mattress_orders" in po
    assert "pillow_orders" in po
    assert "topper_orders" in po
    assert "baby_kids_orders" in po

    # Verify low stock items have stock_status correctly calculated
    for ls in data["low_stock"]:
        assert ls["free_stock"] <= 5
        if ls["free_stock"] <= 0:
            assert ls["stock_status"] == "OUT OF STOCK"
        elif ls["free_stock"] <= 2:
            assert ls["stock_status"] == "CRITICAL"
        else:
            assert ls["stock_status"] == "LOW STOCK"


@pytest.mark.anyio
async def test_manual_sale_creation_and_inventory(owner_client: httpx.AsyncClient):
    # 1. Fetch catalog to get variant id and current stock
    prod_resp = await owner_client.get("/admin/products")
    assert prod_resp.status_code == 200
    products = prod_resp.json()
    assert len(products) > 0

    # Pick a variant with free stock
    chosen_variant = None
    for p in products:
        for v in p.get("variants", []):
            free = v.get("stock", 0) - v.get("reserved", 0)
            if free >= 2:
                chosen_variant = v
                break
        if chosen_variant:
            break

    assert chosen_variant is not None, "Need at least one variant with free stock"
    initial_stock = chosen_variant["stock"]

    # 2. Create a manual in-store walk-in sale
    manual_payload = {
        "customer_name": "Suresh Store Customer",
        "mobile": "9876543210",
        "email": "suresh.walkin@example.com",
        "order_source": "WALK_IN",
        "employee_id": None,
        "items": [
            {
                "variant_id": chosen_variant["id"],
                "qty": 1,
                "unit_price": chosen_variant["price"],
                "discount": 50000,  # 500 INR in paise
            }
        ],
        "payment_method": "cash",
        "payment_status": "paid",
        "manual_payment_ref": "CASH-REC-1092",
        "address": {
            "full_name": "Suresh Store Customer",
            "phone": "9876543210",
            "line1": "Store Counter 1",
            "city": "Hyderabad",
            "district": "Hyderabad",
            "state": "Telangana",
            "pincode": "500081",
        }
    }

    create_resp = await owner_client.post("/admin/orders/manual", json=manual_payload)
    assert create_resp.status_code == 201, f"Failed to create manual sale: {create_resp.text}"
    created_order = create_resp.json()

    assert created_order["order_source"] == "WALK_IN"
    assert created_order["order_channel"] == "ADMIN_MANUAL"
    assert created_order["payment_verification_source"] == "ADMIN_RECORDED"
    assert created_order["payment_status"] == "paid"
    assert created_order["fulfilment_status"] == "processing"
    assert created_order["amounts"]["discount"] == 50000

    # 3. Verify variant stock decreased by 1
    prod_resp2 = await owner_client.get("/admin/products")
    products2 = prod_resp2.json()
    new_v = None
    for p in products2:
        for v in p.get("variants", []):
            if v["id"] == chosen_variant["id"]:
                new_v = v
                break
    assert new_v["stock"] == initial_stock - 1, f"Stock did not decrement: before {initial_stock}, after {new_v['stock']}"


@pytest.mark.anyio
async def test_sales_and_revenue_summary(owner_client: httpx.AsyncClient):
    resp = await owner_client.get("/admin/sales/summary?preset=month")
    assert resp.status_code == 200
    data = resp.json()

    # Check 2 rows of KPIs
    assert "net_revenue_paise" in data
    assert "gross_sales_paise" in data
    assert "paid_orders" in data
    assert "retail_paid_orders" in data
    assert "dealer_paid_orders" in data
    assert "walkin_paid_orders" in data
    assert "avg_order_value_paise" in data
    assert "new_registrations" in data
    assert "refunds_reversals_paise" in data
    assert "cancelled_orders" in data
    assert "failed_payments" in data

    # Check breakdowns
    assert "sales_by_source" in data
    assert len(data["sales_by_source"]) >= 6
    assert "sales_by_category" in data
    assert len(data["sales_by_category"]) >= 4
    assert "sales_by_location" in data
    assert "trend" in data


@pytest.mark.anyio
async def test_orders_filtering_and_pagination(owner_client: httpx.AsyncClient):
    # 1. Fetch paginated orders
    resp = await owner_client.get("/admin/orders?page=1&page_size=10")
    assert resp.status_code == 200
    data = resp.json()

    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "orders" in data
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert isinstance(data["orders"], list)

    # 2. Filter by sales_source = WALK_IN
    walkin_resp = await owner_client.get("/admin/orders?sales_source=WALK_IN")
    assert walkin_resp.status_code == 200
    walkin_data = walkin_resp.json()
    assert walkin_data["total"] >= 1
    for o in walkin_data["orders"]:
        assert o["order_source"] == "WALK_IN"

    # 3. Test locations cascade
    loc_resp = await owner_client.get("/admin/locations/cascade")
    assert loc_resp.status_code == 200
    loc_data = loc_resp.json()
    assert "states" in loc_data
