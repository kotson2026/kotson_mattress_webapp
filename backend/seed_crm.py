"""Seeds CRM configuration as INACTIVE DRAFTS awaiting owner approval, plus an intake pipeline.

Nothing here activates itself: an unapproved option must never appear in the agent's call form.
Idempotent — safe to re-run. Run: cd /app/backend && python seed_crm.py
"""

import asyncio
import uuid

from lib.db import db
from lib.security import now_utc

CONNECTIVITIES = [
    ("connected", "Connected", 1),
    ("not_connected", "Not Connected", 2),
]

DISPOSITIONS = [
    # code, label, connectivity, requires_outcome, sort
    ("call_done", "Call Done", "connected", True, 1),
    ("call_back", "Call Back", "connected", False, 2),
    ("call_disconnected", "Call Disconnected", "connected", False, 3),
    ("not_answering", "Not Answering", "not_connected", False, 4),
    ("busy", "Busy", "not_connected", False, 5),
    ("switched_off", "Switched Off", "not_connected", False, 6),
    ("wrong_number", "Wrong Number", "not_connected", False, 7),
    ("not_reachable", "Not Reachable", "not_connected", False, 8),
    ("nc_other", "Not Connected", "not_connected", False, 9),
]

OUTCOMES = [
    ("interested_in_product", "Interested in Product", 1),
    ("quote_requested", "Quote Requested", 2),
    ("purchase_commitment", "Purchase Commitment", 3),
    ("call_back_by_customer", "Call Back by Customer", 4),
    ("not_interested", "Not Interested", 5),
    ("budget_concern", "Budget Concern", 6),
    ("comparing_other_brands", "Comparing Other Brands", 7),
]

INTAKE_STAGES = [
    {"code": "new", "label": "New", "sort": 1, "is_won": False, "is_lost": False},
    {"code": "attempted", "label": "Attempted", "sort": 2, "is_won": False, "is_lost": False},
    {"code": "contacted", "label": "Contacted", "sort": 3, "is_won": False, "is_lost": False},
    {"code": "quote_shared", "label": "Quote Shared", "sort": 4, "is_won": False, "is_lost": False},
    {"code": "negotiation", "label": "Negotiation", "sort": 5, "is_won": False, "is_lost": False},
    {"code": "won", "label": "Won (paid order)", "sort": 6, "is_won": True, "is_lost": False},
    {"code": "lost", "label": "Lost", "sort": 7, "is_won": False, "is_lost": True},
]

ENGAGEMENT_FIELDS = [
    {"code": "sleep_issue", "label": "Primary sleep issue", "type": "select", "required": True,
     "options": ["Back pain", "Body pain", "Heat / sweating", "Partner disturbance", "Old mattress", "Other"], "sort": 1},
    {"code": "size_required", "label": "Size required", "type": "select", "required": True,
     "options": ["Single", "Double", "Queen", "King", "Custom"], "sort": 2},
    {"code": "firmness_preference", "label": "Firmness preference", "type": "radio", "required": False,
     "options": ["Soft", "Medium", "Firm", "Not sure"], "sort": 3},
    {"code": "budget_band", "label": "Budget band (INR)", "type": "select", "required": False,
     "options": ["Under 20k", "20k-40k", "40k-60k", "60k+"], "sort": 4},
    {"code": "decision_timeline", "label": "Decision timeline", "type": "select", "required": False,
     "options": ["This week", "This month", "1-3 months", "Just exploring"], "sort": 5},
    {"code": "needs_trial_info", "label": "Asked about trial / warranty", "type": "checkbox", "required": False,
     "options": [], "sort": 6},
    {"code": "household_size", "label": "People sleeping on it", "type": "number", "required": False, "options": [], "sort": 7},
]


async def upsert(coll: str, match: dict, doc: dict) -> bool:
    if await db[coll].find_one(match):
        return False
    await db[coll].insert_one(doc)
    return True


async def main() -> None:
    print("Seeding CRM configuration as inactive drafts…")
    created = {"connectivity": 0, "disposition": 0, "outcome": 0, "pipeline": 0, "form": 0}

    for code, label, sort in CONNECTIVITIES:
        if await upsert("connectivities", {"code": code}, {
            "id": str(uuid.uuid4()), "code": code, "label": label, "sort": sort,
            "is_active": False,  # DRAFT — owner approves wording before agents see it
        }):
            created["connectivity"] += 1

    for code, label, conn, needs_outcome, sort in DISPOSITIONS:
        if await upsert("dispositions", {"code": code}, {
            "id": str(uuid.uuid4()), "code": code, "label": label,
            "connectivity_code": conn, "requires_outcome": needs_outcome,
            "sort": sort, "is_active": False,
        }):
            created["disposition"] += 1

    for code, label, sort in OUTCOMES:
        if await upsert("call_outcomes", {"code": code}, {
            "id": str(uuid.uuid4()), "code": code, "label": label, "sort": sort, "is_active": False,
        }):
            created["outcome"] += 1

    if await upsert("pipelines", {"code": "intake"}, {
        "id": str(uuid.uuid4()), "code": "intake", "name": "Kotson Intake",
        "kind": "intake", "stages": INTAKE_STAGES, "is_active": True, "created_at": now_utc(),
    }):
        created["pipeline"] += 1

    if await upsert("engagement_forms", {"code": "mattress-discovery"}, {
        "id": str(uuid.uuid4()), "code": "mattress-discovery", "name": "Mattress Discovery",
        "version": 1, "fields": ENGAGEMENT_FIELDS, "summary_field": "optional",
        "is_active": False, "created_at": now_utc(),
    }):
        created["form"] += 1

    # ── 5 Sales Pipelines with custom funnel stages ──────────────────
    def make_stages(product: str) -> list:
        return [
            {"code": "fresh_lead",      "label": "Fresh Lead",      "bucket": "IN_PROGRESS", "sort": 10, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#7C9C59", "require_follow_up": False, "require_note": False, "description": ""},
            {"code": "contacted",       "label": "Contacted",       "bucket": "IN_PROGRESS", "sort": 20, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#7C9C59", "require_follow_up": False, "require_note": False, "description": ""},
            {"code": "interested",      "label": "Interested",      "bucket": "IN_PROGRESS", "sort": 30, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#467065", "require_follow_up": True,  "require_note": False, "description": ""},
            {"code": "follow_up",       "label": "Follow-up",       "bucket": "IN_PROGRESS", "sort": 40, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#467065", "require_follow_up": True,  "require_note": False, "description": ""},
            {"code": "hot_lead",        "label": "Hot Lead",        "bucket": "IN_PROGRESS", "sort": 50, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#16241C", "require_follow_up": True,  "require_note": False, "description": ""},
            {"code": "order_initiated", "label": "Order Initiated", "bucket": "IN_PROGRESS", "sort": 60, "is_terminal": False, "is_won": False, "is_lost": False, "is_archived": False, "color": "#16241C", "require_follow_up": False, "require_note": True,  "description": ""},
            {"code": "converted",       "label": "Converted",       "bucket": "CONVERTED",   "sort": 70, "is_terminal": True,  "is_won": True,  "is_lost": False, "is_archived": False, "color": "#467065", "require_follow_up": False, "require_note": False, "description": ""},
            {"code": "not_interested",  "label": "Not Interested",  "bucket": "LOST",        "sort": 80, "is_terminal": True,  "is_won": False, "is_lost": True,  "is_archived": False, "color": "#EF4444", "require_follow_up": False, "require_note": True,  "description": ""},
            {"code": "unreachable",     "label": "Unreachable",     "bucket": "LOST",        "sort": 90, "is_terminal": True,  "is_won": False, "is_lost": True,  "is_archived": False, "color": "#EF4444", "require_follow_up": False, "require_note": False, "description": ""},
        ]

    PIPELINES = [
        {
            "code": "mattress-sales", "name": "Mattress Sales",
            "description": "Sales pipeline for all mattress enquiries and campaigns.",
            "pipeline_type": "Product Sales", "kind": "sales",
            "associated_products": ["Ortho Therapy Mattress", "Spine Balance Mattress", "Ortho Core Max Mattress"],
        },
        {
            "code": "pillow-sales", "name": "Pillow Sales",
            "description": "Sales pipeline for all pillow Categories.",
            "pipeline_type": "Product Category", "kind": "sales",
            "associated_products": ["Standard Pillow", "Ortho Wave Pillow", "Jumbo Pillow"],
        },
        {
            "code": "topper-sales", "name": "Topper Sales",
            "description": "Sales pipeline for mattress topper products.",
            "pipeline_type": "Product Sales", "kind": "sales",
            "associated_products": ["Kotson Topper"],
        },
        {
            "code": "baby-kids-sales", "name": "Baby + Kids Sales",
            "description": "Sales pipeline for baby and kids mattress range.",
            "pipeline_type": "Product Category", "kind": "sales",
            "associated_products": ["Baby Mattress", "Kids Mattress"],
        },
        {
            "code": "abandoned-cart-recovery", "name": "Abandoned Cart Recovery",
            "description": "Recovery pipeline for customers who abandoned cart without purchasing.",
            "pipeline_type": "Abandoned Cart", "kind": "sales",
            "associated_products": [],
        },
    ]

    pipeline_ids = {}
    for p_data in PIPELINES:
        pid = str(uuid.uuid4())
        pipeline_ids[p_data["code"]] = pid
        if await upsert("pipelines", {"code": p_data["code"]}, {
            "id": pid,
            "code": p_data["code"],
            "name": p_data["name"],
            "description": p_data["description"],
            "pipeline_type": p_data["pipeline_type"],
            "kind": p_data["kind"],
            "associated_products": p_data["associated_products"],
            "stages": make_stages(p_data["name"]),
            "is_active": True,
            "is_archived": False,
            "is_test_data": True,
            "created_at": now_utc(),
        }):
            created["pipeline"] += 1

    # ── 25 Campaigns (5 per pipeline) ────────────────────────────────
    CAMPAIGNS = [
        # Mattress Sales
        ("mattress-sales", "sep-website-mattress",    "September Website Mattress Leads",    "website",      "active"),
        ("mattress-sales", "hyd-mattress-campaign",   "Hyderabad Mattress Campaign",         "walk_in",      "active"),
        ("mattress-sales", "ortho-therapy-leads",     "Ortho Therapy Leads",                 "instagram",    "active"),
        ("mattress-sales", "spine-balance-leads",     "Spine Balance Leads",                 "google_ads",   "paused"),
        ("mattress-sales", "walkin-mattress-leads",   "Walk-in Mattress Leads",              "walk_in",      "active"),
        # Pillow Sales
        ("pillow-sales",   "website-pillow-leads",    "Website Pillow Leads",                "website",      "active"),
        ("pillow-sales",   "ortho-pillow-leads",      "Ortho Pillow Leads",                  "instagram",    "active"),
        ("pillow-sales",   "standard-pillow-leads",   "Standard Pillow Leads",               "google_ads",   "active"),
        ("pillow-sales",   "referral-pillow-leads",   "Referral Pillow Leads",               "referral",     "active"),
        ("pillow-sales",   "hyd-pillow-leads",        "Hyderabad Pillow Leads",              "walk_in",      "paused"),
        # Topper Sales
        ("topper-sales",   "sep-topper-leads",        "September Topper Leads",              "website",      "active"),
        ("topper-sales",   "topper-instagram",        "Topper Instagram Campaign",           "instagram",    "active"),
        ("topper-sales",   "topper-referral",         "Topper Referral Leads",               "referral",     "active"),
        ("topper-sales",   "topper-google-ads",       "Topper Google Ads",                   "google_ads",   "paused"),
        ("topper-sales",   "topper-walkin",           "Topper Walk-in Enquiries",            "walk_in",      "active"),
        # Baby + Kids
        ("baby-kids-sales","baby-mattress-leads",     "Baby Mattress Leads",                 "website",      "active"),
        ("baby-kids-sales","kids-mattress-referral",  "Kids Mattress Referral",              "referral",     "active"),
        ("baby-kids-sales","baby-instagram-leads",    "Baby Instagram Campaign",             "instagram",    "active"),
        ("baby-kids-sales","baby-google-ads",         "Baby + Kids Google Ads",              "google_ads",   "paused"),
        ("baby-kids-sales","baby-walkin",             "Baby Walk-in Enquiries",              "walk_in",      "active"),
        # Abandoned Cart
        ("abandoned-cart-recovery","cart-mattress-recovery",   "Mattress Cart Recovery",    "website",      "active"),
        ("abandoned-cart-recovery","cart-pillow-recovery",     "Pillow Cart Recovery",      "website",      "active"),
        ("abandoned-cart-recovery","cart-topper-recovery",     "Topper Cart Recovery",      "website",      "active"),
        ("abandoned-cart-recovery","cart-high-value-recovery", "High Value Cart Recovery",  "website",      "active"),
        ("abandoned-cart-recovery","cart-repeat-visitors",     "Repeat Visitor Recovery",   "website",      "paused"),
    ]

    camp_created = 0
    for pipeline_code, code, name, source, status in CAMPAIGNS:
        pid = pipeline_ids.get(pipeline_code)
        if not pid:
            continue
        cid = str(uuid.uuid4())
        if await upsert("campaigns", {"code": code}, {
            "id": cid, "code": code, "name": name,
            "pipeline_id": pid,
            "lead_source": source,
            "status": status,
            "manager_ids": [], "employee_ids": [],
            "associated_products": [],
            "target_count": 50,
            "is_active": status == "active",
            "is_test_data": True,
            "ad_metrics_source": "not_connected",
            "created_at": now_utc(),
        }):
            camp_created += 1

    print("Created:", created)
    print(f"Pipelines: {created['pipeline']} (5 Kotson sales pipelines with 9 custom stages each)")
    print(f"Campaigns: {camp_created} (25 campaigns across 5 pipelines)")
    print("ALL call options are INACTIVE drafts — activate them in /crm/dispositions after approving the wording.")
    print("Until activated, saving a call is correctly rejected: the empty state is honest, not fake.")


if __name__ == "__main__":
    asyncio.run(main())

