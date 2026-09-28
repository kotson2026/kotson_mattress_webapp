"""Idempotent seed/migration for Kotson Customizable Products."""

import logging
import uuid
from lib.db import db

logger = logging.getLogger(__name__)

MATTRESS_CUSTOM_CONFIG = {
    "enabled": True,
    "unit": "inch",
    "dimensions": {
        "length": {"min": 60.0, "max": 84.0, "step": 1.0},
        "breadth": {"min": 30.0, "max": 78.0, "step": 1.0},
        "thickness": {"min": 4.0, "max": 12.0, "step": 1.0, "allowed_values": [5.0, 6.0, 8.0, 10.0, 12.0]},
    },
    "options": [
        {
            "id": "opt_cover",
            "name": "Cover Material",
            "display_label": "Cover Material",
            "required": True,
            "enabled": True,
            "sort_order": 1,
            "values": [
                {
                    "id": "val_bamboo",
                    "name": "Bamboo Knitted",
                    "display_label": "Organic Bamboo Knitted",
                    "description": "Naturally cool, antibacterial, and silky soft touch",
                    "image": "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 1,
                },
                {
                    "id": "val_cotton",
                    "name": "Organic Cotton",
                    "display_label": "100% GOTS Organic Cotton",
                    "description": "Unbleached, breathable natural weave with botanical purity",
                    "image": "https://cdn.phototourl.com/member/2026-09-23-58e2ca4e-ebff-4af3-be34-e3e84717dbb8.jpg",
                    "additional_price": 200000,  # ₹2,000 upgrade
                    "enabled": True,
                    "sort_order": 2,
                },
            ],
        },
        {
            "id": "opt_firmness",
            "name": "Firmness",
            "display_label": "Comfort Feel & Firmness",
            "required": True,
            "enabled": True,
            "sort_order": 2,
            "values": [
                {
                    "id": "val_med_soft",
                    "name": "Medium Soft",
                    "display_label": "Medium Soft (Plush Contour)",
                    "description": "Adaptive cradle ideal for side sleepers and joint pressure relief",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 1,
                },
                {
                    "id": "val_med_firm",
                    "name": "Medium Firm",
                    "display_label": "Medium Firm (Balanced Ortho)",
                    "description": "Anatomical 7-zone lumbar support for optimal spinal alignment",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 2,
                },
                {
                    "id": "val_firm",
                    "name": "Firm",
                    "display_label": "Firm Orthopedic",
                    "description": "High-resilience solid foundation for maximum lumbar stability",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 3,
                },
            ],
        },
    ],
    "pricing": {
        "pricing_mode": "base_variant_ratio",
        "base_rate_per_sq_inch_paise": 0,
        "thickness_multiplier": 1.0,
        "min_price_paise": 4000000,
        "promotion_eligible": False,  # As required: 40% discount not automatically applied to custom
    },
}

PILLOW_CUSTOM_CONFIG = {
    "enabled": True,
    "unit": "inch",
    "dimensions": {
        "length": {"min": 16.0, "max": 36.0, "step": 1.0},
        "breadth": {"min": 12.0, "max": 24.0, "step": 1.0},
        "thickness": {"min": 3.0, "max": 7.0, "step": 0.5, "allowed_values": [3.0, 4.0, 4.5, 5.0, 5.5, 6.0]},
    },
    "options": [
        {
            "id": "opt_pillow_cover",
            "name": "Cover Fabric",
            "display_label": "Cover Fabric",
            "required": True,
            "enabled": True,
            "sort_order": 1,
            "values": [
                {
                    "id": "val_pil_bamboo",
                    "name": "Bamboo Silk",
                    "display_label": "Bamboo Silk Cover",
                    "description": "Hypoallergenic breathable outer sleeve",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 1,
                },
                {
                    "id": "val_pil_cotton",
                    "name": "Organic Cotton",
                    "display_label": "GOTS Organic Cotton",
                    "description": "Pure cotton jersey knit with zipper",
                    "image": "",
                    "additional_price": 40000,  # ₹400
                    "enabled": True,
                    "sort_order": 2,
                },
            ],
        }
    ],
    "pricing": {
        "pricing_mode": "base_variant_ratio",
        "promotion_eligible": False,
    },
}

TOPPER_CUSTOM_CONFIG = {
    "enabled": True,
    "unit": "inch",
    "dimensions": {
        "length": {"min": 60.0, "max": 84.0, "step": 1.0},
        "breadth": {"min": 30.0, "max": 78.0, "step": 1.0},
        "thickness": {"min": 2.0, "max": 4.0, "step": 1.0, "allowed_values": [2.0, 3.0, 4.0]},
    },
    "options": [
        {
            "id": "opt_topper_cover",
            "name": "Topper Encasing",
            "display_label": "Topper Encasing",
            "required": True,
            "enabled": True,
            "sort_order": 1,
            "values": [
                {
                    "id": "val_top_knitted",
                    "name": "Quilted Organic",
                    "display_label": "Quilted Organic Cover",
                    "description": "With corner anchor elastic straps",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 1,
                }
            ],
        }
    ],
    "pricing": {
        "pricing_mode": "base_variant_ratio",
        "promotion_eligible": False,
    },
}

BABY_KIDS_CUSTOM_CONFIG = {
    "enabled": True,
    "unit": "inch",
    "dimensions": {
        "length": {"min": 36.0, "max": 60.0, "step": 1.0},
        "breadth": {"min": 20.0, "max": 36.0, "step": 1.0},
        "thickness": {"min": 2.0, "max": 5.0, "step": 0.5, "allowed_values": [2.0, 3.0, 4.0, 5.0]},
    },
    "options": [
        {
            "id": "opt_baby_cover",
            "name": "Infant Guard Cover",
            "display_label": "Infant Guard Cover",
            "required": True,
            "enabled": True,
            "sort_order": 1,
            "values": [
                {
                    "id": "val_baby_waterproof",
                    "name": "Breathable Waterproof",
                    "display_label": "Breathable Waterproof Organic Cover",
                    "description": "Zero VOC, non-toxic waterproof protection",
                    "image": "",
                    "additional_price": 0,
                    "enabled": True,
                    "sort_order": 1,
                }
            ],
        }
    ],
    "pricing": {
        "pricing_mode": "base_variant_ratio",
        "promotion_eligible": False,
    },
}


async def ensure_custom_products_configured():
    """Ensure existing canonical products have customization enabled and rich options configured."""
    # 1. Mattresses (Ortho Therapy, Spine Balance, Ortho Core Max)
    mattress_slugs = ["ortho-therapy-mattress", "spine-balance-mattress", "ortho-core-max-mattress"]
    for slug in mattress_slugs:
        p = await db.products.find_one({"slug": slug})
        if p:
            await db.products.update_one(
                {"id": p["id"]},
                {"$set": {"customization": MATTRESS_CUSTOM_CONFIG}}
            )
            # Ensure standard variants exist for King & Queen
            variants = await db.variants.find({"product_id": p["id"]}).to_list(10)
            sizes = {v.get("size") for v in variants}
            base_price = min((v.get("price", 5000000) for v in variants), default=5000000)

            if "Queen" not in sizes:
                await db.variants.insert_one({
                    "id": str(uuid.uuid4()),
                    "product_id": p["id"],
                    "sku": f"KS-{slug[:10].upper()}-QN",
                    "size": "Queen",
                    "length": "78",
                    "width": "60",
                    "thickness": "6",
                    "firmness": "Medium Firm",
                    "price": base_price,
                    "mrp": int(round(base_price * 1.4)),
                    "stock": 20,
                    "reserved": 0,
                    "is_active": True,
                })
            if "King" not in sizes:
                await db.variants.insert_one({
                    "id": str(uuid.uuid4()),
                    "product_id": p["id"],
                    "sku": f"KS-{slug[:10].upper()}-KG",
                    "size": "King",
                    "length": "78",
                    "width": "72",
                    "thickness": "8",
                    "firmness": "Medium Firm",
                    "price": int(round(base_price * 1.25)),
                    "mrp": int(round(base_price * 1.25 * 1.4)),
                    "stock": 15,
                    "reserved": 0,
                    "is_active": True,
                })

    # 2. Pillows
    pillow_slugs = ["standard-classic-pillow", "ortho-wave-classic-pillow", "jumbo-pillow"]
    for slug in pillow_slugs:
        p = await db.products.find_one({"slug": slug})
        if p:
            await db.products.update_one(
                {"id": p["id"]},
                {"$set": {"customization": PILLOW_CUSTOM_CONFIG}}
            )

    # 3. Toppers
    topper = await db.products.find_one({"slug": "topper"})
    if topper:
        await db.products.update_one(
            {"id": topper["id"]},
            {"$set": {"customization": TOPPER_CUSTOM_CONFIG}}
        )

    # 4. Baby & Kids
    baby_slugs = ["natural-nest-junior-pillow", "natural-nest-mini-pillow"]
    for slug in baby_slugs:
        p = await db.products.find_one({"slug": slug})
        if p:
            await db.products.update_one(
                {"id": p["id"]},
                {"$set": {"customization": BABY_KIDS_CUSTOM_CONFIG}}
            )

    logger.info("Customizable products and configuration migration complete.")
    await ensure_custom_requests_seed()


async def ensure_custom_requests_seed():
    """Seed initial realistic Custom Product Requests for Owner Admin & Manager."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)

    # Find Ortho Core Max Mattress product
    ortho_max = await db.products.find_one({"slug": "ortho-core-max-mattress"})
    ortho_id = ortho_max["id"] if ortho_max else "prod_ortho_core_max"
    ortho_name = ortho_max["name"] if ortho_max else "Ortho Core Max Mattress"
    ortho_img = (ortho_max.get("images") or ["/navbar/mattress.png"])[0] if ortho_max else "/navbar/mattress.png"

    spine = await db.products.find_one({"slug": "spine-balance-mattress"})
    spine_id = spine["id"] if spine else "prod_spine_balance"
    spine_name = spine["name"] if spine else "Spine Balance Mattress"
    spine_img = (spine.get("images") or ["/navbar/mattress.png"])[0] if spine else "/navbar/mattress.png"

    demo_requests = [
        {
            "id": "cpr_demo_000124",
            "request_number": "KT-CUSTOM-000124",
            "customer_id": "cust_kranthi_01",
            "customer_name": "Kranthi Kumar",
            "mobile": "9876543210",
            "email": "kranthi.kumar@example.com",
            "city": "Bangalore",
            "pincode": "560038",
            "product_id": ortho_id,
            "product_name_snapshot": ortho_name,
            "product_slug": "ortho-core-max-mattress",
            "category": "mattresses",
            "product_image": ortho_img,
            "size_mode": "custom",
            "standard_variant_id": None,
            "standard_size_label": None,
            "length": "78",
            "breadth": "60",
            "height_or_thickness": "8",
            "measurement_unit": "in",
            "status": "NEW",
            "assigned_to_user_id": None,
            "assigned_to_name": None,
            "customer_remarks": "Need rounded corner radius on right edge for custom teakwood bed frame.",
            "internal_remarks": None,
            "quoted_price": None,
            "quote_notes": None,
            "quote_date": None,
            "created_at": "2026-09-28T07:40:00+00:00",  # 01:10 PM IST
            "updated_at": "2026-09-28T07:40:00+00:00",
        },
        {
            "id": "cpr_demo_000123",
            "request_number": "KT-CUSTOM-000123",
            "customer_id": None,
            "customer_name": "Priya Sharma",
            "mobile": "9876543211",
            "email": "priya.sharma@example.com",
            "city": "Mumbai",
            "pincode": "400050",
            "product_id": spine_id,
            "product_name_snapshot": spine_name,
            "product_slug": "spine-balance-mattress",
            "category": "mattresses",
            "product_image": spine_img,
            "size_mode": "custom",
            "standard_variant_id": None,
            "standard_size_label": None,
            "length": "80",
            "breadth": "70",
            "height_or_thickness": "6",
            "measurement_unit": "in",
            "status": "UNDER_REVIEW",
            "assigned_to_user_id": "mgr_vikram_01",
            "assigned_to_name": "Vikram Malhotra",
            "customer_remarks": "Height is critical to align with our low-profile bedside table.",
            "internal_remarks": "Checking factory line 2 for single-slab 80x70 mold scheduling.",
            "quoted_price": None,
            "quote_notes": None,
            "quote_date": None,
            "created_at": (now - timedelta(days=1, hours=3)).isoformat(),
            "updated_at": (now - timedelta(days=1, hours=1)).isoformat(),
        },
        {
            "id": "cpr_demo_000122",
            "request_number": "KT-CUSTOM-000122",
            "customer_id": None,
            "customer_name": "Anand Verma",
            "mobile": "9876543212",
            "email": "anand.verma@example.com",
            "city": "Delhi",
            "pincode": "110001",
            "product_id": ortho_id,
            "product_name_snapshot": ortho_name,
            "product_slug": "ortho-core-max-mattress",
            "category": "mattresses",
            "product_image": ortho_img,
            "size_mode": "custom",
            "standard_variant_id": None,
            "standard_size_label": None,
            "length": "75",
            "breadth": "48",
            "height_or_thickness": "8",
            "measurement_unit": "in",
            "status": "QUOTE_PROVIDED",
            "assigned_to_user_id": "mgr_vikram_01",
            "assigned_to_name": "Vikram Malhotra",
            "customer_remarks": "Single diwan bed custom sizing.",
            "internal_remarks": "Shared formal quote ₹38,500 over WhatsApp and email.",
            "quoted_price": 38500.0,
            "quote_notes": "Official quote includes 18% GST and custom 7-zone contour cut.",
            "quote_date": (now - timedelta(days=2)).isoformat(),
            "created_at": (now - timedelta(days=2, hours=4)).isoformat(),
            "updated_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "id": "cpr_demo_000121",
            "request_number": "KT-CUSTOM-000121",
            "customer_id": None,
            "customer_name": "Rajesh Nambiar",
            "mobile": "9876543213",
            "email": "rajesh.n@example.com",
            "city": "Kochi",
            "pincode": "682001",
            "product_id": ortho_id,
            "product_name_snapshot": ortho_name,
            "product_slug": "ortho-core-max-mattress",
            "category": "mattresses",
            "product_image": ortho_img,
            "size_mode": "custom",
            "standard_variant_id": None,
            "standard_size_label": None,
            "length": "78",
            "breadth": "72",
            "height_or_thickness": "10",
            "measurement_unit": "in",
            "status": "CONVERTED",
            "assigned_to_user_id": "mgr_vikram_01",
            "assigned_to_name": "Vikram Malhotra",
            "customer_remarks": "Need firm density 85D for orthopedic lumbar support.",
            "internal_remarks": "Quote accepted. Offline payment verified and custom production initiated.",
            "quoted_price": 49000.0,
            "quote_notes": "10-inch custom King orthopedic slab.",
            "quote_date": (now - timedelta(days=4)).isoformat(),
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": (now - timedelta(days=3)).isoformat(),
        },
    ]

    for req in demo_requests:
        existing = await db.custom_product_requests.find_one({"request_number": req["request_number"]})
        if not existing:
            await db.custom_product_requests.insert_one(req)

    # Initialize counter if not set
    counter_doc = await db.counters.find_one({"_id": "custom_product_request"})
    if not counter_doc or counter_doc.get("seq", 0) < 125:
        await db.counters.update_one(
            {"_id": "custom_product_request"},
            {"$set": {"seq": 125}},
            upsert=True,
        )

    logger.info("Custom product requests seeded successfully.")
