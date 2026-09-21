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

# (slug, name, tagline, category, badge, trial, warranty, rating, reviews, [(size, thickness, firmness, price_paise, stock)])
PRODUCTS = [
    ("kotson-pure-7-zone-organic-latex-mattress", "Kotson Pure 7-Zone Organic Latex Mattress",
     "100% GOLS organic certified Dunlop latex with anatomical 7-zone contouring", "mattresses", "Bestseller",
     100, 10, 4.93, 218, [
         ("Single (72x36)", "8 Inch (20 cm)", "Medium Firm (75D/85D)", 54999 * P, 9),
         ("Queen (78x60)", "8 Inch (20 cm)", "Medium Firm (75D/85D)", 64999 * P, 6),
         ("King (78x72)", "10 Inch (25 cm)", "Dual Comfort (Reversible)", 74999 * P, 3),
     ]),
    ("ortho-therapy-mattress", "Ortho Therapy Mattress",
     "Doctor-recommended orthopaedic organic latex for targeted spinal support", "mattresses", "Ortho Care",
     100, 10, 4.9, 87, [
         ("Single (72x36)", "8 Inch (20 cm)", "Firm (85D)", 74000 * P, 7),
         ("Queen (78x60)", "8 Inch (20 cm)", "Firm (85D)", 84000 * P, 4),
         ("King (78x72)", "10 Inch (25 cm)", "Firm (85D)", 94000 * P, 0),
     ]),
    ("spine-balance-mattress", "Spine Balance Mattress",
     "Balanced medium-firm organic latex engineered for neutral spine alignment", "mattresses", None,
     100, 10, 4.87, 64, [
         ("Single (72x36)", "8 Inch (20 cm)", "Medium Firm (75D/85D)", 72000 * P, 5),
         ("Queen (78x60)", "8 Inch (20 cm)", "Medium Firm (75D/85D)", 82000 * P, 8),
     ]),
    ("ortho-core-max-mattress", "Ortho Core Max Mattress",
     "High-density natural latex core for maximum postural support", "mattresses", None,
     100, 10, 4.82, 51, [
         ("Single (72x36)", "8 Inch (20 cm)", "Extra Firm (90D)", 50000 * P, 2),
         ("Queen (78x60)", "10 Inch (25 cm)", "Extra Firm (90D)", 58000 * P, 6),
     ]),
    ("jumbo-pillow", "Jumbo Pillow",
     "Extra-tall organic latex pillow with a GOTS washable cotton cover", "pillows", "Popular",
     30, 3, 4.88, 96, [
         ("Standard (24x16 in)", "Jumbo (6 in)", "Plush Medium", 3899 * P, 20),
     ]),
    ("ortho-wave-acu-touch-pillow", "Ortho Wave Acu Touch Pillow",
     "Wave-contoured surface with gentle acupressure zones for the neck", "pillows", None,
     30, 3, 4.85, 73, [
         ("Standard (24x16 in)", "High Contour (4.5 in)", "Plush Medium", 3499 * P, 15),
     ]),
    ("standard-flex-pillow", "Standard Flex Pillow",
     "Everyday resilient latex pillow that keeps its shape wash after wash", "pillows", None,
     30, 3, 4.8, 58, [
         ("Standard (24x16 in)", "Low Contour (3.5 in)", "Plush Medium", 2199 * P, 0),
     ]),
    ("latex-mattress-topper", "Kotson Organic Latex Mattress Topper",
     "Instantly revitalise any existing bed with natural latex comfort", "toppers", "Quick Upgrade",
     30, 5, 4.85, 64, [
         ("Single", "2 Inch (5 cm)", "Medium Balance (75D)", 24999 * P, 6),
         ("Queen", "2 Inch (5 cm)", "Medium Balance (75D)", 24999 * P, 10),
         ("King", "3 Inch (7.5 cm)", "Medium Balance (75D)", 29999 * P, 1),
     ]),
    ("natural-nest-junior-pillow", "Natural Nest Junior Pillow",
     "Soft-support latex pillow sized and tuned for children", "baby-kids", "Pediatric Safe",
     50, 5, 4.97, 51, [
         ("Junior (20x12 in)", "3 in", "Pediatric Firm", 2099 * P, 12),
     ]),
    ("natural-nest-mini-pillow", "Natural Nest Mini Pillow",
     "Toddler-safe natural latex pillow, hypoallergenic and washable", "baby-kids", None,
     50, 5, 4.95, 34, [
         ("Mini (16x10 in)", "2.5 in", "Pediatric Firm", 1899 * P, 4),
     ]),
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

    for slug, name, tagline, cat, badge, trial, warranty, rating, reviews, variants in PRODUCTS:
        if await db.products.find_one({"slug": slug}):
            continue
        pid = str(uuid.uuid4())
        await db.products.insert_one({
            "id": pid, "slug": slug, "name": name, "tagline": tagline,
            "description": f"SEED SAMPLE — {name}. Replace this copy with owner-approved product documentation via /admin. Organic latex construction with breathable organic cotton and bamboo cover.",
            "category_slug": cat, "badge": badge, "rating": rating, "review_count": reviews,
            "trial_days": trial, "warranty_years": warranty, "images": [], "is_seed": True,
            "is_active": True, "sort": 0, "created_at": now_utc(),
        })
        for i, (size, thickness, firmness, price, stock) in enumerate(variants, 1):
            await db.variants.insert_one({
                "id": str(uuid.uuid4()), "product_id": pid,
                "sku": f"KS-{slug[:14].upper().replace('-', '')}-{i}",
                "size": size, "thickness": thickness, "firmness": firmness,
                "price": price, "mrp": int(price * 1.25), "stock": stock, "reserved": 0,
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

    for slot in ASSET_SLOTS:
        await upsert("assets", {"slot": slot}, {
            "slot": slot, "section": SECTIONS.get(slot, slot.split("-")[0] if "-" in slot else "general"),
            "alt_text": "", "file_url": "", "status": "placeholder", "attribution": "",
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


if __name__ == "__main__":
    asyncio.run(main())
