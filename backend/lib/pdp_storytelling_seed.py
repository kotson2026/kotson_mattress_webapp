"""Seed authoritative storytelling configuration for pilot product: Natural Nest Mini Pillow.
Safe and additive: modifies only the optional storytelling field, preserving all variants, IDs, pricing, and commerce data.
"""

import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.db import db

async def seed_pilot_storytelling():
    # 1. Natural Nest Mini Pillow (Pilot)
    mini = await db.products.find_one({"slug": "natural-nest-mini-pillow"})
    if mini:
        storytelling_mini = {
            "story": {
                "enabled": True,
                "eyebrow": "MADE FOR GROWING SLEEPERS",
                "heading": "Designed for Little Sleepers",
                "description": "Engineered specifically for toddlers transitioning to their first pillow. Pure natural latex offers gentle contouring support for fragile neck muscles without excessive elevation.",
                "features": [
                    {
                        "icon": "contour",
                        "title": "Ergonomic Contour",
                        "description": "Supports the intended ergonomic profile"
                    },
                    {
                        "icon": "latex",
                        "title": "Organic Latex Core",
                        "description": "Natural latex construction"
                    },
                    {
                        "icon": "bamboo",
                        "title": "Breathable Bamboo Cover",
                        "description": "Breathable outer cover"
                    }
                ]
            },
            "lifestyle": {
                "enabled": True,
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-0385ffe0-b11e-4446-a8e4-9ee94aa0baa0.jpg",
                "eyebrow": "DESIGNED FOR",
                "heading": "LITTLE SLEEPERS",
                "description": "A low 6 cm profile prevents unnecessary neck strain, allowing natural alignment during critical developmental years.",
                "suitability_items": [
                    {"label": "Age", "value": "Ages 2–5", "icon": "calendar"},
                    {"label": "Profile", "value": "Gentle contour", "icon": "activity"},
                    {"label": "Dimensions", "value": "44 × 28 × 6/6 cm", "icon": "ruler"}
                ],
                "bullet_features": [
                    "100% Pure Botanical Dunlop Latex",
                    "Washable, hypoallergenic bamboo outer cover",
                    "Zero synthetic fillers, off-gassing, or chemical retardants"
                ]
            },
            "construction": {
                "enabled": True,
                "eyebrow": "WHAT'S INSIDE?",
                "heading": "What's Inside",
                "description": "Three pure layers engineered specifically for toddler safety and restorative sleep.",
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-0385ffe0-b11e-4446-a8e4-9ee94aa0baa0.jpg",
                "layers": [
                    {
                        "order": 1,
                        "name": "Bamboo Cover",
                        "description": "Soft, naturally cooling bamboo outer casing with concealed safety zipper.",
                        "icon": "shield"
                    },
                    {
                        "order": 2,
                        "name": "Natural Inner Cover",
                        "description": "Protective cotton inner casing preserving core cleanliness and breathability.",
                        "icon": "layers"
                    },
                    {
                        "order": 3,
                        "name": "Organic Latex Core",
                        "description": "100% natural botanical Dunlop latex contoured for gentle toddler cervical support.",
                        "icon": "sparkles"
                    }
                ]
            },
            "fit_guide": {
                "enabled": True,
                "eyebrow": "FIND THE RIGHT FIT",
                "heading": "Find the Right Fit",
                "description": "Choose the contour profile matched to your child's age and development.",
                "items": [
                    {
                        "name": "Natural Nest Mini",
                        "subtitle": "Ages 2–5",
                        "dimensions": "44 × 28 × 6/6 cm",
                        "specs": "Low 6cm gentle contour for toddlers",
                        "link_slug": "natural-nest-mini-pillow"
                    },
                    {
                        "name": "Natural Nest Junior",
                        "subtitle": "Ages 5–10",
                        "dimensions": "48 × 28 × 9/7 cm",
                        "specs": "Dual 9/7cm elevation for growing kids",
                        "link_slug": "natural-nest-junior-pillow"
                    }
                ]
            },
            "certification_ids": ["gols", "eco-institut", "oeko-tex"]
        }
        await db.products.update_one({"id": mini["id"]}, {"$set": {"storytelling": storytelling_mini}})
        print(f"Attached storytelling configuration to Natural Nest Mini Pillow ({mini['id']})")

    # 2. Natural Nest Junior Pillow
    junior = await db.products.find_one({"slug": "natural-nest-junior-pillow"})
    if junior:
        storytelling_junior = {
            "story": {
                "enabled": True,
                "eyebrow": "MADE FOR GROWING SLEEPERS",
                "heading": "Designed for Growing Kids",
                "description": "Specially calibrated dual-height pillow for ages 5–10. Provides the exact cervical lift needed as shoulders broaden and spine matures.",
                "features": [
                    {
                        "icon": "contour",
                        "title": "Dual-Height Contour",
                        "description": "9 cm and 7 cm contours adapt to side and back sleeping"
                    },
                    {
                        "icon": "latex",
                        "title": "Organic Latex Core",
                        "description": "100% natural botanical Dunlop latex for resilient spinal support"
                    },
                    {
                        "icon": "bamboo",
                        "title": "Breathable Bamboo Cover",
                        "description": "Hypoallergenic, cool-touch zippered bamboo cover"
                    }
                ]
            },
            "lifestyle": {
                "enabled": True,
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-334275fa-130c-4cdd-a46f-c28ef9e3f7c1.png",
                "eyebrow": "DESIGNED FOR",
                "heading": "GROWING SLEEPERS",
                "description": "Dual heights allow older children to select their preferred elevation for healthy postural alignment.",
                "suitability_items": [
                    {"label": "Age", "value": "Ages 5–10", "icon": "calendar"},
                    {"label": "Profile", "value": "Dual contour", "icon": "activity"},
                    {"label": "Dimensions", "value": "48 × 28 × 9/7 cm", "icon": "ruler"}
                ],
                "bullet_features": [
                    "Dual-height 9/7 cm contour adapts as child grows",
                    "Pure botanical latex with zero synthetic polyurethane",
                    "Certified child-safe emissions and skin contact safety"
                ]
            },
            "construction": {
                "enabled": True,
                "eyebrow": "WHAT'S INSIDE?",
                "heading": "What's Inside",
                "description": "Crafted from pure natural elements for clean sleep and durability.",
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-334275fa-130c-4cdd-a46f-c28ef9e3f7c1.png",
                "layers": [
                    {
                        "order": 1,
                        "name": "Bamboo Cover",
                        "description": "Naturally breathable, moisture-wicking bamboo outer cover.",
                        "icon": "shield"
                    },
                    {
                        "order": 2,
                        "name": "Natural Inner Cover",
                        "description": "Protective cotton inner lining for hygiene.",
                        "icon": "layers"
                    },
                    {
                        "order": 3,
                        "name": "Dual-Height Latex Core",
                        "description": "Contoured natural Dunlop latex core with 9/7 cm dual ergonomic waves.",
                        "icon": "sparkles"
                    }
                ]
            },
            "fit_guide": {
                "enabled": True,
                "eyebrow": "FIND THE RIGHT FIT",
                "heading": "Find the Right Fit",
                "description": "Choose the contour profile matched to your child's age and development.",
                "items": [
                    {
                        "name": "Natural Nest Mini",
                        "subtitle": "Ages 2–5",
                        "dimensions": "44 × 28 × 6/6 cm",
                        "specs": "Low 6cm gentle contour for toddlers",
                        "link_slug": "natural-nest-mini-pillow"
                    },
                    {
                        "name": "Natural Nest Junior",
                        "subtitle": "Ages 5–10",
                        "dimensions": "48 × 28 × 9/7 cm",
                        "specs": "Dual 9/7cm elevation for growing kids",
                        "link_slug": "natural-nest-junior-pillow"
                    }
                ]
            },
            "certification_ids": ["gols", "eco-institut", "oeko-tex"]
        }
        await db.products.update_one({"id": junior["id"]}, {"$set": {"storytelling": storytelling_junior}})
        print(f"Attached storytelling configuration to Natural Nest Junior Pillow ({junior['id']})")

    # 3. Ortho Therapy Mattress (Representative Mattress)
    ortho = await db.products.find_one({"slug": "ortho-therapy-mattress"})
    if ortho:
        storytelling_ortho = {
            "story": {
                "enabled": True,
                "eyebrow": "ENGINEERED FOR SPINAL WELLBEING",
                "heading": "Targeted 7-Zone Ergonomic Support",
                "description": "Individually calibrated firmness zones align the spine, cradle the shoulders, and maintain pelvic neutrality for deep restorative sleep.",
                "features": [
                    {
                        "icon": "activity",
                        "title": "7-Zone Differential Support",
                        "description": "Engineered densities across head, lumbar, pelvis, and limbs."
                    },
                    {
                        "icon": "latex",
                        "title": "100% Botanical Latex",
                        "description": "Zero synthetic fillers, polyurethane foams, or toxic adhesives."
                    },
                    {
                        "icon": "bamboo",
                        "title": "Organic Quilted Cover",
                        "description": "Naturally breathable, moisture-wicking and cool to touch."
                    }
                ]
            },
            "lifestyle": {
                "enabled": True,
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
                "eyebrow": "DESIGNED FOR",
                "heading": "DEEP RESTORATIVE SLEEP",
                "description": "Alleviates pressure hotspots that trigger tossing and turning, allowing deep sleep cycles to proceed uninterrupted.",
                "suitability_items": [
                    {"label": "Comfort", "value": "Medium Firm", "icon": "sparkles"},
                    {"label": "Profile", "value": "7-Zone Ortho", "icon": "activity"},
                    {"label": "Core", "value": "100% Dunlop Latex", "icon": "layers"}
                ],
                "bullet_features": [
                    "Optimal spinal alignment recommended for back and side sleepers",
                    "Pin-core ventilation for active airflow and temperature neutrality",
                    "Naturally resistant to dust mites, mildew, and allergens"
                ]
            },
            "construction": {
                "enabled": True,
                "eyebrow": "WHAT'S INSIDE?",
                "heading": "What's Inside",
                "description": "Four layers engineered for pure botanical comfort and lasting structural integrity.",
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
                "layers": [
                    {
                        "order": 1,
                        "name": "Organic Bamboo Zipper Cover",
                        "description": "Silky-smooth, hypoallergenic outer casing with natural thermoregulation.",
                        "icon": "shield"
                    },
                    {
                        "order": 2,
                        "name": "Breathable Cotton Inner Shield",
                        "description": "Encases the core cleanly, protecting natural latex against friction.",
                        "icon": "layers"
                    },
                    {
                        "order": 3,
                        "name": "7-Zone Pure Dunlop Latex Core",
                        "description": "Zoned pin-hole architecture providing anatomical pressure distribution.",
                        "icon": "sparkles"
                    },
                    {
                        "order": 4,
                        "name": "Anti-Skid Base Fabric",
                        "description": "Reinforced structural bottom layer preventing mattress shifting on bed bases.",
                        "icon": "shield"
                    }
                ]
            },
            "fit_guide": {
                "enabled": True,
                "eyebrow": "SELECTING YOUR SIZE",
                "heading": "Find the Right Dimensions",
                "description": "Available in standard Queen and King dimensions with customized thicknesses.",
                "items": [
                    {
                        "name": "Queen Size",
                        "subtitle": "Couples & Spacious Single",
                        "dimensions": "78 × 60 inches (or 72/75)",
                        "specs": "Available in 6\", 8\", and 10\" thickness options",
                        "link_slug": "ortho-therapy-mattress"
                    },
                    {
                        "name": "King Size",
                        "subtitle": "Master Bedrooms & Families",
                        "dimensions": "78 × 72 inches (or 72/75/84)",
                        "specs": "Available in 6\", 8\", and 10\" thickness options",
                        "link_slug": "ortho-therapy-mattress"
                    }
                ]
            },
            "certification_ids": ["gols", "eco-institut", "fsc", "lga", "oeko-tex"]
        }
        await db.products.update_one({"id": ortho["id"]}, {"$set": {"storytelling": storytelling_ortho}})
        print(f"Attached storytelling configuration to Ortho Therapy Mattress ({ortho['id']})")

    # 4. Natural Latex Mattress Topper (Representative Topper)
    topper = await db.products.find_one({"slug": "topper"})
    if topper:
        storytelling_topper = {
            "story": {
                "enabled": True,
                "eyebrow": "UPGRADE YOUR SLEEP SURFACE",
                "heading": "Instant Botanical Latex Plushness",
                "description": "Rejuvenate too-firm or aging mattresses instantly with a 2-inch layer of pure natural latex.",
                "features": [
                    {
                        "icon": "sparkles",
                        "title": "2-Inch Pressure Relief",
                        "description": "Gently contours hips and shoulders without sinking feeling."
                    },
                    {
                        "icon": "latex",
                        "title": "100% Botanical Latex",
                        "description": "Zero synthetic fillers or toxic off-gassing."
                    },
                    {
                        "icon": "bamboo",
                        "title": "Removable Bamboo Shell",
                        "description": "Zippered and fully machine washable."
                    }
                ]
            },
            "lifestyle": {
                "enabled": True,
                "image_url": "https://cdn.phototourl.com/member/2026-09-22-1d57563d-4952-45e0-82a8-0f04c6f50567.jpg",
                "eyebrow": "DESIGNED FOR",
                "heading": "ANY MATTRESS UPGRADE",
                "description": "Elastic corner straps ensure a secure, slip-free fit over any existing mattress.",
                "suitability_items": [
                    {"label": "Thickness", "value": "2 Inches (5 cm)", "icon": "ruler"},
                    {"label": "Comfort", "value": "Gentle Cushioning", "icon": "sparkles"},
                    {"label": "Fit", "value": "Queen & King", "icon": "bed"}
                ],
                "bullet_features": [
                    "Transforms rigid springs or hard memory foam into natural comfort",
                    "Open-cell botanical latex breathes continuously through the night",
                    "Elastic anchor straps keep the topper firmly in place"
                ]
            },
            "construction": {
                "enabled": True,
                "eyebrow": "WHAT'S INSIDE?",
                "heading": "What's Inside",
                "description": "Engineered simplicity: pure latex core wrapped in premium bamboo fabric.",
                "image_url": "https://cdn.phototourl.com/member/2026-09-22-1d57563d-4952-45e0-82a8-0f04c6f50567.jpg",
                "layers": [
                    {
                        "order": 1,
                        "name": "Bamboo Stretch Outer Cover",
                        "description": "Cool-to-the-touch, anti-microbial knitted bamboo fabric.",
                        "icon": "shield"
                    },
                    {
                        "order": 2,
                        "name": "Protective Inner Cotton Sleeve",
                        "description": "Keeps the latex core dust-free and shielded during cleaning.",
                        "icon": "layers"
                    },
                    {
                        "order": 3,
                        "name": "2\" 100% Natural Dunlop Latex Sheet",
                        "description": "Continuous vulcanized botanical latex with micro-ventilation pinholes.",
                        "icon": "sparkles"
                    }
                ]
            },
            "fit_guide": {
                "enabled": True,
                "eyebrow": "COMPATIBILITY",
                "heading": "Match With Your Bed Size",
                "description": "Order the size corresponding exactly to your mattress surface.",
                "items": [
                    {
                        "name": "Queen Size Topper",
                        "subtitle": "Fits standard Queen beds",
                        "dimensions": "78 × 60 × 2 inches",
                        "specs": "Anchor straps accommodate up to 14\" mattress depth",
                        "link_slug": "topper"
                    },
                    {
                        "name": "King Size Topper",
                        "subtitle": "Fits standard King beds",
                        "dimensions": "78 × 72 × 2 inches",
                        "specs": "Anchor straps accommodate up to 14\" mattress depth",
                        "link_slug": "topper"
                    }
                ]
            },
            "certification_ids": ["gols", "eco-institut", "oeko-tex"]
        }
        await db.products.update_one({"id": topper["id"]}, {"$set": {"storytelling": storytelling_topper}})
        print(f"Attached storytelling configuration to Topper ({topper['id']})")

    # 5. Standard Classic Pillow (Representative Adult Pillow)
    classic = await db.products.find_one({"slug": "standard-classic-pillow"})
    if classic:
        storytelling_classic = {
            "story": {
                "enabled": True,
                "eyebrow": "TIMELESS ERGONOMIC COMFORT",
                "heading": "Classic Contoured Neck Support",
                "description": "The quintessential pillow for everyday restorative sleep. Resilient Dunlop latex core offers balanced cervical support without flattening over time.",
                "features": [
                    {
                        "icon": "sparkles",
                        "title": "Consistent Elastic Loft",
                        "description": "Never sags, clumps, or requires fluffing unlike microfiber pillows."
                    },
                    {
                        "icon": "latex",
                        "title": "100% Botanical Latex",
                        "description": "Naturally breathable, mold and dust-mite resistant."
                    },
                    {
                        "icon": "bamboo",
                        "title": "Washable Bamboo Cover",
                        "description": "Ultra-soft zippered casing keeps the pillow fresh."
                    }
                ]
            },
            "lifestyle": {
                "enabled": True,
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-455b85ee-f331-4a49-923f-ae4e68e4a958.png",
                "eyebrow": "DESIGNED FOR",
                "heading": "UNIVERSAL SLEEPING STYLES",
                "description": "Ideal 13 cm loft supports both back and side sleepers with uniform pressure relief.",
                "suitability_items": [
                    {"label": "Dimensions", "value": "60 × 40 × 13 cm", "icon": "ruler"},
                    {"label": "Profile", "value": "Classic Ergonomic", "icon": "activity"},
                    {"label": "Feel", "value": "Medium Plush", "icon": "sparkles"}
                ],
                "bullet_features": [
                    "Zero synthetic petrochemical polyurethane foam",
                    "Breathable pin-core structure maintains airflow through the night",
                    "Certified skin contact safety and zero chemical emissions"
                ]
            },
            "construction": {
                "enabled": True,
                "eyebrow": "WHAT'S INSIDE?",
                "heading": "What's Inside",
                "description": "Pure botanical natural latex core with dual protective casings.",
                "image_url": "https://cdn.phototourl.com/member/2026-09-23-455b85ee-f331-4a49-923f-ae4e68e4a958.png",
                "layers": [
                    {
                        "order": 1,
                        "name": "Silky Bamboo Cover",
                        "description": "Breathable, moisture-wicking outer layer with zipper.",
                        "icon": "shield"
                    },
                    {
                        "order": 2,
                        "name": "Protective Cotton Core Cover",
                        "description": "Preserves core integrity and facilitates easy outer cover washing.",
                        "icon": "layers"
                    },
                    {
                        "order": 3,
                        "name": "13cm Botanical Latex Core",
                        "description": "100% natural Dunlop latex with open-cell micro-ventilation pinholes.",
                        "icon": "sparkles"
                    }
                ]
            },
            "fit_guide": {
                "enabled": False,
                "eyebrow": "FIND THE RIGHT FIT",
                "heading": "Find the Right Fit",
                "description": "",
                "items": []
            },
            "certification_ids": ["gols", "eco-institut", "oeko-tex"]
        }
        await db.products.update_one({"id": classic["id"]}, {"$set": {"storytelling": storytelling_classic}})
        print(f"Attached storytelling configuration to Standard Classic Pillow ({classic['id']})")

if __name__ == "__main__":
    asyncio.run(seed_pilot_storytelling())
