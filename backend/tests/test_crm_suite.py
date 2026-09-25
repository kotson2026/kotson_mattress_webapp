"""Test suite for Kotson CRM Master Admin + Manager + Employee CRM."""

import pytest
import httpx

BASE = "http://127.0.0.1:8001/api"


@pytest.fixture
async def owner_client():
    client = httpx.AsyncClient(base_url=BASE, timeout=15.0)
    resp = await client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
    assert resp.status_code == 200, f"Owner login failed: {resp.text}"
    yield client
    await client.aclose()


@pytest.mark.anyio
async def test_crm_test_data_seed_and_purge(owner_client: httpx.AsyncClient):
    # 1. Seed realistic test data
    resp_seed = await owner_client.post("/crm/test-data/seed")
    assert resp_seed.status_code == 200
    data = resp_seed.json()
    assert data["staff_seeded"] >= 5
    assert data["pipelines_seeded"] >= 5
    assert data["leads_seeded"] >= 20

    # 2. Check test data status
    resp_stat = await owner_client.get("/crm/test-data/status")
    assert resp_stat.status_code == 200
    assert resp_stat.json()["is_test_data_active"] is True

    # 3. Check analytics KPI row 1, 2, 3
    resp_kpis = await owner_client.get("/crm/analytics/dashboard-kpis?range=last_30_days")
    assert resp_kpis.status_code == 200
    kpis = resp_kpis.json()
    assert "kpi_row_1" in kpis
    assert "kpi_row_2" in kpis
    assert "kpi_row_3" in kpis
    assert len(kpis["leads_by_stage"]) > 0

    # 4. Check user trends
    resp_trends = await owner_client.get("/crm/analytics/trends?range=last_30_days")
    assert resp_trends.status_code == 200
    trends = resp_trends.json()
    assert "summary" in trends
    assert "calls_by_employee" in trends

    # 5. Check attendance stats
    resp_att = await owner_client.get("/crm/workforce/stats")
    assert resp_att.status_code == 200
    att_stats = resp_att.json()
    assert att_stats["clocked_in"] >= 1
    assert att_stats["on_break"] >= 1

    # 6. Check leave requests
    resp_leave = await owner_client.get("/crm/leave/requests")
    assert resp_leave.status_code == 200
    assert len(resp_leave.json()) >= 3


@pytest.mark.anyio
async def test_crm_leads_pagination_and_export(owner_client: httpx.AsyncClient):
    # Test paginated leads list
    resp = await owner_client.get("/crm/leads?page=1&page_size=10")
    assert resp.status_code == 200
    body = resp.json()
    assert "total" in body
    assert "rows" in body
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert len(body["rows"]) <= 10

    # Test export leads CSV
    resp_export = await owner_client.get("/crm/leads/export")
    assert resp_export.status_code == 200
    assert "text/csv" in resp_export.headers.get("content-type", "")
    assert "Lead Number,Name" in resp_export.text


@pytest.mark.anyio
async def test_crm_order_conversion(owner_client: httpx.AsyncClient):
    # Fetch a lead to convert
    leads_resp = await owner_client.get("/crm/leads?limit=5")
    assert leads_resp.status_code == 200
    leads = leads_resp.json()["rows"]
    assert len(leads) > 0
    target_lead = leads[0]

    # Convert order
    convert_resp = await owner_client.post(f"/crm/leads/{target_lead['id']}/convert-order", json={
        "items": [{"product_name": "Ortho Therapy Mattress", "qty": 1, "unit_price": 7400000}],
        "address": {
            "full_name": target_lead["name"],
            "phone": target_lead.get("phone") or "9999999999",
            "email": target_lead.get("email") or "customer@example.com",
            "line1": "123 Green Avenue",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001"
        },
        "payment_method": "upi",
        "notes": "Direct telephone conversion"
    })
    assert convert_resp.status_code == 200
    res = convert_resp.json()
    assert "order_id" in res
    assert "order_number" in res

    # Verify order is saved in Kotson order system with sales_source = CRM
    order_resp = await owner_client.get(f"/orders/{res['order_id']}")
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    assert order_data["sales_source"] == "CRM"
