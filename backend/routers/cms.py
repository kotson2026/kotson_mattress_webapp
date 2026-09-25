"""CMS router: dynamic visual page builder, 22 section types, header/navigation, footer, branding, and draft->publish rollback."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from lib.cms_migrator import ensure_cms_migrated
from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, optional_user, require_role
from lib.services import clean_doc
from models.cms import (
    BrandingConfig,
    CMSFooterBlock,
    CMSNavItem,
    CMSPage,
    CMSPageCreate,
    CMSPageUpdate,
    CMSSection,
    FooterColumn,
    FooterConfig,
    HeaderConfig,
)

router = APIRouter()

# 22+ Section Types Catalogue with complete schemas and live presets
SECTION_TYPES = [
    {
        "type": "hero_video",
        "name": "Hero Video / Banner",
        "category": "Hero & Banners",
        "description": "Full-width native HTML5 looping video hero with fallback poster, autoplay, and CTA link.",
        "default_config": {
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
        "type": "announcement_bar",
        "name": "Announcement Ribbon (Sleep Ribbon)",
        "category": "Hero & Banners",
        "description": "Editorial continuous marquee ribbon with rotating promise messages and star separators.",
        "default_config": {
            "messages": ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"],
            "separator": "✦",
            "speed": 40,
            "bg_color": "#16241C",
            "text_color": "#FAF8F5",
        },
    },
    {
        "type": "category_grid",
        "name": "Explore Categories Showroom",
        "category": "Catalog & Storefront",
        "description": "Interactive category showroom with floating micro-animations (Mattresses, Pillows, Toppers, Baby + Kids).",
        "default_config": {
            "heading": "Explore Our Categories",
            "subheading": "Support for a better you across every sleep style.",
            "categories": [
                {"slug": "mattresses", "name": "Mattresses", "subtitle": "Support for a better you", "route": "/collections/mattresses"},
                {"slug": "pillows", "name": "Pillows", "subtitle": "Comfort in every sleep", "route": "/collections/pillows"},
                {"slug": "toppers", "name": "Toppers", "subtitle": "An extra layer of comfort", "route": "/collections/toppers"},
                {"slug": "baby-kids", "name": "Baby + Kids", "subtitle": "Gentle care for growing dreams", "route": "/collections/baby-kids"},
            ],
        },
    },
    {
        "type": "shark_tank_feature",
        "name": "Shark Tank India Feature",
        "category": "Media & Trust",
        "description": "Cinematic banner featuring Shark Tank India Season 5 episode with expandable in-place video player.",
        "default_config": {
            "banner_url": "/shark-tank/kotson-shark-tank-square.webp",
            "poster_url": "/shark-tank/kotson-shark-tank-square.webp",
            "youtube_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo",
            "video_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo",
            "eyebrow": "AS SEEN ON",
            "caption": "KOTSON × SHARK TANK INDIA",
        },
    },
    {
        "type": "mattress_layer_breakdown",
        "name": "What's Inside? 3D Layer Breakdown",
        "category": "Interactive & Product Anatomy",
        "description": "Dual typography showcase presenting the 3 authentic natural layers of the Kotson mattress.",
        "default_config": {
            "heading": "What's Inside The Mattress?",
            "subheading": "Discover the genuine natural materials structured inside every Kotson mattress.",
            "layers": [
                {"id": "cover", "step": "01", "name": "100% PURE BAMBOO COVER", "description": "Soft, breathable and naturally comfortable."},
                {"id": "casing", "step": "02", "name": "THIN COTTON ZIP COVER", "description": "A breathable protective layer designed for everyday comfort."},
                {"id": "core", "step": "03", "name": "GOLS-CERTIFIED 100% ORGANIC LATEX CORE", "description": "Naturally responsive support at the heart of the mattress."},
            ],
        },
    },
    {
        "type": "seven_zones_support",
        "name": "7-Zone Support & Benefits Strip",
        "category": "Product Anatomy & Benefits",
        "description": "Anatomical 7-zone body contouring diagram paired with an infinite-scroll benefits ticker.",
        "default_config": {
            "eyebrow": "WHAT MAKES US DIFFERENT?",
            "heading": "Support, Where Your Body Needs It.",
            "subheading": "Seven thoughtfully designed comfort zones work across the mattress to support different areas of your body.",
            "diagram_image_url": "https://cdn.phototourl.com/member/2026-09-22-feb051a4-db5e-4b7e-95ff-81f431f54595.png",
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
        "type": "organic_latex_process",
        "name": "Organic Dunlop Latex Process (8 Steps)",
        "category": "Storytelling & Process",
        "description": "Comprehensive 8-step visual walkthrough: tree tapping, water-washing, vulcanizing, and quality audit.",
        "default_config": {
            "heading": "How an Organic Latex Mattress Is Made ",
            "subheading": "From Kerala Rubber Tree Groves to Deep Restorative Sleep. Zero Petrochemicals.",
            "steps": [
                {"n": 1, "title": "Dawn Sap Harvesting", "body": "Organic Hevea brasiliensis trees are tapped at dawn in Kerala plantations without wounding the tree."},
                {"n": 2, "title": "Purification & Centrifuging", "body": "The sap is washed and centrifuged with pure water — zero synthetic fillers or petrochemicals."},
                {"n": 3, "title": "Aeration & Natural Foaming", "body": "Purified natural latex is whipped with natural air into a fine, micro-cellular breathable foam."},
                {"n": 4, "title": "Dunlop Steam Vulcanization", "body": "The Dunlop process bakes aerated latex in molds with pin-core heating rods for uniform anatomical density."},
                {"n": 5, "title": "Fresh Water Jet Washing", "body": "Solidified latex blocks undergo multiple fresh-water wash cycles to remove residual natural proteins."},
                {"n": 6, "title": "Thermostatic Convective Drying", "body": "The washed latex blocks enter slow-temperature drying tunnels to lock in cellular elasticity and resilience."},
                {"n": 7, "title": "7-Zone Anatomical Sculpting", "body": "Comfort and support layers are sculpted into seven differential firmness zones tuned for human skeletal ergonomics."},
                {"n": 8, "title": "Independent Testing & GOLS Audit", "body": "Every batch is verified against GOLS organic standards, eco-INSTITUT zero-VOC clearance, and LGA durability."},
            ],
        },
    },
    {
        "type": "certifications_badges",
        "name": "Certifications & Trust Explorer",
        "category": "Trust & Information",
        "description": "Verified seals and audit details for GOLS, eco-INSTITUT, FSC, LGA Durability, and OEKO-TEX.",
        "default_config": {
            "heading": "Certifications & Proof",
            "subheading": "Every certificate here is independently validated with evidence on file.",
            "cert_keys": ["gols", "eco-institut", "fsc", "lga", "oeko-tex"],
            "show_video": True,
        },
    },
    {
        "type": "testimonials_slider",
        "name": "Real Sleeper Testimonials",
        "category": "Social Proof",
        "description": "Verified customer quote cards highlighting pain-free sleep, purity, and fast delivery.",
        "default_config": {
            "heading": "Comfort, Naturally.",
            "subheading": "Real experiences from sleepers who switched to pure Dunlop latex.",
            "testimonials": [
                {"name": "Verified buyer — Pune", "text": "My lower-back stiffness eased within the first two weeks. The 7-zone feel is real — firm where it should be, soft at the shoulders.", "rating": 5},
                {"name": "Verified buyer — Bengaluru", "text": "No chemical smell at all, which was the whole point of going organic. Delivery and setup were smooth.", "rating": 5},
                {"name": "Verified buyer — Kochi", "text": "Bought the crib mattress for my daughter; it is firm, breathable and light. Exactly what the pediatrician recommended.", "rating": 5},
            ],
        },
    },
    {
        "type": "cta_banner",
        "name": "Where Better Sleep Begins (Final CTA)",
        "category": "Hero & Banners",
        "description": "High-impact closing banner before footer with phone order hotline and Buy button.",
        "default_config": {
            "heading": "Where Better Sleep Begins.",
            "subheading": "Experience the contouring purity of 100% organic Dunlop latex with our 100-night home trial.",
            "cta_label": "Shop the collection",
            "cta_link": "/collections",
            "bg_color": "#16241C",
        },
    },
    {
        "type": "hero_slider",
        "name": "Hero Slider Banner",
        "category": "Hero & Banners",
        "description": "Dynamic carousel with headline, subtitle, CTA buttons, and background imagery.",
        "default_config": {
            "headline": "Engineered for Pain-Free Sleep",
            "subheadline": "7-Zone Orthopedic Memory Foam Mattress with Natural Latex",
            "cta_text": "Explore Mattresses",
            "cta_link": "/collections/mattresses",
        },
    },
    {
        "type": "product_grid",
        "name": "Featured Products Grid",
        "category": "Catalog & Storefront",
        "description": "Curated collection grid with live pricing from Catalog, discount tags, ratings, and instant add-to-cart.",
        "default_config": {"category_slug": "mattresses", "limit": 6, "badge": "Best Seller"},
    },
    {
        "type": "product_carousel",
        "name": "Product Carousel Reel",
        "category": "Catalog & Storefront",
        "description": "Horizontal swipeable mattress showcase with firm/soft scale and dimensions.",
        "default_config": {"title": "India's Most Recommended Mattresses", "auto_scroll": True},
    },
    {
        "type": "comparison_table",
        "name": "Feature Comparison Matrix",
        "category": "Trust & Information",
        "description": "Side-by-side comparison table of Kotson Ortho vs Traditional Foam vs Innerspring.",
        "default_config": {
            "competitors": ["Kotson 7-Zone", "Standard Memory Foam", "Coil Spring"],
            "criteria": ["Spinal Alignment", "Zero Motion Transfer", "Heat Dissipation", "Durability (10 Yr)"],
        },
    },
    {
        "type": "trial_100_night_banner",
        "name": "100-Night Trial Guarantee Banner",
        "category": "Trust & Information",
        "description": "Confidence builder banner explaining hassle-free 100-night trial and doorstep pickup.",
        "default_config": {
            "title": "Sleep on it for 100 Nights. Love it or Return It.",
            "points": ["100% Full Refund", "Zero Pickup Charges", "Donated to Charity"],
        },
    },
    {
        "type": "faq_accordion",
        "name": "FAQ Collapsible Accordion",
        "category": "Trust & Information",
        "description": "Categorized FAQ answers for trials, custom sizes, delivery, and care.",
        "default_config": {
            "items": [
                {"q": "How does the 100-night trial work?", "a": "Sleep on your Kotson mattress for at least 30 nights to adjust. If still not delighted, contact us for full refund and pickup."},
                {"q": "Can I order custom sizes for an antique bedframe?", "a": "Yes! We manufacture custom millimeter-precise sizes with 5-day dispatch."},
                {"q": "What is the warranty coverage?", "a": "Kotson mattresses carry a comprehensive 10-year warranty covering sagging over 1 inch and foam defects."},
            ],
        },
    },
    {
        "type": "newsletter_signup",
        "name": "VIP Sleep Club Email Capture",
        "category": "Engagement & Interactive",
        "description": "Newsletter banner offering exclusive sleep tips and an instant ₹1,000 discount voucher.",
        "default_config": {"discount_amount": "₹1,000", "placeholder": "Enter your work or personal email"},
    },
    {
        "type": "warranty_trust_block",
        "name": "10-Year Warranty Trust Block",
        "category": "Trust & Information",
        "description": "Official 10-year non-prorated sagging warranty terms and easy claim process.",
        "default_config": {"years": 10, "claim_tat": "48 Hours"},
    },
    {
        "type": "features_checklist",
        "name": "Core Benefits 4-Column Checklist",
        "category": "Trust & Information",
        "description": "Icon and bullet point overview of key mattress engineering benefits.",
        "default_config": {
            "items": [
                {"title": "Zero Motion Transfer", "desc": "Sleep undisturbed when partner moves"},
                {"title": "Spinal Alignment", "desc": "Doctor recommended posture support"},
                {"title": "Breathable Pin-Core", "desc": "Natural airflow cooling technology"},
                {"title": "Free Pan-India Delivery", "desc": "White-glove unboxing to bedroom"},
            ]
        },
    },
    {
        "type": "press_mentions",
        "name": "Press & Media Recognition Strip",
        "category": "Social Proof",
        "description": "Media logo strip (Architectural Digest, Economic Times, Vogue, YourStory).",
        "default_config": {"monochrome": True},
    },
    {
        "type": "customer_reviews_grid",
        "name": "Customer Star Reviews Grid",
        "category": "Social Proof",
        "description": "Card grid of verified buyer reviews with rating stars, city badges, and mattress model purchased.",
        "default_config": {"limit": 6, "minimum_rating": 5},
    },
    {
        "type": "sleep_quiz_promo",
        "name": "Interactive Sleep Quiz Teaser",
        "category": "Engagement & Interactive",
        "description": "Teaser card inviting customers to find their ideal mattress firmness in 60 seconds.",
        "default_config": {
            "title": "Unsure Which Mattress Fits Your Sleeping Posture?",
            "subtitle": "Answer 4 questions to find your personalized firmness match.",
            "button_text": "Start 60-Second Quiz",
            "button_link": "/quiz",
        },
    },
    {
        "type": "instagram_feed",
        "name": "Shoppable Instagram Reel/Feed",
        "category": "Social Proof",
        "description": "Social feed showcase displaying customer bedrooms with tagged products.",
        "default_config": {"hashtag": "#KotsonSleep", "columns": 5},
    },
    {
        "type": "custom_html",
        "name": "Custom Rich Text & HTML",
        "category": "Custom",
        "description": "Embed custom widgets, raw HTML snippets, or rich formatted legal disclaimers.",
        "default_config": {"content": "<p>Custom content block</p>"},
    },
]


# ----------------- Section Types Catalogue -----------------

@router.get("/admin/cms/section-types")
async def get_section_types(user=Depends(require_role(OWNER, ADMIN))):
    """Returns the full 22 section types catalogue with schema and presets."""
    return SECTION_TYPES


@router.post("/admin/cms/migrate-existing-website")
async def trigger_cms_migration(user=Depends(require_role(OWNER, ADMIN))):
    """Triggers safe, idempotent one-time restoration of existing website pages and sections."""
    res = await ensure_cms_migrated()
    return res


@router.get("/admin/cms/overview")
async def get_cms_overview(user=Depends(require_role(OWNER, ADMIN))):
    """Overview statistics for CMS Visual Studio."""
    total_pages = await db.cms_pages.count_documents({})
    if total_pages == 0:
        await ensure_cms_migrated()

    total_pages = await db.cms_pages.count_documents({})
    published_pages = await db.cms_pages.count_documents({"status": "published"})
    draft_pages = await db.cms_pages.count_documents({"status": "draft"})
    
    pages = await db.cms_pages.find({}).to_list(100)
    total_sections = sum(len(p.get("sections", [])) for p in pages)
    
    versions_count = await db.cms_versions.count_documents({})
    
    return {
        "total_pages": total_pages,
        "published_pages": published_pages,
        "draft_pages": draft_pages,
        "total_sections": total_sections,
        "versions_count": versions_count,
        "section_types_count": len(SECTION_TYPES),
    }


# ----------------- Dynamic Pages & Sections Builder -----------------

@router.get("/cms/pages")
async def get_cms_pages(user=Depends(optional_user)):
    """List published pages publicly, or all pages if staff."""
    total_pages = await db.cms_pages.count_documents({})
    if total_pages == 0:
        await ensure_cms_migrated()

    query = {}
    is_staff = user and any(r in user.get("roles", []) for r in (OWNER, ADMIN))
    if not is_staff:
        query["status"] = "published"
    pages = await db.cms_pages.find(query).sort("title", 1).to_list(100)
    return [clean_doc(p) for p in pages]


@router.get("/cms/pages/{slug}")
async def get_cms_page_by_slug(slug: str, user=Depends(optional_user)):
    """Fetch page by slug."""
    is_staff = user and any(r in user.get("roles", []) for r in (OWNER, ADMIN))
    query = {"slug": slug.strip().lower()}
    if not is_staff:
        query["status"] = "published"
    page = await db.cms_pages.find_one(query)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return clean_doc(page)


@router.get("/admin/cms/pages/{page_id}")
async def get_admin_cms_page(page_id: str, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return clean_doc(page)


@router.post("/admin/cms/pages", status_code=201)
async def create_cms_page(input: CMSPageCreate, user=Depends(require_role(OWNER, ADMIN))):
    slug = input.slug.strip().lower().replace(" ", "-")
    existing = await db.cms_pages.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Page with slug '{slug}' already exists")

    doc = CMSPage(
        slug=slug,
        title=input.title.strip(),
        seo_title=input.seo_title or input.title.strip(),
        seo_description=input.seo_description,
        status=input.status or "draft",
        sections=input.sections or [],
        created_at=now_utc(),
        updated_at=now_utc(),
    ).model_dump()

    await db.cms_pages.insert_one(doc)
    await audit(user, "cms.page.create", "cms_page", doc["id"], f"Created page {slug}")
    return clean_doc(doc)


@router.put("/admin/cms/pages/{page_id}")
async def update_cms_page_full(page_id: str, input: CMSPageUpdate, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if "slug" in patch:
        patch["slug"] = patch["slug"].strip().lower().replace(" ", "-")
        conflict = await db.cms_pages.find_one({"slug": patch["slug"], "id": {"$ne": page_id}})
        if conflict:
            raise HTTPException(status_code=409, detail=f"Slug '{patch['slug']}' is already in use")

    patch["updated_at"] = now_utc()
    await db.cms_pages.update_one({"id": page_id}, {"$set": patch})
    await audit(user, "cms.page.update", "cms_page", page_id, f"Updated {list(patch.keys())}")
    updated = await db.cms_pages.find_one({"id": page_id})
    return clean_doc(updated)


@router.post("/admin/cms/pages/{page_id}/duplicate")
async def duplicate_cms_page(page_id: str, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    new_slug = f"{page['slug']}-copy-{uuid.uuid4().hex[:4]}"
    new_page = {
        **page,
        "id": str(uuid.uuid4()),
        "title": f"{page['title']} (Copy)",
        "slug": new_slug,
        "status": "draft",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    if "_id" in new_page:
        del new_page["_id"]
        
    await db.cms_pages.insert_one(new_page)
    await audit(user, "cms.page.duplicate", "cms_page", new_page["id"], f"Cloned {page['slug']} -> {new_slug}")
    return clean_doc(new_page)


@router.delete("/admin/cms/pages/{page_id}")
async def delete_cms_page(page_id: str, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if page.get("is_system_page") or page.get("slug") == "home":
        raise HTTPException(status_code=400, detail="Cannot delete core system homepage")
        
    await db.cms_pages.delete_one({"id": page_id})
    await audit(user, "cms.page.delete", "cms_page", page_id, f"Deleted page {page.get('slug')}")
    return {"status": "success", "message": "Page deleted"}


# ----------------- Section Management -----------------

@router.post("/admin/cms/pages/{page_id}/sections")
async def add_page_section(page_id: str, section: CMSSection, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    sec_dict = section.model_dump()
    if not sec_dict.get("id"):
        sec_dict["id"] = str(uuid.uuid4())
    
    sections = page.get("sections", [])
    sec_dict["order"] = len(sections)
    
    await db.cms_pages.update_one(
        {"id": page_id},
        {"$push": {"sections": sec_dict}, "$set": {"updated_at": now_utc()}}
    )
    await audit(user, "cms.section.add", "cms_page", page_id, f"Added section {sec_dict.get('type')}")
    return clean_doc(sec_dict)


@router.put("/admin/cms/pages/{page_id}/sections/{section_id}")
async def update_page_section(page_id: str, section_id: str, section_data: dict, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    sections = page.get("sections", [])
    found = False
    new_sections = []
    for s in sections:
        if s.get("id") == section_id:
            found = True
            updated_s = {**s, **section_data, "id": section_id}
            new_sections.append(updated_s)
        else:
            new_sections.append(s)
            
    if not found:
        raise HTTPException(status_code=404, detail="Section not found on page")

    await db.cms_pages.update_one(
        {"id": page_id},
        {"$set": {"sections": new_sections, "updated_at": now_utc()}}
    )
    return {"status": "success", "message": "Section updated"}


@router.delete("/admin/cms/pages/{page_id}/sections/{section_id}")
async def delete_page_section(page_id: str, section_id: str, user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    sections = [s for s in page.get("sections", []) if s.get("id") != section_id]
    # Re-index order
    for idx, s in enumerate(sections):
        s["order"] = idx

    await db.cms_pages.update_one(
        {"id": page_id},
        {"$set": {"sections": sections, "updated_at": now_utc()}}
    )
    await audit(user, "cms.section.delete", "cms_page", page_id, f"Deleted section {section_id}")
    return {"status": "success", "message": "Section deleted"}


@router.put("/admin/cms/pages/{page_id}/sections/reorder")
async def reorder_page_sections(page_id: str, section_ids: List[str], user=Depends(require_role(OWNER, ADMIN))):
    page = await db.cms_pages.find_one({"id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    sec_map = {s.get("id"): s for s in page.get("sections", [])}
    reordered = []
    for idx, sid in enumerate(section_ids):
        if sid in sec_map:
            sec = sec_map[sid]
            sec["order"] = idx
            reordered.append(sec)

    # Append any remaining that were not in section_ids list
    for sid, sec in sec_map.items():
        if sid not in section_ids:
            sec["order"] = len(reordered)
            reordered.append(sec)

    await db.cms_pages.update_one(
        {"id": page_id},
        {"$set": {"sections": reordered, "updated_at": now_utc()}}
    )
    return {"status": "success", "message": "Sections reordered"}


# ----------------- Header & Navigation -----------------

@router.get("/cms/header")
@router.get("/admin/cms/header")
async def get_cms_header():
    header = await db.cms_header.find_one({"id": "main_header"})
    if not header:
        default_header = HeaderConfig(
            nav_items=[
                CMSNavItem(label="Mattresses", href="/collections/mattresses", order=0).model_dump(),
                CMSNavItem(label="Pillows", href="/collections/pillows", order=1).model_dump(),
                CMSNavItem(label="Toppers", href="/collections/toppers", order=2).model_dump(),
                CMSNavItem(label="About Us", href="/about", order=3).model_dump(),
                CMSNavItem(label="Track Order", href="/track-order", order=4).model_dump(),
            ]
        ).model_dump()
        default_header["id"] = "main_header"
        await db.cms_header.insert_one(default_header)
        header = default_header
    return clean_doc(header)


@router.put("/admin/cms/header")
async def update_cms_header(input: HeaderConfig, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = "main_header"
    doc["updated_at"] = now_utc()
    await db.cms_header.update_one({"id": "main_header"}, {"$set": doc}, upsert=True)
    await audit(user, "cms.header.update", "cms_header", "main_header", "Updated header navigation and announcement")
    return clean_doc(doc)


# ----------------- Footer -----------------

@router.get("/cms/footer")
@router.get("/admin/cms/footer")
async def get_cms_footer():
    footer = await db.cms_footer_config.find_one({"id": "main_footer"})
    if not footer:
        default_footer = FooterConfig(
            columns=[
                FooterColumn(title="Products", links=[
                    {"label": "7-Zone Ortho Mattress", "href": "/products/kotson-7-zone-ortho"},
                    {"label": "Royal Hybrid Pocket Spring", "href": "/products/kotson-hybrid-spring"},
                    {"label": "Natural Pin-Core Latex", "href": "/products/kotson-pure-latex"},
                    {"label": "Memory Foam Pillows", "href": "/collections/pillows"},
                ]),
                FooterColumn(title="Customer Care", links=[
                    {"label": "100-Night Free Trial", "href": "/trial-policy"},
                    {"label": "10-Year Warranty Claim", "href": "/warranty"},
                    {"label": "Track Doorstep Delivery", "href": "/track-order"},
                    {"label": "Contact Sleep Experts", "href": "/contact"},
                ]),
                FooterColumn(title="Company", links=[
                    {"label": "Our Sleep Philosophy", "href": "/about"},
                    {"label": "Verified Certifications", "href": "/claims-trust"},
                    {"label": "Dealer Partner Network", "href": "/dealer/apply"},
                    {"label": "Refer & Earn Program", "href": "/referrals"},
                ]),
            ]
        ).model_dump()
        default_footer["id"] = "main_footer"
        await db.cms_footer_config.insert_one(default_footer)
        footer = default_footer
    return clean_doc(footer)


@router.put("/admin/cms/footer")
async def update_cms_footer(input: FooterConfig, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = "main_footer"
    doc["updated_at"] = now_utc()
    await db.cms_footer_config.update_one({"id": "main_footer"}, {"$set": doc}, upsert=True)
    await audit(user, "cms.footer.update", "cms_footer", "main_footer", "Updated footer columns & social links")
    return clean_doc(doc)


# ----------------- Branding & Theme -----------------

@router.get("/cms/branding")
@router.get("/admin/cms/branding")
async def get_cms_branding():
    branding = await db.cms_branding.find_one({"id": "main_branding"})
    if not branding:
        default_b = BrandingConfig().model_dump()
        default_b["id"] = "main_branding"
        await db.cms_branding.insert_one(default_b)
        branding = default_b
    return clean_doc(branding)


@router.put("/admin/cms/branding")
async def update_cms_branding(input: BrandingConfig, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.cms_branding.find_one({"id": "main_branding"}) or {}
    history = existing.get("history", [])
    
    # Snapshot current logo for rollback history
    if existing.get("main_logo_url"):
        history.append({
            "main_logo_url": existing.get("main_logo_url"),
            "light_logo_url": existing.get("light_logo_url"),
            "updated_at": now_utc(),
            "updated_by": user.get("email"),
        })
    
    doc = input.model_dump()
    doc["id"] = "main_branding"
    doc["history"] = history[-10:]  # Keep last 10 snapshots
    doc["updated_at"] = now_utc()
    
    await db.cms_branding.update_one({"id": "main_branding"}, {"$set": doc}, upsert=True)
    await audit(user, "cms.branding.update", "cms_branding", "main_branding", "Updated logos and branding tokens")
    return clean_doc(doc)


# ----------------- Safe Publish / Versioning / Rollback -----------------

@router.post("/admin/cms/publish")
async def publish_cms_changes(note: Optional[str] = "Owner website publication", user=Depends(require_role(OWNER, ADMIN))):
    """Creates an authoritative snapshot version and marks draft pages as published."""
    # 1. Fetch current snapshot of pages, header, footer, branding
    pages = await db.cms_pages.find({}).to_list(200)
    header = await db.cms_header.find_one({"id": "main_header"})
    footer = await db.cms_footer_config.find_one({"id": "main_footer"})
    branding = await db.cms_branding.find_one({"id": "main_branding"})
    
    version_id = f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    snapshot = {
        "id": version_id,
        "note": note,
        "published_by": user.get("email"),
        "published_at": now_utc(),
        "pages": [clean_doc(p) for p in pages],
        "header": clean_doc(header) if header else {},
        "footer": clean_doc(footer) if footer else {},
        "branding": clean_doc(branding) if branding else {},
    }
    await db.cms_versions.insert_one(snapshot)

    # 2. Mark draft pages as published
    await db.cms_pages.update_many({"status": "draft"}, {"$set": {"status": "published", "updated_at": now_utc()}})
    await audit(user, "cms.publish", "cms", version_id, f"Published live site checkpoint {version_id}: {note}")
    
    return {
        "status": "success",
        "version_id": version_id,
        "message": f"Website published successfully at version {version_id}",
    }


@router.get("/admin/cms/versions")
async def list_cms_versions(user=Depends(require_role(OWNER, ADMIN))):
    """Lists published checkpoints for safe one-click rollback."""
    versions = await db.cms_versions.find({}, {"id": 1, "note": 1, "published_by": 1, "published_at": 1}).sort("published_at", -1).to_list(30)
    return [clean_doc(v) for v in versions]


@router.post("/admin/cms/rollback")
async def rollback_cms_version(version_id: str, user=Depends(require_role(OWNER, ADMIN))):
    """Rolls back the live website to a previously captured version checkpoint."""
    checkpoint = await db.cms_versions.find_one({"id": version_id})
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Version checkpoint not found")

    # Restore pages
    if "pages" in checkpoint and checkpoint["pages"]:
        await db.cms_pages.delete_many({})
        docs = [dict(p) for p in checkpoint["pages"]]
        await db.cms_pages.insert_many(docs)

    # Restore header
    if checkpoint.get("header"):
        h = dict(checkpoint["header"])
        h["id"] = "main_header"
        await db.cms_header.update_one({"id": "main_header"}, {"$set": h}, upsert=True)

    # Restore footer
    if checkpoint.get("footer"):
        f = dict(checkpoint["footer"])
        f["id"] = "main_footer"
        await db.cms_footer_config.update_one({"id": "main_footer"}, {"$set": f}, upsert=True)

    # Restore branding
    if checkpoint.get("branding"):
        b = dict(checkpoint["branding"])
        b["id"] = "main_branding"
        await db.cms_branding.update_one({"id": "main_branding"}, {"$set": b}, upsert=True)

    await audit(user, "cms.rollback", "cms", version_id, f"Rolled back website state to version {version_id}")
    return {"status": "success", "message": f"Rolled back to version {version_id} successfully"}
