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

    print("Created:", created)
    print("ALL call options are INACTIVE drafts — activate them in /crm/dispositions after approving the wording.")
    print("Until activated, saving a call is correctly rejected: the empty state is honest, not fake.")


if __name__ == "__main__":
    asyncio.run(main())
