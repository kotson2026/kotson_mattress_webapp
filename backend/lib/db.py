"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("referral_code", ASCENDING)], name="referral_code", unique=True, sparse=True),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="session_ttl", expireAfterSeconds=0),
    ],
    "categories": [IndexModel([("slug", ASCENDING)], name="slug", unique=True)],
    "products": [
        IndexModel([("slug", ASCENDING)], name="slug", unique=True),
        IndexModel([("category_slug", ASCENDING), ("sort", ASCENDING)], name="category_sort"),
    ],
    "variants": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("sku", ASCENDING)], name="sku", unique=True),
        IndexModel([("product_id", ASCENDING)], name="product_id"),
    ],
    "carts": [IndexModel([("token", ASCENDING)], name="token", unique=True)],
    "orders": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("order_number", ASCENDING)], name="order_number", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("email", ASCENDING)], name="email"),
        IndexModel([("razorpay.order.id", ASCENDING)], name="rzp_order", sparse=True),
    ],
    "reservations": [
        IndexModel([("order_id", ASCENDING)], name="order_id"),
        IndexModel([("status", ASCENDING), ("expires_at", ASCENDING)], name="status_expiry"),
    ],
    "inventory_ledger": [IndexModel([("variant_id", ASCENDING), ("created_at", DESCENDING)], name="variant_created")],
    "blocks": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "claims": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "assets": [IndexModel([("slot", ASCENDING)], name="slot", unique=True)],
    "settings": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "inquiries": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("assignee_id", ASCENDING)], name="assignee", sparse=True),
    ],
    "crm_notes": [IndexModel([("customer_id", ASCENDING), ("created_at", DESCENDING)], name="customer_created")],
    "dealers": [
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "dealer_orders": [IndexModel([("dealer_id", ASCENDING), ("created_at", DESCENDING)], name="dealer_created")],
    "reward_ledger": [
        IndexModel([("order_id", ASCENDING), ("code", ASCENDING), ("type", ASCENDING)], name="order_code_type", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "referral_clicks": [IndexModel([("code", ASCENDING), ("created_at", DESCENDING)], name="code_created")],
    "referral_attributions": [IndexModel([("customer_id", ASCENDING)], name="customer", unique=True)],
    "processed_events": [IndexModel([("event_id", ASCENDING)], name="event_id", unique=True)],
    "audit_log": [IndexModel([("created_at", DESCENDING)], name="created_desc")],
    "counters": [],
    "affiliates": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "refunds": [IndexModel([("order_id", ASCENDING)], name="order_id")],
    "referral_rules": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    # --- CRM (Sections F/G) ---
    "source_events": [
        IndexModel([("event_key", ASCENDING)], name="event_key", unique=True),  # idempotency anchor
        IndexModel([("customer_id", ASCENDING), ("created_at", DESCENDING)], name="customer_created"),
        IndexModel([("guest_session", ASCENDING)], name="guest_session", sparse=True),
    ],
    "leads": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("lead_number", ASCENDING)], name="lead_number", unique=True),
        IndexModel([("customer_id", ASCENDING), ("kind", ASCENDING)], name="customer_kind"),
        IndexModel([("employee_id", ASCENDING), ("updated_at", DESCENDING)], name="employee_updated"),
        IndexModel([("manager_id", ASCENDING)], name="manager"),
        IndexModel([("email", ASCENDING)], name="email", sparse=True),
        IndexModel([("phone", ASCENDING)], name="phone", sparse=True),
        IndexModel([("qualification", ASCENDING), ("is_open", ASCENDING)], name="qualification_open"),
    ],
    "pipelines": [IndexModel([("code", ASCENDING)], name="code", unique=True)],
    "campaigns": [IndexModel([("code", ASCENDING)], name="code", unique=True)],
    "follow_ups": [
        IndexModel([("owner_id", ASCENDING), ("status", ASCENDING), ("due_at", ASCENDING)], name="owner_status_due"),
        IndexModel([("lead_id", ASCENDING)], name="lead"),
    ],
    "calls": [
        IndexModel([("lead_id", ASCENDING), ("created_at", DESCENDING)], name="lead_created"),
        IndexModel([("agent_id", ASCENDING)], name="agent"),
        IndexModel([("lead_id", ASCENDING), ("idempotency_key", ASCENDING)], name="call_idem", unique=True, sparse=True),
    ],
    "connectivities": [IndexModel([("code", ASCENDING)], name="code", unique=True)],
    "dispositions": [IndexModel([("code", ASCENDING)], name="code", unique=True)],
    "call_outcomes": [IndexModel([("code", ASCENDING)], name="code", unique=True)],
    "engagement_forms": [IndexModel([("code", ASCENDING), ("version", ASCENDING)], name="code_version", unique=True)],
    "service_cases": [
        IndexModel([("case_number", ASCENDING)], name="case_number", unique=True),
        IndexModel([("assignee_id", ASCENDING), ("status", ASCENDING)], name="assignee_status"),
        IndexModel([("customer_id", ASCENDING)], name="customer", sparse=True),
    ],
    # --- Order operations (Section H) ---
    "shipments": [
        IndexModel([("shipment_number", ASCENDING)], name="shipment_number", unique=True),
        IndexModel([("order_id", ASCENDING), ("created_at", ASCENDING)], name="order_created"),
    ],
    "return_requests": [
        IndexModel([("request_number", ASCENDING)], name="request_number", unique=True),
        IndexModel([("order_id", ASCENDING)], name="order"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],
    "announcements": [IndexModel([("sort", ASCENDING)], name="sort")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
