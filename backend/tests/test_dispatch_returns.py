import pytest
import httpx

BASE = "http://127.0.0.1:8001/api"


@pytest.fixture
def owner_client():
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        resp = client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
        assert resp.status_code == 200, f"Owner login failed: {resp.text}"
        seed_resp = client.post("/admin/test-data/seed")
        assert seed_resp.status_code == 200
        yield client


def test_dispatch_overview_and_real_sla(owner_client: httpx.Client):
    """Test overview operational KPI counts and dynamic SLA calculation."""
    res = owner_client.get("/admin/dispatch/overview")
    assert res.status_code == 200
    data = res.json()

    assert data["awaiting_dispatch"] >= 5
    assert data["ready_to_pack"] >= 1
    assert data["packed"] >= 5
    assert data["in_transit"] >= 5
    assert data["delivered"] >= 5
    assert data["delivery_exceptions"] >= 4
    assert data["return_requests"] >= 1
    assert data["trial_requests"] >= 1

    # Real SLA: target_hours exists, adherence percentage computed from real orders
    sla = data["sla"]
    assert sla["target_hours"] == 24
    assert sla["orders_measured"] >= 5
    assert sla["adherence_percentage"] is not None
    assert "% SLA adherence" in sla["status_text"]


def test_dispatch_orders_queue_and_store_pickup_exclusion(owner_client: httpx.Client):
    """Test orders queue tabs, pagination, and verify store takeaways are excluded from awaiting dispatch."""
    # 1. Check awaiting dispatch orders
    all_res = owner_client.get("/admin/dispatch/orders?tab=awaiting_dispatch&page=1&limit=10")
    assert all_res.status_code == 200
    all_data = all_res.json()
    assert "rows" in all_data
    assert all_data["total"] >= 5

    # Check store pickups are strictly NOT in the awaiting dispatch queue
    for o in all_data["rows"]:
        assert o.get("fulfilment_method") != "STORE_PICKUP"

    # 2. Check other tabs
    tabs = ["ready_to_pack", "packed", "in_transit", "delivered", "exceptions"]
    for tab in tabs:
        res = owner_client.get(f"/admin/dispatch/orders?tab={tab}&page=1&limit=10")
        assert res.status_code == 200, f"Failed for tab {tab}: {res.text}"
        d = res.json()
        assert d["total"] >= 1, f"Expected records in tab {tab}"


def test_fulfilment_workflow_pack_and_shipment(owner_client: httpx.Client):
    """Test workflow: pack an order, create a shipment with AWB, update status, and log an exception."""
    # Find an order in ready_to_pack
    r = owner_client.get("/admin/dispatch/orders?tab=ready_to_pack&page=1&limit=5")
    assert r.status_code == 200
    orders = r.json()["rows"]
    assert len(orders) > 0
    test_order = orders[0]
    oid = test_order["order_id"]

    # 1. Pack order
    pack_res = owner_client.post(
        f"/admin/dispatch/orders/{oid}/pack",
        json={
            "package_count": 2,
            "package_weight_kg": 34.5,
            "package_dimensions": "198x182x25 cm",
            "packing_notes": "Corner edge guards and moisture shrink wrap applied.",
            "warehouse_id": "WH-01",
        },
    )
    assert pack_res.status_code == 200
    pack_data = pack_res.json()
    assert pack_data["ok"] is True

    # 2. Assign carrier and create shipment
    ship_res = owner_client.post(
        f"/admin/dispatch/orders/{oid}/shipment",
        json={
            "carrier": "BlueDart Surface Logistics",
            "awb_number": "BD-TEST-998877",
            "notes": "Expedited surface linehaul dispatch",
        },
    )
    assert ship_res.status_code == 201
    ship_data = ship_res.json()
    shipment_id = ship_data["id"]

    # 3. Update milestone
    stat_res = owner_client.patch(
        f"/admin/dispatch/shipments/{shipment_id}/status",
        json={
            "status": "OUT_FOR_DELIVERY",
            "location": "Gurugram Delivery Hub",
            "notes": "Van loaded for delivery run",
        },
    )
    assert stat_res.status_code == 200
    assert stat_res.json()["status"] == "OUT_FOR_DELIVERY"

    # 4. Record exception
    exc_res = owner_client.post(
        f"/admin/dispatch/shipments/{shipment_id}/exception",
        json={
            "issue_type": "CUSTOMER_UNAVAILABLE",
            "assigned_to": "Customer Care Desk 2",
            "notes": "Customer requested redelivery tomorrow 10am.",
        },
    )
    assert exc_res.status_code == 200
    assert exc_res.json()["ok"] is True


def test_returns_and_qc_inspection_lifecycle(owner_client: httpx.Client):
    """Test return claim listing, QC inspection pass, restock to inventory, and refund recording."""
    ret_res = owner_client.get("/admin/dispatch/returns?page=1&limit=10")
    assert ret_res.status_code == 200
    ret_data = ret_res.json()
    assert ret_data["total"] >= 1
    unrestocked = [r for r in ret_data["rows"] if not r.get("restocked")]
    assert len(unrestocked) > 0
    ret = unrestocked[0]
    rid = ret["id"]

    # 1. Perform QC inspection
    qc_res = owner_client.post(
        f"/admin/dispatch/returns/{rid}/inspect",
        json={
            "condition": "good",
            "decision": "restock",
            "inspection_notes": "Cover sanitized, zero stains, core resilience tested normal.",
        },
    )
    assert qc_res.status_code == 200
    assert qc_res.json()["status"] == "inspected"

    # 2. Authorize restock
    restock_res = owner_client.post(f"/admin/dispatch/returns/{rid}/restock")
    assert restock_res.status_code == 200
    assert restock_res.json()["ok"] is True

    # 3. Process refund
    refund_res = owner_client.post(
        f"/admin/dispatch/returns/{rid}/refund",
        json={
            "amount_paise": 2500000,
            "refund_type": "full",
            "refund_method": "gateway",
            "notes": "Standard customer return refund",
        },
    )
    assert refund_res.status_code == 200
    assert refund_res.json()["ok"] is True


def test_100_night_trials_and_carrier_master(owner_client: httpx.Client):
    """Test 100-night trial calculation (delivery date delta) and carrier master endpoints."""
    # Trials
    t_res = owner_client.get("/admin/dispatch/trials?page=1&limit=10")
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert t_data["total"] >= 1
    trial = t_data["rows"][0]
    assert "days_used" in trial
    assert "days_remaining" in trial
    assert trial["days_used"] + trial["days_remaining"] == 100

    # Carriers
    c_res = owner_client.get("/admin/dispatch/carriers")
    assert c_res.status_code == 200
    carriers = c_res.json()["rows"]
    assert len(carriers) >= 5
    codes = [c["code"] for c in carriers]
    assert "BLUEDART" in codes
    assert "DELHIVERY" in codes
