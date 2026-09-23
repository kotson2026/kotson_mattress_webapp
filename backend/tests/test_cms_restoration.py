"""Tests for CMS restoration, section management, and website synchronization."""

import pytest
import httpx

BASE = "http://127.0.0.1:8001/api"


@pytest.fixture
def owner_client():
    with httpx.Client(base_url=BASE, timeout=30.0) as client:
        resp = client.post("/auth/login", json={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
        assert resp.status_code == 200, f"Owner login failed: {resp.text}"
        yield client


def test_cms_migration_and_pages_count(owner_client: httpx.Client):
    """Test CMS migration populates 16 customer-facing pages and 10 homepage sections."""
    # 1. Trigger or verify migration
    mig_res = owner_client.post("/admin/cms/migrate-existing-website")
    assert mig_res.status_code == 200
    assert mig_res.json()["status"] in ("success", "skipped")

    # 2. Check public pages endpoint
    resp = owner_client.get("/cms/pages")
    assert resp.status_code == 200
    pages = resp.json()
    assert len(pages) >= 16

    # Check slugs
    slugs = {p["slug"] for p in pages}
    assert "home" in slugs
    assert "collections" in slugs
    assert "about" in slugs
    assert "faq" in slugs
    assert "contact" in slugs
    assert "track-order" in slugs
    assert "cart" in slugs
    assert "checkout" in slugs

    # 3. Check home page sections
    home_resp = owner_client.get("/cms/pages/home")
    assert home_resp.status_code == 200
    home_data = home_resp.json()
    assert home_data["slug"] == "home"
    assert home_data["is_system_page"] is True
    sections = home_data.get("sections", [])
    assert len(sections) == 10

    sec_types = [s["type"] for s in sections]
    expected_types = [
        "hero_video",
        "announcement_bar",
        "category_grid",
        "shark_tank_feature",
        "mattress_layer_breakdown",
        "seven_zones_support",
        "organic_latex_process",
        "certifications_badges",
        "testimonials_slider",
        "cta_banner",
    ]
    assert sec_types == expected_types

    # Check section configs
    hero = sections[0]
    assert "videotourl.com" in hero["config"]["video_url"]
    assert hero["config"]["autoplay"] is True

    ribbon = sections[1]
    assert "100% ORGANIC" in ribbon["config"]["messages"]

    process = sections[6]
    assert len(process["config"]["steps"]) == 8


def test_cms_section_types_catalogue(owner_client: httpx.Client):
    """Test the complete section types catalogue includes all 10 live sections."""
    res = owner_client.get("/admin/cms/section-types")
    assert res.status_code == 200
    types = res.json()
    assert len(types) >= 18
    type_keys = [t["type"] for t in types]
    assert "hero_video" in type_keys
    assert "organic_latex_process" in type_keys
    assert "shark_tank_feature" in type_keys
    assert "seven_zones_support" in type_keys


def test_system_page_protection(owner_client: httpx.Client):
    """Test that core system pages cannot be deleted."""
    home_res = owner_client.get("/cms/pages/home")
    assert home_res.status_code == 200
    home = home_res.json()

    # Attempt to delete home page
    del_res = owner_client.delete(f"/admin/cms/pages/{home['id']}")
    assert del_res.status_code == 400
    assert "Cannot delete core system" in del_res.json()["detail"]
