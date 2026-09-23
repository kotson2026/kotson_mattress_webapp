"""Automated test suite for Kotson Default Test Data & Seed System."""

import pytest
import httpx

BASE = "http://127.0.0.1:8001/api"


@pytest.fixture
async def owner_client():
    client = httpx.AsyncClient(base_url=BASE, timeout=30.0)
    # Login as owner
    resp = await client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
    assert resp.status_code == 200, f"Owner login failed: {resp.text}"
    yield client
    await client.aclose()


@pytest.fixture
async def customer_client():
    client = httpx.AsyncClient(base_url=BASE, timeout=30.0)
    resp = await client.post("/auth/login", json={"email": "rahul.demo@example.com", "password": "Kotson-Customer-2026!"})
    assert resp.status_code == 200
    yield client
    await client.aclose()


@pytest.mark.anyio
async def test_seed_and_authorization(owner_client: httpx.AsyncClient, customer_client: httpx.AsyncClient):
    # 1. Customer cannot seed test data (403)
    resp = await customer_client.post("/admin/test-data/seed")
    assert resp.status_code == 403

    # 2. Owner seeds test data
    resp = await owner_client.post("/admin/test-data/seed")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_seeded"] is True
    assert data["batch_id"] == "KOTSON_DEV_SEED_V1"
    assert data["counts"]["orders"] >= 25
    assert data["counts"]["customers"] >= 5
    assert data["counts"]["dealers"] >= 10
    assert data["counts"]["leads"] >= 20

    # 3. Idempotent: Calling seed again does not double count
    orders_before = data["counts"]["orders"]
    resp2 = await owner_client.post("/admin/test-data/seed")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["counts"]["orders"] == orders_before


@pytest.mark.anyio
async def test_dashboard_with_seeded_data(owner_client: httpx.AsyncClient):
    # Ensure seeded
    await owner_client.post("/admin/test-data/seed")

    # Fetch dashboard with month preset
    resp = await owner_client.get("/admin/dashboard?preset=month")
    assert resp.status_code == 200
    data = resp.json()

    # Product category order counts must be realistic and non-zero
    p_orders = data["product_orders"]
    assert p_orders["mattress_orders"] >= 5
    assert p_orders["pillow_orders"] >= 5
    assert p_orders["topper_orders"] >= 3
    assert p_orders["baby_kids_orders"] >= 3

    # Customer activity must be non-zero
    act = data["customer_activity"]
    assert act["total_signups"] >= 5
    assert act["add_to_cart_users"] >= 1
    assert act["purchased_unique_customers"] >= 5

    # Dealer network
    dlr = data["dealer_network"]
    assert dlr["total_dealers"] >= 5
    assert dlr["pending_approvals"] >= 5
    assert dlr["dealer_sales_paise"] > 0

    # Low stock items must show critical, low stock, and out of stock tiers
    low_stock = data["low_stock"]
    assert len(low_stock) >= 4
    statuses = {item["stock_status"] for item in low_stock}
    assert "OUT OF STOCK" in statuses or "CRITICAL" in statuses or "LOW STOCK" in statuses


@pytest.mark.anyio
async def test_orders_pagination_with_seed(owner_client: httpx.AsyncClient):
    # Ensure seeded
    await owner_client.post("/admin/test-data/seed")

    # Page 1 with limit 10
    r1 = await owner_client.get("/admin/orders?page=1&limit=10")
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["total"] >= 25
    assert len(d1["orders"]) == 10
    assert d1["total_pages"] >= 3

    # Page 2 with limit 10
    r2 = await owner_client.get("/admin/orders?page=2&limit=10")
    assert r2.status_code == 200
    d2 = r2.json()
    assert len(d2["orders"]) == 10

    # Ensure items on page 1 and page 2 are different
    ids_p1 = {o["id"] for o in d1["orders"]}
    ids_p2 = {o["id"] for o in d2["orders"]}
    assert len(ids_p1.intersection(ids_p2)) == 0


@pytest.mark.anyio
async def test_cleanup_and_reset(owner_client: httpx.AsyncClient):
    # 1. Reset test data
    resp = await owner_client.post("/admin/test-data/reset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_seeded"] is True

    # 2. Cleanup test data
    resp_clean = await owner_client.delete("/admin/test-data/cleanup")
    assert resp_clean.status_code == 200
    assert resp_clean.json()["ok"] is True

    # 3. Status check after cleanup
    resp_stat = await owner_client.get("/admin/test-data/status")
    assert resp_stat.status_code == 200
    stat = resp_stat.json()
    assert stat["is_seeded"] is False
    assert stat["counts"]["orders"] == 0
    assert stat["counts"]["customers"] == 0
    assert stat["counts"]["dealers"] == 0

    # 4. Re-seed so development environment has default test data ready
    resp_reseed = await owner_client.post("/admin/test-data/seed")
    assert resp_reseed.status_code == 200
    assert resp_reseed.json()["is_seeded"] is True
