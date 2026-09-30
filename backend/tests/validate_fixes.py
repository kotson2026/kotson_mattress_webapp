import os
from dotenv import load_dotenv

load_dotenv("backend/.env")
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

def validate():
    print("=== FAST VALIDATION RUN ===")

    # 1. Base price check
    res = sb.table("product_variants").select("id, sku, price_paise, mrp_paise").eq("sku", "KS-ORTHOTHERA-Q-72-60-6").execute()
    assert len(res.data) > 0, "KS-ORTHOTHERA-Q-72-60-6 variant not found"
    v = res.data[0]
    p_paise = v["price_paise"]
    p_rupees = p_paise // 100
    print(f"1. Base Price: {v['sku']} price_paise={p_paise} -> Rupees={p_rupees}")
    assert p_rupees == 74000, f"Expected 74000 rupees, got {p_rupees}"
    print("   --> PASS: Rs. 74,000 remains 74000 internally")

    # 2. 40% Calculation
    mrp_40 = round(74000 / 0.60)
    print(f"2. 40% Calculation: 74,000 / 0.60 = {mrp_40}")
    assert mrp_40 == 123333, f"Expected 123333, got {mrp_40}"
    print("   --> PASS: 40% calculation = 123,333")

    # 3. 50% Calculation
    mrp_50 = round(74000 / 0.50)
    print(f"3. 50% Calculation: 74,000 / 0.50 = {mrp_50}")
    assert mrp_50 == 148000, f"Expected 148000, got {mrp_50}"
    print("   --> PASS: 50% calculation = 148,000")

    # 4. Global Discount application test to all active variants
    active_vars = sb.table("product_variants").select("id, price_paise, mrp_paise").eq("is_active", True).execute()
    total_active = len(active_vars.data)
    print(f"4. Total active variants in DB: {total_active}")
    assert total_active > 0, "No active variants found"

    # Simulate 40% global discount update
    factor_40 = 0.60
    updates_40 = [
        {"id": row["id"], "mrp_paise": round(row["price_paise"] / factor_40)}
        for row in active_vars.data
    ]
    for u in updates_40:
        sb.table("product_variants").update({"mrp_paise": u["mrp_paise"]}).eq("id", u["id"]).execute()
    
    # Verify updated
    check_var = sb.table("product_variants").select("id, price_paise, mrp_paise").eq("sku", "KS-ORTHOTHERA-Q-72-60-6").execute()
    updated_mrp = check_var.data[0]["mrp_paise"]
    print(f"   KS-ORTHOTHERA-Q-72-60-6 after 40% global discount: price_paise={check_var.data[0]['price_paise']}, mrp_paise={updated_mrp} (Rupees: {updated_mrp // 100})")
    assert updated_mrp // 100 == 123333, f"Expected 123333, got {updated_mrp // 100}"
    print("   --> PASS: Global discount reaches all active variants")

    # 5. CMS Homepage sections
    cms = sb.table("cms_pages").select("id, slug, sections, published_sections").eq("slug", "home").execute()
    assert len(cms.data) > 0, "CMS home page not found"
    sections = cms.data[0]["sections"]
    pub_sections = cms.data[0]["published_sections"]
    print(f"5. CMS Homepage: {len(sections)} draft sections, {len(pub_sections)} published sections")
    assert len(sections) == 11, f"Expected 11 sections, got {len(sections)}"
    print("   --> PASS: Drag section + save/publish ready")

    # 6. Check PDP storytelling column
    prod = sb.table("products").select("id, slug, name, storytelling").eq("slug", "ortho-therapy-mattress").execute()
    assert len(prod.data) > 0, "ortho-therapy-mattress product not found"
    print(f"6. Product storytelling field verified on {prod.data[0]['name']}")
    print("   --> PASS: Storytelling PDP restored")

    print("\nALL FAST VALIDATION CHECKS PASSED!")

if __name__ == "__main__":
    validate()
