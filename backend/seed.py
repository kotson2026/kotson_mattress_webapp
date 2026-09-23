"""Seed data — clearly identified, replaceable, idempotent. Run: cd /app/backend && python seed.py

Seeds: categories, 10 sample products (is_seed=true), CMS blocks, trust claims (DRAFT,
evidence pending), asset slots (placeholders), site settings, and staging accounts.
Nothing here is production data; the owner replaces prices/stock/copy via /admin.
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from lib.db import db, ensure_indexes
from lib.security import hash_password, now_utc

P = 100  # rupees -> paise


async def upsert(collection: str, match: dict, doc: dict) -> bool:
    if await db[collection].find_one(match):
        return False
    await db[collection].insert_one(doc)
    return True


CATS = [
    ("mattresses", "Mattresses", "GOLS-certified organic latex mattresses with 7-zone anatomical support.", "category-mattress", 1),
    ("pillows", "Pillows", "Contoured organic latex pillows for every sleep style.", "category-pillow", 2),
    ("toppers", "Toppers", "Refresh any bed with a natural latex comfort layer.", "category-topper", 3),
    ("baby-kids", "Baby + Kids", "Hypoallergenic, VOC-free natural latex for little sleepers.", "category-babykids", 4),
]

# Authoritative 18-product Kotson catalogue: (slug, name, category, price_rupees, image_url)
PRODUCTS = [
    # --- Mattresses (3) ---
    (
        "ortho-therapy-mattress",
        "Ortho Therapy Mattress",
        "mattresses",
        74000,
        "https://cdn.phototourl.com/member/2026-09-23-58e2ca4e-ebff-4af3-be34-e3e84717dbb8.jpg",
    ),
    (
        "spine-balance-mattress",
        "Spine Balance Mattress",
        "mattresses",
        72000,
        "https://cdn.phototourl.com/member/2026-09-23-cdee954b-8e07-4331-b0a8-26696b4dad71.png",
    ),
    (
        "ortho-core-max-mattress",
        "Ortho Core Max Mattress",
        "mattresses",
        50000,
        "https://cdn.phototourl.com/member/2026-09-23-12dd140c-f528-41fa-b568-15b06c82205d.png",
    ),

    # --- Pillows (12) ---
    (
        "standard-classic-pillow",
        "Standard Classic Pillow",
        "pillows",
        2899,
        "https://cdn.phototourl.com/member/2026-09-22-d076aa68-00a8-46f3-ae97-22a703352de1.png",
    ),
    (
        "standard-linea-pillow",
        "Standard Linea Pillow",
        "pillows",
        3099,
        "https://cdn.phototourl.com/member/2026-09-22-c2f502d1-519b-4174-b2f1-946201979c86.png",
    ),
    (
        "standard-flex-pillow",
        "Standard Flex Pillow",
        "pillows",
        2199,
        "https://cdn.phototourl.com/free/2026-09-22-fa7082d3-1ea4-408a-8105-0f5cdeafaf44.png",
    ),
    (
        "standard-dudlis-pillow",
        "Standard Dudlis Pillow",
        "pillows",
        4299,
        "https://cdn.phototourl.com/member/2026-09-22-3f612e8e-1da2-42ca-ad3d-4c94a1b160bf.jpg",
    ),
    (
        "ortho-wave-classic-pillow",
        "Ortho Wave Classic Pillow",
        "pillows",
        3299,
        "https://cdn.phototourl.com/member/2026-09-22-7e00e34c-49f6-408e-85d9-515088ea248b.png",
    ),
    (
        "ortho-wave-linea-pillow",
        "Ortho Wave Linea Pillow",
        "pillows",
        3299,
        "https://cdn.phototourl.com/member/2026-09-22-26c4ef83-1435-4cf3-8721-2caaea6f005a.png",
    ),
    (
        "ortho-wave-support-plus-pillow",
        "Ortho Wave Support+ Pillow",
        "pillows",
        3299,
        "https://cdn.phototourl.com/member/2026-09-22-26c4ef83-1435-4cf3-8721-2caaea6f005a.png",
    ),
    (
        "ortho-wave-acu-touch-pillow",
        "Ortho Wave Acu Touch Pillow",
        "pillows",
        3499,
        "https://cdn.phototourl.com/member/2026-09-22-586a543f-151f-454b-8a7b-b0570e75d9d7.png",
    ),
    (
        "jumbo-pillow",
        "Jumbo Pillow",
        "pillows",
        3999,
        "https://cdn.phototourl.com/member/2026-09-23-ea4945c6-f120-409b-984b-ff5f7f0fb7fd.jpg",
    ),
    (
        "dualis-arc-pillow",
        "Dualis Arc Pillow",
        "pillows",
        4899,
        "https://cdn.phototourl.com/member/2026-09-23-66e778fa-1b51-4f9f-a8e7-b0d8ef87a6e5.jpg",
    ),
    (
        "dualis-travel-pillow",
        "Dualis Travel Pillow",
        "pillows",
        1899,
        "https://cdn.phototourl.com/member/2026-09-23-ec4001c4-6330-453e-b6d6-9e2f66ab4fc0.jpg",
    ),
    (
        "dualis-body-pillow",
        "Dualis Body Pillow",
        "pillows",
        5599,
        "https://cdn.phototourl.com/member/2026-09-23-94ba7d88-251d-4053-a562-78b30f543c7c.jpg",
    ),

    # --- Toppers (1) ---
    (
        "topper",
        "Topper",
        "toppers",
        25000,
        "https://cdn.phototourl.com/member/2026-09-23-6b486cf9-0fea-481b-9c26-fac9c94586c4.jpg",
    ),

    # --- Baby + Kids (2) ---
    (
        "natural-nest-junior-pillow",
        "Natural Nest Junior Pillow",
        "baby-kids",
        2099,
        "https://cdn.phototourl.com/member/2026-09-23-334275fa-130c-4cdd-a46f-c28ef9e3f7c1.png",
    ),
    (
        "natural-nest-mini-pillow",
        "Natural Nest Mini Pillow",
        "baby-kids",
        1899,
        "https://cdn.phototourl.com/member/2026-09-23-0385ffe0-b11e-4446-a8e4-9ee94aa0baa0.jpg",
    ),
]

ZONES = [
    {"id": "zone-1", "name": "Head & Neck", "pressure": "Gentle Cradle", "firmness": "Medium-Soft", "description": "Micro-pin core channels alleviate cervical pressure and align the upper spine naturally."},
    {"id": "zone-2", "name": "Back & Shoulders", "pressure": "Pressure Relief", "firmness": "Contoured Soft", "description": "Expanded ventilation cavities allow broad shoulder blades to sink without pinch points."},
    {"id": "zone-3", "name": "Lower Back & Lumbar", "pressure": "Targeted Support", "firmness": "Firm Adaptive", "description": "Reinforced latex density bridges the lumbar gap to eliminate morning back stiffness."},
    {"id": "zone-4", "name": "Hips & Thighs", "pressure": "Even Displacement", "firmness": "Dynamic Medium", "description": "Progressive compression distributes pelvic weight evenly across sleep transitions."},
    {"id": "zone-5", "name": "Knees", "pressure": "Ergonomic Balance", "firmness": "Medium-Firm", "description": "Zero-rebound resilience preserves a neutral knee joint angle in side and back sleeping."},
    {"id": "zone-6", "name": "Lower Legs", "pressure": "Circulation Flow", "firmness": "Soft Airy", "description": "Aerated cellular grid prevents pressure constriction for unhindered blood flow."},
    {"id": "zone-7", "name": "Feet", "pressure": "Weightless Finish", "firmness": "Gentle Float", "description": "Soft terminal cushion suspends heels and feet in a buoyant, gravity-free state."},
]

STEPS = [
    {"n": 1, "title": "Sap", "body": "Organic Hevea brasiliensis trees are tapped at dawn; the raw latex sap is collected in small cups without wounding the tree."},
    {"n": 2, "title": "Purification", "body": "The sap is washed, filtered and centrifuged — no synthetic fillers, no petrochemicals, no harmful additives."},
    {"n": 3, "title": "Foam", "body": "The Dunlop process bakes purified latex into breathable, pin-core foam with consistent density."},
    {"n": 4, "title": "Layering", "body": "Comfort and support layers are cut into seven anatomical zones, wrapped in organic cotton and a breathable bamboo cover."},
]

TESTIMONIALS = [
    {"name": "Verified buyer — Pune", "text": "SEED SAMPLE: My lower-back stiffness eased within the first two weeks. The 7-zone feel is real — firm where it should be, soft at the shoulders.", "rating": 5},
    {"name": "Verified buyer — Bengaluru", "text": "SEED SAMPLE: No chemical smell at all, which was the whole point of going organic. Delivery and setup were smooth.", "rating": 5},
    {"name": "Verified buyer — Kochi", "text": "SEED SAMPLE: Bought the crib mattress for my daughter; it is firm, breathable and light. Exactly what the pediatrician recommended.", "rating": 5},
]

BENEFITS = [
    {"title": "100% Organic", "body": "Certified organic latex tapped from plantations, not petrochemical foam."},
    {"title": "Hypoallergenic", "body": "Naturally resistant to dust mites, mould and bacteria."},
    {"title": "Orthopedic Support", "body": "Seven anatomical zones keep the spine in its natural line."},
    {"title": "Temperature Balance", "body": "Open pin-core structure breathes — cool in summer, warm in winter."},
    {"title": "Motion Isolation", "body": "Partner turns do not travel across the mattress."},
    {"title": "Sustainable", "body": "Tree-tapped latex is renewable, biodegradable and locally processed."},
]

CLAIMS = [
    ("gols_certified", "100% GOLS-certified organic latex"),
    ("one_of_five_india", "One of five GOLS-certified mattress companies in India"),
    ("shark_tank_india", "Featured on Shark Tank India"),
    ("trial_100_nights", "100-night trial"),
    ("warranty_10_years", "10-year warranty"),
    ("free_shipping", "Free shipping across India"),
]

ASSET_SLOTS = [
    "logo-header-light", "logo-header-dark", "logo-footer", "hero-bg",
    "category-mattress", "category-pillow", "category-topper", "category-babykids",
    "material-bamboo", "material-cotton", "material-latex", "material-support-base",
    "zone-overview", "process-01", "process-02", "process-03", "process-04",
    "cert-logo-gols", "shark-tank-video",
    "testimonial-thumb-01", "testimonial-thumb-02", "testimonial-thumb-03",
] + [f"zone-0{i}" for i in range(1, 8)]

SECTIONS = {"logo-header-light": "header", "logo-header-dark": "header", "logo-footer": "footer", "hero-bg": "hero"}


async def main() -> None:
    print("Seeding Kotson Mattress staging data…")

    for slug, name, desc, slot, sort in CATS:
        await upsert("categories", {"slug": slug}, {
            "id": str(uuid.uuid4()), "slug": slug, "name": name, "description": desc,
            "image_slot": slot, "sort": sort, "is_active": True,
        })

    # 1. Purge any obsolete mock products not in the official catalogue
    valid_slugs = {p[0] for p in PRODUCTS}
    obsolete_products = await db.products.find({"slug": {"$nin": list(valid_slugs)}}).to_list(200)
    for op in obsolete_products:
        await db.variants.delete_many({"product_id": op["id"]})
        await db.products.delete_one({"id": op["id"]})
        print(f"  Purged obsolete mock product: {op.get('name')} ({op.get('slug')})")

    # 2. Insert or update the 18 official products
    for sort_order, (slug, name, cat, price_rupees, image_url) in enumerate(PRODUCTS, 1):
        existing = await db.products.find_one({"slug": slug})
        price_paise = price_rupees * P
        if existing:
            pid = existing["id"]
            await db.products.update_one(
                {"id": pid},
                {
                    "$set": {
                        "name": name,
                        "category_slug": cat,
                        "status": "ACTIVE",
                        "website_visibility": "VISIBLE",
                        "is_active": True,
                        "sort": sort_order,
                        "badge": None,
                        "rating": None,
                        "review_count": 0,
                        "trial_days": None,
                        "warranty_years": None,
                        "description": "",
                        "tagline": "",
                        "images": [image_url],
                        "primary_image": image_url,
                    }
                }
            )
            # Ensure at least one base variant at the exact price
            v = await db.variants.find_one({"product_id": pid})
            if v:
                await db.variants.update_one(
                    {"id": v["id"]},
                    {"$set": {"price": price_paise, "mrp": None, "is_active": True}}
                )
            else:
                sku_clean = slug.upper().replace("-", "")[:14]
                await db.variants.insert_one({
                    "id": str(uuid.uuid4()),
                    "product_id": pid,
                    "sku": f"KS-{sku_clean}-1",
                    "size": "Standard",
                    "thickness": None,
                    "firmness": None,
                    "price": price_paise,
                    "mrp": None,
                    "stock": 25,
                    "reserved": 0,
                    "is_active": True,
                })
        else:
            pid = str(uuid.uuid4())
            await db.products.insert_one({
                "id": pid,
                "slug": slug,
                "name": name,
                "tagline": "",
                "short_description": "",
                "description": "",
                "category_slug": cat,
                "brand": "Kotson Naturals",
                "material": "100% Botanical Natural Latex",
                "product_type": "Mattress" if cat == "mattresses" else "Pillow" if cat in ("pillows", "baby-kids") else "Topper",
                "status": "ACTIVE",
                "website_visibility": "VISIBLE",
                "badge": None,
                "rating": None,
                "review_count": 0,
                "trial_days": None,
                "warranty_years": None,
                "images": [image_url],
                "primary_image": image_url,
                "videos": [],
                "tags": [],
                "features": [],
                "specifications": {},
                "is_seed": False,
                "is_active": True,
                "sort": sort_order,
                "created_at": now_utc(),
            })
            sku_clean = slug.upper().replace("-", "")[:14]
            await db.variants.insert_one({
                "id": str(uuid.uuid4()),
                "product_id": pid,
                "sku": f"KS-{sku_clean}-1",
                "size": "Standard",
                "thickness": None,
                "firmness": None,
                "price": price_paise,
                "mrp": None,
                "stock": 25,
                "reserved": 0,
                "is_active": True,
            })

    now = now_utc()
    blocks = [
        ("hero_kicker", "Kotson Naturals — Organic Latex Since 1998", "text"),
        ("hero_title", "Sleep on a forest, not a factory", "text"),
        ("hero_sub", "Kotson Mattress crafts GOLS-certified organic latex mattresses with seven anatomical support zones — tapped from tree sap, built in India, delivered to your door.", "text"),
        ("hero_cta_primary", "Shop Mattresses", "text"),
        ("hero_cta_secondary", "Explore the 7 Zones", "text"),
        ("stat_slots", '[{"value": "7", "label": "Anatomical support zones"}, {"value": "GOLS", "label": "Organic certified latex (verification pending)", "pending": true}, {"value": "10", "label": "Year warranty (terms pending)", "pending": true}]', "json"),
        ("trust_benefits", str(BENEFITS).replace("'", '"').replace("True", "true"), "json"),
        ("categories_heading", "Shop by category", "text"),
        ("categories_sub", "Organic comfort for every sleeper in the family.", "text"),
        ("featured_heading", "Featured products", "text"),
        ("featured_sub", "Live from the catalog — availability and prices are always current.", "text"),
        ("zones_heading", "Seven zones. One spine.", "text"),
        ("zones_sub", "Every Kotson mattress is sculpted into seven anatomical zones. Select a zone to see what it does.", "text"),
        ("zones", str(ZONES).replace("'", '"'), "json"),
        ("process_heading", "From tree sap to your bedroom", "text"),
        ("process_sub", "Four steps, zero petrochemicals.", "text"),
        ("process_steps", str(STEPS).replace("'", '"'), "json"),
        ("certifications_heading", "Certifications & proof", "text"),
        ("certifications_sub", "Every certificate here is published only after owner-approved evidence is on file.", "text"),
        ("sharktank_body", "Media block reserved for the Shark Tank India feature. Published once the owner approves the episode evidence.", "text"),
        ("testimonials_heading", "What sleepers say", "text"),
        ("testimonials", str(TESTIMONIALS).replace("'", '"').replace("True", "true").replace("False", "false"), "json"),
        ("final_cta_heading", "Ready for deeper sleep?", "text"),
        ("final_cta_sub", "Try any mattress at home for 100 nights (trial terms pending owner approval).", "text"),
        ("final_cta_label", "Shop the collection", "text"),
        ("footer_about", "KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. Organic latex bedding made in India. Contact details are pending owner validation.", "text"),
        ("footer_contact", '{"support_email": "", "support_phone": "", "address": "", "contact_status": "pending_owner_validation"}', "json"),
        ("about_title", "About Kotson Naturals", "text"),
        ("about_body", "SEED SAMPLE — Kotson Naturals Private Limited manufactures organic latex mattresses and bedding in India. This page copy is a placeholder pending owner-approved brand copy.", "text"),
        ("faq_items", '[{"q": "Is the latex really organic?", "a": "Owner answer pending — this claim is published only with approved GOLS evidence."}, {"q": "How does the 100-night trial work?", "a": "Trial terms are pending owner approval and will be published here."}, {"q": "Do you ship across India?", "a": "Shipping coverage and charges are pending owner configuration."}]', "json"),
        ("policy_shipping", "PENDING OWNER APPROVAL — final shipping policy terms will be published here.", "text"),
        ("policy_returns", "PENDING OWNER APPROVAL — final returns/trial policy terms will be published here.", "text"),
        ("policy_privacy", "PENDING OWNER APPROVAL — final privacy policy will be published here.", "text"),
        ("policy_terms", "PENDING OWNER APPROVAL — final terms of service will be published here.", "text"),
        ("seo_title", "Kotson Mattress — Organic Latex Mattresses Made in India", "text"),
        ("seo_description", "GOLS-certified organic latex mattresses with 7-zone anatomical support. 100-night trial, 10-year warranty, free shipping (claims pending owner verification).", "text"),
    ]
    for key, value, btype in blocks:
        existing = await db.blocks.find_one({"key": key})
        if existing:
            continue
        await db.blocks.insert_one({
            "key": key, "page": "policies" if key.startswith("policy_") else ("home" if key not in ("about_title", "about_body", "faq_items", "footer_about", "footer_contact", "seo_title", "seo_description") else key.split("_")[0] if key.startswith("about") else "footer" if key.startswith("footer") else "home"),
            "label": key.replace("_", " ").title(), "type": btype, "value": value,
            "status": "draft" if key.startswith("policy_") else "published",
            "updated_at": now, "revisions": [],
        })

    for key, label in CLAIMS:
        await upsert("claims", {"key": key}, {
            "key": key, "label": label, "body": f"{label} — proof/evidence pending owner approval.",
            "status": "draft", "evidence_status": "pending", "evidence_url": "",
            "applies_to": "site", "conditions": "Pending owner-approved evidence, coverage and conditions.",
        })

    CATEGORY_ASSET_DEFAULTS = {
        "category-mattress": ("https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png", "Mattresses — Kotson"),
        "category-pillow": ("https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png", "Pillows — Kotson"),
        "category-topper": ("https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png", "Toppers — Kotson"),
        "category-babykids": ("https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png", "Baby + Kids — Kotson"),
    }

    for slot in ASSET_SLOTS:
        def_info = CATEGORY_ASSET_DEFAULTS.get(slot)
        await upsert("assets", {"slot": slot}, {
            "slot": slot, "section": SECTIONS.get(slot, slot.split("-")[0] if "-" in slot else "general"),
            "alt_text": def_info[1] if def_info else "",
            "file_url": def_info[0] if def_info else "",
            "status": "published" if def_info else "placeholder",
            "attribution": "",
            "crop_desktop": "", "crop_mobile": "",
        })

    await upsert("settings", {"id": "site"}, {
        "id": "site", "company_name": "KOTSON NATURALS PRIVATE LIMITED",
        "support_email": "", "support_phone": "", "address": "",
        "gst_rate": None, "gst_status": "pending_configuration",
        "shipping_flat_paise": None, "shipping_status": "pending_configuration",
        "free_shipping_enabled": False, "razorpay_state": "pending_keys",
        "mail_state": "pending_provider", "analytics_consent": "not_configured",
    })

    # Staging accounts — passwords are SEED credentials, documented in memory/test_credentials.md
    owner_pw = os.environ.get("SEED_OWNER_PASSWORD", "Kotson-Owner-2026!")
    accounts = [
        ("hello@kotsonmattress.com", "Kotson Owner", ["owner"], owner_pw),
        ("manager@kotsonmattress.com", "Ops Manager", ["manager"], "Kotson-Manager-2026!"),
        ("crm@kotsonmattress.com", "CRM Master", ["crm_master"], "Kotson-CRM-2026!"),
        ("admin@kotsonmattress.com", "Store Admin", ["admin"], "Kotson-Admin-2026!"),
        ("crm.employee@kotsonmattress.com", "CRM Employee", ["crm_employee"], "Kotson-CRMEmp-2026!"),
        ("rahul.demo@example.com", "Rahul (Demo Customer)", ["customer"], "Kotson-Customer-2026!"),
        ("dealer.demo@example.com", "Demo Dealer", ["customer"], "Kotson-Dealer-2026!"),
    ]
    for email, name, roles, pw in accounts:
        if await db.users.find_one({"email": email}):
            continue
        doc = {
            "id": str(uuid.uuid4()), "email": email, "name": name,
            "password_hash": hash_password(pw), "roles": roles,
            "referred_by": None, "is_active": True, "created_at": now_utc(),
        }
        if "customer" in roles:  # unique sparse index — staff docs omit the field entirely
            doc["referral_code"] = "KS" + uuid.uuid4().hex[:6].upper()
        await db.users.insert_one(doc)

    # No referral rules are seeded — the safe default is 0 discount / 0 commission.
    await ensure_indexes()
    print("Seed complete: %d products, %d blocks, %d claims, %d asset slots."
          % (await db.products.count_documents({}), await db.blocks.count_documents({}),
             await db.claims.count_documents({}), await db.assets.count_documents({})))
    print(f"Owner login: {os.environ.get('OWNER_EMAIL', 'hello@kotsonmattress.com')} / {owner_pw}  (SEED credential — rotate)")
    
    # Run the PDP catalog migration to populate exact variant matrices
    import lib.pdp_catalog_migration
    await lib.pdp_catalog_migration.main()



if __name__ == "__main__":
    asyncio.run(main())
