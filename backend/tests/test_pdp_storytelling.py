"""Automated Regression Suite for PDP Storytelling Architecture and Commerce Integrity."""

import httpx

BASE_URL = "http://localhost:8001/api"

def test_pdp_settings_feature_flag():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/catalog/pdp-settings")
        assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
        data = res.json()
        assert "pdp_design_version" in data
        assert data["pdp_design_version"] in ("storytelling", "current")

def test_cms_certifications_endpoint():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/cms/certifications")
        assert res.status_code == 200
        certs = res.json()
        assert isinstance(certs, list)
        cert_ids = [c["id"] for c in certs]
        assert "gols" in cert_ids
        assert "eco-institut" in cert_ids
        assert "oeko-tex" in cert_ids

def test_pilot_natural_nest_mini_pillow():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/catalog/products/natural-nest-mini-pillow")
        assert res.status_code == 200
        p = res.json()

        # Commerce integrity
        assert p["name"] == "Natural Nest Mini Pillow"
        assert p["category_slug"] == "baby-kids"
        assert p["price_from"] == 189900  # ₹1,899
        assert p["discount_percent"] == 40.0
        assert p["in_stock"] is True

        # Dimension integrity: strictly CM, dual-height 6/6 preserved!
        specs = p["specifications"]
        assert specs.get("Length") == "44 cm"
        assert specs.get("Breadth") == "28 cm"
        assert specs.get("Height") == "6/6 cm"
        assert "inch" not in specs.get("Height", "").lower()

        # Variant integrity
        assert len(p["variants"]) >= 1
        v0 = p["variants"][0]
        assert v0["price"] == 189900
        assert v0["length"] == "44"
        assert v0["width"] == "28"
        assert v0["thickness"] == "6/6"

        # Storytelling Section 2: Story
        storytelling = p.get("storytelling")
        assert storytelling is not None, "Storytelling config missing"
        story = storytelling.get("story")
        assert story["enabled"] is True
        assert story["eyebrow"] == "MADE FOR GROWING SLEEPERS"
        assert story["heading"] == "Designed for Little Sleepers"
        assert len(story["features"]) == 3

        # Storytelling Section 3: Lifestyle
        lifestyle = storytelling.get("lifestyle")
        assert lifestyle["enabled"] is True
        assert lifestyle["eyebrow"] == "DESIGNED FOR"
        assert lifestyle["heading"] == "LITTLE SLEEPERS"
        suitability = {item["label"]: item["value"] for item in lifestyle["suitability_items"]}
        assert suitability.get("Age") == "Ages 2–5"
        assert suitability.get("Dimensions") == "44 × 28 × 6/6 cm"

        # Storytelling Section 4: Construction
        construction = storytelling.get("construction")
        assert construction["enabled"] is True
        assert len(construction["layers"]) == 3
        layer_names = [l["name"] for l in construction["layers"]]
        assert "Bamboo Cover" in layer_names
        assert "Organic Latex Core" in layer_names

        # Storytelling Section 5: Fit Guide
        fit_guide = storytelling.get("fit_guide")
        assert fit_guide["enabled"] is True
        assert len(fit_guide["items"]) >= 2
        model_names = [item["name"] for item in fit_guide["items"]]
        assert "Natural Nest Mini" in model_names
        assert "Natural Nest Junior" in model_names

        # Storytelling Section 6: Certifications
        cert_ids = storytelling.get("certification_ids")
        assert "gols" in cert_ids
        assert "eco-institut" in cert_ids
        assert "oeko-tex" in cert_ids

def test_ortho_therapy_mattress_integrity():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/catalog/products/ortho-therapy-mattress")
        assert res.status_code == 200
        p = res.json()

        # Commerce & variants integrity
        assert p["name"] == "Ortho Therapy Mattress"
        assert p["category_slug"] == "mattresses"
        assert len(p["variants"]) == 21, f"Expected 21 variants, found {len(p['variants'])}"
        assert p["discount_percent"] == 40.0
        assert p["in_stock"] is True

        # Mattress storytelling
        st = p.get("storytelling")
        assert st is not None
        assert st["story"]["heading"] == "Targeted 7-Zone Ergonomic Support"
        assert len(st["construction"]["layers"]) == 4

def test_topper_integrity():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/catalog/products/topper")
        assert res.status_code == 200
        p = res.json()

        assert p["category_slug"] == "toppers"
        assert len(p["variants"]) == 6, f"Expected 6 variants, found {len(p['variants'])}"
        st = p.get("storytelling")
        assert st is not None
        assert st["lifestyle"]["suitability_items"][0]["value"] == "2 Inches (5 cm)"

def test_cart_add_and_pricing():
    with httpx.Client(base_url=BASE_URL) as client:
        # 1. Fetch mini pillow variant ID
        p_res = client.get("/catalog/products/natural-nest-mini-pillow")
        p = p_res.json()
        variant_id = p["variants"][0]["id"]

        # 2. Add to Cart
        cart_res = client.post("/cart/items", json={"variant_id": variant_id, "qty": 1})
        assert cart_res.status_code in (200, 201)
        cart = cart_res.json()
        assert "items" in cart
        matching = [item for item in cart["items"] if item["variant_id"] == variant_id]
        assert len(matching) > 0
        assert matching[0]["unit_price"] == 189900  # ₹1,899 exactly
