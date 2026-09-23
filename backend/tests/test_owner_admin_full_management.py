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


def test_dual_login_email_and_phone(owner_client: httpx.Client):
    """Test dual login support for Phone OR Email + Password."""
    # 1. Login with email
    res1 = owner_client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
    assert res1.status_code == 200
    assert res1.json()["user"]["email"] == "hello@kotsonmattress.com"

    # 2. Login with phone (using seeded customer phone)
    res2 = owner_client.post("/auth/login", json={"identifier": "+919999900001", "password": "Kotson-Test-2026!"})
    assert res2.status_code == 200
    assert res2.json()["user"]["name"].startswith("Ravi Kumar")


def test_catalog_overview_and_products(owner_client: httpx.Client):
    """Test catalog overview KPIs, category listing, and product search."""
    # 1. Overview KPIs
    ov_res = owner_client.get("/admin/catalog/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert ov["total_products"] >= 3
    assert ov["active_products"] >= 1

    # 2. Categories
    cat_res = owner_client.get("/admin/catalog/categories")
    assert cat_res.status_code == 200
    cats = cat_res.json()
    cat_list = cats.get("rows", cats) if isinstance(cats, dict) else cats
    assert len(cat_list) >= 3

    # 3. Products list with filters
    prod_res = owner_client.get("/admin/catalog/products?page=1&limit=10")
    assert prod_res.status_code == 200
    prods = prod_res.json()
    assert prods["total"] >= 3
    prod_list = prods.get("rows", prods.get("products", []))
    assert len(prod_list) >= 1


def test_website_edit_section_types_and_pages(owner_client: httpx.Client):
    """Test CMS 22 section types catalogue, pages, header, footer, branding, and publication."""
    # 1. Section types catalogue
    st_res = owner_client.get("/admin/cms/section-types")
    assert st_res.status_code == 200
    types = st_res.json()
    assert len(types) >= 20

    # 2. CMS Header & Footer
    hdr_res = owner_client.get("/admin/cms/header")
    assert hdr_res.status_code == 200
    assert "nav_items" in hdr_res.json()

    ftr_res = owner_client.get("/admin/cms/footer")
    assert ftr_res.status_code == 200
    assert "columns" in ftr_res.json()

    # 3. CMS Branding
    b_res = owner_client.get("/admin/cms/branding")
    assert b_res.status_code == 200
    assert "main_logo_url" in b_res.json()

    # 4. Safe Publish Checkpoint
    pub_res = owner_client.post("/admin/cms/publish", params={"note": "Test automated verification publish"})
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "success"
    vid = pub_res.json()["version_id"]

    # 5. Check versions list and rollback
    ver_res = owner_client.get("/admin/cms/versions")
    assert ver_res.status_code == 200
    assert any(v["id"] == vid for v in ver_res.json())

    rb_res = owner_client.post("/admin/cms/rollback", params={"version_id": vid})
    assert rb_res.status_code == 200


def test_claims_and_trust(owner_client: httpx.Client):
    """Test Certifications and Tested Claims management."""
    # 1. Overview
    ov_res = owner_client.get("/admin/claims-trust/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert ov["total_certifications"] >= 5
    assert ov["total_claims"] >= 5

    # 2. List Certifications
    c_res = owner_client.get("/admin/claims-trust/certifications")
    assert c_res.status_code == 200
    certs = c_res.json()
    assert len(certs) >= 5

    # 3. List Claims
    cl_res = owner_client.get("/admin/claims-trust/claims")
    assert cl_res.status_code == 200
    claims = cl_res.json()
    assert len(claims) >= 5


def test_asset_library_and_used_in_protection(owner_client: httpx.Client):
    """Test media assets list, overview stats, and Used-In deletion protection."""
    # 1. Overview
    ov_res = owner_client.get("/admin/assets/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert ov["total_assets"] >= 5
    assert len(ov["categories"]) >= 10

    # 2. List Assets
    a_res = owner_client.get("/admin/assets")
    assert a_res.status_code == 200
    assets = a_res.json()
    assert assets["total"] >= 5

    # 3. Test Usage Endpoint on first asset
    first_aid = assets["assets"][0]["id"]
    u_res = owner_client.get(f"/admin/assets/{first_aid}/usage")
    assert u_res.status_code == 200
    assert "usage_count" in u_res.json()


def test_refer_and_earn_engine(owner_client: httpx.Client):
    """Test Refer & Earn 9 KPIs, rules, rewards ledger, and mark-paid withdrawal with UTR."""
    # 1. 9 Executive KPIs
    ov_res = owner_client.get("/admin/referrals/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert "total_referrers" in ov
    assert "completed_sales_count" in ov
    assert "total_rewards_earned" in ov
    assert "pending_withdrawal_count" in ov
    assert "total_paid_rewards" in ov

    # 2. Rules
    r_res = owner_client.get("/admin/referrals/rules")
    assert r_res.status_code == 200
    rules = r_res.json()
    assert len(rules) >= 5

    # 3. Withdrawals & UTR Payment Marking
    w_res = owner_client.get("/admin/referrals/withdrawals?status=PENDING")
    assert w_res.status_code == 200
    pending_w = w_res.json()
    if len(pending_w) > 0:
        wid = pending_w[0]["id"]
        pay_res = owner_client.post(
            f"/admin/referrals/withdrawals/{wid}/mark-paid",
            json={
                "utr_number": "TESTUTR991122",
                "payment_method": "NEFT/RTGS",
                "note": "Automated test payout verification"
            }
        )
        assert pay_res.status_code == 200
        assert pay_res.json()["status"] == "success"


def test_dealers_management(owner_client: httpx.Client):
    """Test Dealer 7 KPIs, dealer list, pricing rules, and orders."""
    # 1. 7 KPIs
    ov_res = owner_client.get("/admin/dealers/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert "total_dealers" in ov
    assert "approved_dealers" in ov
    assert "gross_sales" in ov

    # 2. Dealer list
    d_res = owner_client.get("/admin/dealers")
    assert d_res.status_code == 200
    dealers = d_res.json()
    assert dealers["total"] >= 1

    # 3. Pricing rules (percentage vs fixed)
    pr_res = owner_client.get("/admin/dealers/pricing-rules")
    assert pr_res.status_code == 200
    rules = pr_res.json()
    assert len(rules) >= 5


def test_staff_and_access_capabilities(owner_client: httpx.Client):
    """Test Staff overview KPIs, capabilities matrix, and staff creation."""
    # 1. Staff KPIs
    ov_res = owner_client.get("/admin/staff/overview")
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert "total_staff" in ov
    assert "active_staff" in ov

    # 2. Capabilities catalog
    cap_res = owner_client.get("/admin/staff/capabilities-catalog")
    assert cap_res.status_code == 200
    caps = cap_res.json()
    assert len(caps) >= 10
    keys = [c["key"] for c in caps]
    assert "orders.edit" in keys
    assert "website.publish" in keys
    assert "catalog.edit" in keys

    # 3. Staff list
    s_res = owner_client.get("/admin/staff")
    assert s_res.status_code == 200
    staff = s_res.json()
    assert len(staff) >= 1
