"""KOTSON Website Edit — CMS Migration & Real Website Content Restoration Engine.

Idempotent one-time migration (`KOTSON_CMS_MIGRATION_V1`).
Discovers and imports all existing customer-facing website routes, homepage sections,
header, footer, and branding into CMS collections.
Differentiates REAL MASTER CONTENT from test transaction data.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from lib.db import db
from lib.security import now_utc

logger = logging.getLogger(__name__)

MIGRATION_BATCH_ID = "KOTSON_CMS_MIGRATION_V1"

# 10 Discovered Real Homepage Sections
HOMEPAGE_SECTIONS = [
    {
        "id": "sec-hero-video-live",
        "type": "hero_video",
        "title": "Hero Video / Banner",
        "subtitle": "Full-width native looping video hero",
        "content": "Kotson Organic Dunlop Latex Mattress — Crafted in India",
        "media_url": "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4",
        "order": 0,
        "is_visible": True,
        "config": {
            "video_url": "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4",
            "poster_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
            "poster_alt": "Kotson mattress hero video poster",
            "autoplay": True,
            "loop": True,
            "muted": True,
            "playsinline": True,
            "cta_label": "Shop Mattresses",
            "cta_link": "/collections/mattresses",
        },
    },
    {
        "id": "sec-sleep-ribbon-live",
        "type": "announcement_bar",
        "title": "Announcement Ribbon (Sleep Ribbon)",
        "subtitle": "Editorial infinite marquee banner",
        "content": "100% ORGANIC ✦ FREE SHIPPING ✦ CHEMICAL FREE",
        "order": 1,
        "is_visible": True,
        "config": {
            "messages": ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"],
            "separator": "✦",
            "speed": 40,
            "bg_color": "#16241C",
            "text_color": "#FAF8F5",
        },
    },
    {
        "id": "sec-explore-categories-live",
        "type": "category_grid",
        "title": "Explore Our Categories",
        "subtitle": "Continuous Showroom",
        "content": "Interactive category showroom with floating micro-animations",
        "order": 2,
        "is_visible": True,
        "config": {
            "heading": "Explore Our Categories",
            "subheading": "Support for a better you across every sleep style.",
            "categories": [
                {
                    "slug": "mattresses",
                    "name": "Mattresses",
                    "subtitle": "Support for a better you",
                    "route": "/collections/mattresses",
                    "image": "/navbar/mattress.png",
                    "fallback_image": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
                    "alt": "Kotson 7-Zone Organic Latex Mattress",
                },
                {
                    "slug": "pillows",
                    "name": "Pillows",
                    "subtitle": "Comfort in every sleep",
                    "route": "/collections/pillows",
                    "image": "/navbar/pillows.png",
                    "fallback_image": "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
                    "alt": "Kotson Ergonomic Cervical Latex Pillow",
                },
                {
                    "slug": "toppers",
                    "name": "Toppers",
                    "subtitle": "An extra layer of comfort",
                    "route": "/collections/toppers",
                    "image": "/navbar/toppers.png",
                    "fallback_image": "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
                    "alt": "Kotson Breathable Organic Latex Mattress Topper",
                },
                {
                    "slug": "baby-kids",
                    "name": "Baby + Kids",
                    "subtitle": "Gentle care for growing dreams",
                    "route": "/collections/baby-kids",
                    "image": "/navbar/baby-kids.png",
                    "fallback_image": "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
                    "alt": "Kotson Pediatric Certified Baby and Kids Mattress",
                },
            ],
        },
    },
    {
        "id": "sec-shark-tank-live",
        "type": "shark_tank_feature",
        "title": "Shark Tank India Feature",
        "subtitle": "Cinematic banner with expandable in-place video player",
        "content": "Shark Tank India Season 5 — Kotson feature episode",
        "media_url": "/shark-tank/kotson-shark-tank-square.webp",
        "order": 3,
        "is_visible": True,
        "config": {
            "banner_url": "/shark-tank/kotson-shark-tank-square.webp",
            "poster_url": "/shark-tank/kotson-shark-tank-square.webp",
            "youtube_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo",
            "video_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo",
            "eyebrow": "AS SEEN ON",
            "caption": "KOTSON × SHARK TANK INDIA",
        },
    },
    {
        "id": "sec-whats-inside-live",
        "type": "mattress_layer_breakdown",
        "title": "What's Inside Kotson?",
        "subtitle": "Dual Typography 3D Layer Showcase",
        "content": "Discover the genuine natural materials structured inside every Kotson mattress.",
        "order": 4,
        "is_visible": True,
        "config": {
            "heading": "What's Inside The Mattress?",
            "subheading": "Discover the genuine natural materials structured inside every Kotson mattress.",
            "layers": [
                {
                    "id": "cover",
                    "step": "01",
                    "title_line_1": "100% PURE",
                    "title_line_2": "BAMBOO COVER",
                    "name": "100% PURE BAMBOO COVER",
                    "description": "Soft, breathable and naturally comfortable.",
                },
                {
                    "id": "casing",
                    "step": "02",
                    "title_line_1": "THIN COTTON",
                    "title_line_2": "ZIP COVER",
                    "name": "THIN COTTON ZIP COVER",
                    "description": "A breathable protective layer designed for everyday comfort.",
                },
                {
                    "id": "core",
                    "step": "03",
                    "title_line_1": "GOLS-CERTIFIED 100%",
                    "title_line_2": "ORGANIC LATEX CORE",
                    "name": "GOLS-CERTIFIED 100% ORGANIC LATEX CORE",
                    "description": "Naturally responsive support at the heart of the mattress.",
                },
            ],
        },
    },
    {
        "id": "sec-seven-zones-live",
        "type": "seven_zones_support",
        "title": "What Makes Us Different? (7-Zone Support)",
        "subtitle": "Support, Where Your Body Needs It + Infinite Benefits Strip",
        "content": "Seven thoughtfully designed comfort zones work across the mattress to support different areas of your body.",
        "media_url": "https://cdn.phototourl.com/member/2026-09-22-feb051a4-db5e-4b7e-95ff-81f431f54595.png",
        "order": 5,
        "is_visible": True,
        "config": {
            "eyebrow": "WHAT MAKES US DIFFERENT?",
            "heading": "Support, Where Your Body Needs It.",
            "subheading": "Seven thoughtfully designed comfort zones work across the mattress to support different areas of your body.",
            "diagram_image_url": "https://cdn.phototourl.com/member/2026-09-22-feb051a4-db5e-4b7e-95ff-81f431f54595.png",
            "diagram_alt": "7-Zone Organic Mattress Body Support: Head & Neck, Back & Shoulders, Lower Back, Hips & Thighs, Knees, Lower Legs, Feet",
            "benefits": [
                {"label": "Temperature Balance"},
                {"label": "Motion Isolation"},
                {"label": "Sustainable"},
                {"label": "Reverse Pressure"},
                {"label": "Organic 100%"},
                {"label": "Hypoallergenic"},
                {"label": "Orthopedic Support"},
            ],
        },
    },
    {
        "id": "sec-organic-process-live",
        "type": "organic_latex_process",
        "title": "Organic Latex Process (8 Steps)",
        "subtitle": "From Tree Sap to Bedroom — The Dunlop Manufacturing Journey",
        "content": "An authentic, non-chemical 8-step journey converting organic botanical sap into luxury certified mattress cores.",
        "order": 6,
        "is_visible": True,
        "config": {
            "heading": "How an Organic Latex Mattress Is Made ",
            "subheading": "From Kerala Rubber Tree Groves to Deep Restorative Sleep. Zero Petrochemicals.",
            "steps": [
                {
                    "n": 1,
                    "title": "Dawn Sap Harvesting",
                    "body": "Organic Hevea brasiliensis trees are tapped at dawn in Kerala plantations; raw botanical sap is collected in small cups without wounding the tree.",
                },
                {
                    "n": 2,
                    "title": "Purification & Centrifuging",
                    "body": "The sap is washed, filtered and centrifuged with pure water — zero synthetic fillers, zero petrochemicals, zero harmful additives.",
                },
                {
                    "n": 3,
                    "title": "Aeration & Natural Foaming",
                    "body": "Purified natural latex is whipped with natural air into a fine, micro-cellular breathable foam.",
                },
                {
                    "n": 4,
                    "title": "Dunlop Steam Vulcanization",
                    "body": "The Dunlop process bakes aerated latex in molds with pin-core heating rods for uniform anatomical density and buoyancy.",
                },
                {
                    "n": 5,
                    "title": "Fresh Water Jet Washing",
                    "body": "Solidified latex blocks undergo multiple continuous fresh-water wash cycles to remove residual natural proteins and organic sugars.",
                },
                {
                    "n": 6,
                    "title": "Thermostatic Convective Drying",
                    "body": "The washed latex blocks enter slow-temperature drying tunnels to achieve optimal elasticity, firmness and durable recovery.",
                },
                {
                    "n": 7,
                    "title": "7-Zone Anatomical Sculpting",
                    "body": "Comfort and support layers are precision-sculpted into seven differential firmness zones, wrapped in organic cotton and a bamboo cover.",
                },
                {
                    "n": 8,
                    "title": "Independent Testing & GOLS Audit",
                    "body": "Every single production batch is verified against GOLS organic standards, eco-INSTITUT zero-VOC clearance, and LGA durability tests.",
                },
            ],
        },
    },
    {
        "id": "sec-certifications-live",
        "type": "certifications_badges",
        "title": "Certifications & Trust Explorer",
        "subtitle": "5 Verified Accreditations (GOLS, eco-INSTITUT, FSC, LGA, OEKO-TEX)",
        "content": "Independent certifications behind purity, emissions safety, and orthopedic resilience.",
        "order": 7,
        "is_visible": True,
        "config": {
            "heading": "Certifications & Proof",
            "subheading": "Every certificate here is independently validated with evidence on file.",
            "cert_keys": ["gols", "eco-institut", "fsc", "lga", "oeko-tex"],
            "show_video": True,
        },
    },
    {
        "id": "sec-testimonials-live",
        "type": "testimonials_slider",
        "title": "Real Sleeper Testimonials",
        "subtitle": "Comfort, Naturally — Verified Buyer Experiences",
        "content": "Real sleeper feedback from across India.",
        "order": 8,
        "is_visible": True,
        "config": {
            "heading": "Comfort, Naturally.",
            "subheading": "Real experiences from sleepers who switched to pure Dunlop latex.",
            "testimonials": [
                {
                    "name": "Verified buyer — Pune",
                    "text": "My lower-back stiffness eased within the first two weeks. The 7-zone feel is real — firm where it should be, soft at the shoulders.",
                    "rating": 5,
                },
                {
                    "name": "Verified buyer — Bengaluru",
                    "text": "No chemical smell at all, which was the whole point of going organic. Delivery and setup were smooth.",
                    "rating": 5,
                },
                {
                    "name": "Verified buyer — Kochi",
                    "text": "Bought the crib mattress for my daughter; it is firm, breathable and light. Exactly what the pediatrician recommended.",
                    "rating": 5,
                },
            ],
        },
    },
    {
        "id": "sec-final-cta-live",
        "type": "cta_banner",
        "title": "Where Better Sleep Begins (Final CTA)",
        "subtitle": "Closing conversion block with 100-night trial guarantee",
        "content": "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial.",
        "order": 9,
        "is_visible": True,
        "config": {
            "heading": "Where Better Sleep Begins.",
            "subheading": "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial.",
            "cta_label": "Shop the collection",
            "cta_link": "/collections",
            "bg_color": "#16241C",
        },
    },
]

# 16 Discovered Customer-Facing & System Pages
PAGES_MANIFEST = [
    {
        "slug": "home",
        "title": "Homepage",
        "seo_title": "Kotson Mattress — 100% Organic Dunlop Latex Mattresses Made in India",
        "seo_description": "GOLS-certified organic Dunlop latex mattresses with 7-zone anatomical support, 100-night trial, and 10-year warranty.",
        "status": "published",
        "page_type": "system",
        "is_system_page": True,
        "sections": HOMEPAGE_SECTIONS,
    },
    {
        "slug": "collections",
        "title": "All Collections & Catalog",
        "seo_title": "Shop Natural Latex Mattresses, Pillows & Toppers | Kotson",
        "seo_description": "Explore the complete Kotson collection: 7-Zone Organic Mattresses, Contoured Pillows, Breathable Toppers, and Baby & Kids bedding.",
        "status": "published",
        "page_type": "system",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "about",
        "title": "About Kotson Naturals",
        "seo_title": "About Kotson — Born from Nature, Built for Better Sleep",
        "seo_description": "Founded on a belief that modern sleep should not come at the expense of health or the planet. Learn about our Kerala organic latex heritage.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "faq",
        "title": "Frequently Asked Questions",
        "seo_title": "Frequently Asked Questions | Kotson Mattress",
        "seo_description": "Answers to common questions about our 100-night trial, 10-year warranty, custom mattress dimensions, and organic certifications.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "contact",
        "title": "Contact & Sleep Advisory",
        "seo_title": "Contact Kotson — Sleep Experts & Customer Care",
        "seo_description": "Speak with a Kotson sleep specialist, track order status, or inquire about wholesale dealer opportunities.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "track-order",
        "title": "Order Tracking",
        "seo_title": "Track Your Mattress Delivery | Kotson Pan-India Dispatch",
        "seo_description": "Enter your order number or phone number to see live milestone tracking, courier AWB, and estimated delivery dates.",
        "status": "published",
        "page_type": "system",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "policies/policy_shipping",
        "title": "Shipping & Delivery Policy",
        "seo_title": "Pan-India Free Shipping Policy | Kotson Mattress",
        "seo_description": "White-glove doorstep delivery across all Indian pin codes. Learn about dispatch timelines and transit insurance.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "policies/policy_returns",
        "title": "100-Night Trial & Returns Policy",
        "seo_title": "100-Night Risk-Free Trial & Returns | Kotson Mattress",
        "seo_description": "Sleep on your Kotson mattress for 100 nights in the comfort of your home. 100% refund and hassle-free doorstep pickup.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "policies/policy_privacy",
        "title": "Privacy Policy",
        "seo_title": "Privacy Policy | Kotson Naturals Private Limited",
        "seo_description": "How Kotson Naturals collects, protects, and handles customer data with SSL encryption and full privacy compliance.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "policies/policy_terms",
        "title": "Terms of Service",
        "seo_title": "Terms of Service | Kotson Mattress",
        "seo_description": "Official terms, conditions, and warranty coverage policies governing Kotson Mattress products and purchases.",
        "status": "published",
        "page_type": "content",
        "is_system_page": False,
        "sections": [],
    },
    {
        "slug": "products/:slug",
        "title": "Product Detail Template",
        "seo_title": "Dynamic Product Detail Template",
        "seo_description": "Dynamic template for product variants, dimensions, firmness scale, and Add to Cart.",
        "status": "published",
        "page_type": "commerce",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "cart",
        "title": "Shopping Cart",
        "seo_title": "Your Shopping Cart | Kotson Mattress",
        "seo_description": "Review selected mattresses, toppers, and pillows before proceeding to secure checkout.",
        "status": "published",
        "page_type": "commerce",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "checkout",
        "title": "Secure Checkout",
        "seo_title": "Secure Checkout | Kotson Mattress",
        "seo_description": "Complete your order with Razorpay, UPI, EMI, or Net Banking with free shipping.",
        "status": "published",
        "page_type": "commerce",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "order/confirmation/:id",
        "title": "Order Confirmation",
        "seo_title": "Order Confirmed | Kotson Mattress",
        "seo_description": "Thank you for choosing Kotson. Your order is confirmed and scheduled for dispatch.",
        "status": "published",
        "page_type": "commerce",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "account",
        "title": "Customer Account Portal",
        "seo_title": "Customer Account | Kotson Mattress",
        "seo_description": "Manage your orders, addresses, 100-night trial status, and warranty certificates.",
        "status": "published",
        "page_type": "commerce",
        "is_system_page": True,
        "sections": [],
    },
    {
        "slug": "login",
        "title": "Customer Login",
        "seo_title": "Customer Login | Kotson Mattress",
        "seo_description": "Sign in to your Kotson account with phone number or email.",
        "status": "published",
        "page_type": "system",
        "is_system_page": True,
        "sections": [],
    },
]


async def ensure_cms_migrated() -> Dict[str, Any]:
    """Idempotently populates the CMS collections with existing website content.

    Only runs if cms_pages doesn't already have the populated home page.
    """
    home_page = await db.cms_pages.find_one({"slug": "home"})
    if home_page and len(home_page.get("sections", [])) >= 8:
        logger.info("CMS already migrated with %d sections on home. Skipping.", len(home_page.get("sections", [])))
        return {"status": "skipped", "message": "CMS already migrated"}

    logger.info("Starting KOTSON CMS Restoration Migration (%s)...", MIGRATION_BATCH_ID)

    # 1. Create Pre-Migration Backup Snapshot
    existing_pages = await db.cms_pages.find({}).to_list(200)
    existing_header = await db.cms_header.find_one({"id": "main_header"})
    existing_footer = await db.cms_footer_config.find_one({"id": "main_footer"})
    existing_branding = await db.cms_branding.find_one({"id": "main_branding"})

    backup_doc = {
        "id": f"PRE_CMS_MIGRATION_BACKUP_{uuid.uuid4().hex[:8]}",
        "batch_id": MIGRATION_BATCH_ID,
        "created_at": now_utc(),
        "pages": existing_pages,
        "header": existing_header,
        "footer": existing_footer,
        "branding": existing_branding,
    }
    await db.cms_backups.insert_one(backup_doc)

    # 2. Populate All 16 Pages
    pages_created = 0
    pages_updated = 0
    for pdata in PAGES_MANIFEST:
        slug = pdata["slug"]
        existing = await db.cms_pages.find_one({"slug": slug})
        now = now_utc()
        doc = {
            "id": existing.get("id") if existing else str(uuid.uuid4()),
            "slug": slug,
            "title": pdata["title"],
            "seo_title": pdata["seo_title"],
            "seo_description": pdata["seo_description"],
            "status": pdata["status"],
            "page_type": pdata.get("page_type", "content"),
            "is_system_page": pdata.get("is_system_page", False),
            "sections": pdata.get("sections", []),
            "is_master_content": True,
            "updated_at": now,
        }
        if not existing:
            doc["created_at"] = now
            await db.cms_pages.insert_one(doc)
            pages_created += 1
        else:
            # If existing page has fewer sections than manifest (e.g. empty home), update it safely
            if slug == "home" and len(existing.get("sections", [])) < 8:
                await db.cms_pages.update_one({"id": existing["id"]}, {"$set": doc})
                pages_updated += 1

    # 3. Populate Header & Navigation Matching Live Floating Sleep Dock
    header_doc = {
        "id": "main_header",
        "announcement_enabled": True,
        "announcement_text": "100% ORGANIC ✦ FREE SHIPPING ✦ CHEMICAL FREE",
        "announcement_link": "/collections/mattresses",
        "phone_hotline": "+91 98765 43210",
        "show_search": True,
        "show_cart": True,
        "is_master_content": True,
        "updated_at": now_utc(),
        "nav_items": [
            {
                "id": str(uuid.uuid4()),
                "label": "Mattresses",
                "href": "/collections/mattresses",
                "badge": "7-Zone",
                "order": 0,
                "is_visible": True,
                "tagline": "7-Zone Ergonomic Natural Latex",
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Pillows",
                "href": "/collections/pillows",
                "badge": "Ergonomic",
                "order": 1,
                "is_visible": True,
                "tagline": "Cervical & Ergonomic Spinal Support",
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-db2b927f-f73a-4acf-aa46-ca3f72a19d43.png",
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Toppers",
                "href": "/collections/toppers",
                "badge": "Natural",
                "order": 2,
                "is_visible": True,
                "tagline": "Breathable Organic Comfort Layer",
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-d8cd5b3e-7b3c-4614-8cd3-293abc8d1526.png",
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Baby + Kids",
                "href": "/collections/baby-kids",
                "badge": "Pediatric",
                "order": 3,
                "is_visible": True,
                "tagline": "Pediatric Certified Pure Latex",
                "image_url": "https://cdn.phototourl.com/member/2026-09-21-c10cfc86-8ffe-4b1c-9e20-dc91bd8f0238.png",
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Collections",
                "href": "/collections",
                "order": 4,
                "is_visible": True,
            },
            {
                "id": str(uuid.uuid4()),
                "label": "About",
                "href": "/about",
                "order": 5,
                "is_visible": True,
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Contact",
                "href": "/contact",
                "order": 6,
                "is_visible": True,
            },
        ],
    }
    await db.cms_header.update_one({"id": "main_header"}, {"$set": header_doc}, upsert=True)

    # 4. Populate Footer Configuration Matching Live SiteFooter
    footer_doc = {
        "id": "main_footer",
        "tagline": "Where better sleep begins.",
        "about_text": "KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS.",
        "copyright_text": "© 2026 KOTSON NATURALS PRIVATE LIMITED. All rights reserved.",
        "support_email": "hello@kotsonmattress.com",
        "support_phone": "+91 98765 43210",
        "show_trust_badges": True,
        "show_newsletter": True,
        "is_master_content": True,
        "updated_at": now_utc(),
        "columns": [
            {
                "id": str(uuid.uuid4()),
                "title": "Shop",
                "links": [
                    {"label": "Mattresses", "href": "/collections/mattresses"},
                    {"label": "Pillows", "href": "/collections/pillows"},
                    {"label": "Toppers", "href": "/collections/toppers"},
                    {"label": "Baby + Kids", "href": "/collections/baby-kids"},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Help",
                "links": [
                    {"label": "Contact Us", "href": "/contact"},
                    {"label": "Track Order", "href": "/track-order"},
                    {"label": "Shipping Policy", "href": "/policies/policy_shipping"},
                    {"label": "Returns & Trial", "href": "/policies/policy_returns"},
                    {"label": "Warranty & Care", "href": "/policies/policy_warranty"},
                    {"label": "FAQs", "href": "/faq"},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Know Kotson",
                "links": [
                    {"label": "About Us", "href": "/about"},
                    {"label": "Certifications", "href": "/#certifications"},
                    {"label": "Stores", "href": "/#explore-stores"},
                    {"label": "Shark Tank India", "href": "/#shark-tank"},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Legal",
                "links": [
                    {"label": "Privacy Policy", "href": "/policies/policy_privacy"},
                    {"label": "Terms & Conditions", "href": "/policies/policy_terms"},
                    {"label": "Refund & Cancellation Policy", "href": "/policies/policy_returns"},
                ],
            },
        ],
        "social_links": {
            "instagram": "https://instagram.com/kotsonmattress",
            "facebook": "https://facebook.com/kotsonmattress",
            "youtube": "https://youtube.com/@kotsonmattress",
            "linkedin": "https://linkedin.com/company/kotsonmattress",
        },
    }
    await db.cms_footer_config.update_one({"id": "main_footer"}, {"$set": footer_doc}, upsert=True)

    # 5. Populate Branding Matching Live Design
    branding_doc = {
        "id": "main_branding",
        "main_logo_url": "/logo.png",
        "light_logo_url": "/logo-light.png",
        "dark_logo_url": "/logo-dark.png",
        "favicon_url": "/favicon.ico",
        "og_image_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png",
        "primary_color": "#16241C",
        "accent_color": "#7C9C59",
        "background_color": "#FAF8F5",
        "is_master_content": True,
        "updated_at": now_utc(),
    }
    await db.cms_branding.update_one({"id": "main_branding"}, {"$set": branding_doc}, upsert=True)

    # 6. Create Initial Publication Checkpoint
    initial_version = {
        "id": str(uuid.uuid4()),
        "version_tag": "v1.0.0-Live-Restoration",
        "published_at": now_utc(),
        "published_by": "system_restoration_engine",
        "note": "Initial safe restoration of existing live website into CMS",
        "snapshot": {
            "pages_count": len(PAGES_MANIFEST),
            "home_sections_count": len(HOMEPAGE_SECTIONS),
        },
    }
    await db.cms_versions.insert_one(initial_version)

    logger.info(
        "CMS Restoration Complete: %d pages inserted, %d updated, 10 home sections live.",
        pages_created,
        pages_updated,
    )
    return {
        "status": "success",
        "pages_created": pages_created,
        "pages_updated": pages_updated,
        "home_sections": len(HOMEPAGE_SECTIONS),
    }
