"""Order/stock domain services. Runs only on the server — never duplicated in the browser.

Money is integer paise. Stock safety model (standalone mongod — no multi-doc transactions):
- Reservation: single atomic conditional update on the variant doc ($expr guard), so two
  concurrent checkouts can never both reserve the last unit.
- Finalization: idempotent guarded transition (payment_status pending -> paid) via
  find_one_and_update, so a retry can never double-allocate stock or double-accrue rewards.
"""

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from lib.db import db

logger = logging.getLogger(__name__)

RESERVATION_TTL_MINUTES = 15


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def clean_doc(doc: dict) -> dict:
    """Strip Mongo internals and normalize datetimes to aware UTC."""
    out = {k: v for k, v in doc.items() if k != "_id" or isinstance(v, ObjectId) is False}
    out.pop("_id", None)
    for k, v in out.items():
        if isinstance(v, datetime):
            out[k] = v.replace(tzinfo=timezone.utc)
    return out


async def reserve_stock(order_id: str, items: list[dict]) -> list[dict]:
    """items: [{variant_id, qty}]. Atomic per-variant conditional decrement of free stock.
    Raises ValueError naming the variant when stock is unavailable."""
    reservations = []
    for item in items:
        vid = item["variant_id"]
        qty = int(item["qty"])
        variant = await db.variants.find_one_and_update(
            {
                "id": vid,
                "$expr": {"$gte": [{"$subtract": ["$stock", "$reserved"]}, qty]},
            },
            {"$inc": {"reserved": qty}},
            return_document=True,
        )
        if variant is None:
            # roll back anything already reserved for this order
            await release_order_reservations(order_id, status="released")
            raise ValueError(f"Insufficient stock for {variant_display(vid) if not isinstance(vid, str) else vid}")
        res = {
            "id": str(__import__("uuid").uuid4()),
            "order_id": order_id,
            "variant_id": vid,
            "qty": qty,
            "status": "active",
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(minutes=RESERVATION_TTL_MINUTES),
        }
        await db.reservations.insert_one(dict(res))
        reservations.append(res)
    return reservations


def variant_display(vid: str) -> str:
    return f"variant {vid}"


async def release_order_reservations(order_id: str, status: str = "released", reason: str = "") -> None:
    cursor = db.reservations.find({"order_id": order_id, "status": "active"})
    async for res in cursor:
        await db.reservations.update_one({"id": res["id"]}, {"$set": {"status": status}})
        await db.variants.update_one({"id": res["variant_id"]}, {"$inc": {"reserved": -int(res["qty"])}})
    if status == "released":
        await db.orders.update_one({"id": order_id}, {"$set": {"reservation_status": status, "reservation_note": reason}})


async def consume_order_reservations(order_id: str) -> int:
    """Active reservations -> consumed; decrement real stock with ledger entries."""
    cursor = db.reservations.find({"order_id": order_id, "status": "active"})
    moved = 0
    async for res in cursor:
        qty = int(res["qty"])
        variant = await db.variants.find_one_and_update(
            {"id": res["variant_id"], "reserved": {"$gte": qty}, "stock": {"$gte": qty}},
            {"$inc": {"reserved": -qty, "stock": -qty}},
        )
        await db.reservations.update_one({"id": res["id"]}, {"$set": {"status": "consumed"}})
        if variant:
            moved += qty
            await db.inventory_ledger.insert_one(
                {
                    "id": str(__import__("uuid").uuid4()),
                    "variant_id": res["variant_id"],
                    "sku": variant.get("sku"),
                    "delta": -qty,
                    "old_stock": variant.get("stock", 0) + qty,
                    "new_stock": variant.get("stock", 0),
                    "reason": f"order {order_id} allocation",
                    "actor_id": "system",
                    "created_at": now_utc(),
                }
            )
        else:
            logger.error("reservation consume failed for %s (variant %s)", res["id"], res["variant_id"])
    return moved


async def sweep_expired_reservations() -> int:
    """Background reconciliation: release lapsed reservations so stock returns to sale."""
    cursor = db.reservations.find({"status": "active", "expires_at": {"$lt": now_utc()}})
    count = 0
    async for res in cursor:
        await db.reservations.update_one({"id": res["id"]}, {"$set": {"status": "expired"}})
        await db.variants.update_one({"id": res["variant_id"]}, {"$inc": {"reserved": -int(res["qty"])}})
        await db.orders.update_one(
            {"id": res["order_id"], "payment_status": "pending"},
            {
                "$set": {"reservation_status": "expired"},
                "$push": {
                    "events": {
                        "at": now_utc(),
                        "type": "reservation_expired",
                        "detail": "Stock reservation expired before payment; stock returned to sale",
                    }
                },
            },
        )
        count += 1
    return count


async def record_reward_ledger(entry: dict) -> None:
    """Append-only reward ledger with idempotency on (order_id, code, type)."""
    existing = await db.reward_ledger.find_one(
        {"order_id": entry.get("order_id"), "code": entry.get("code"), "type": entry.get("type")}
    )
    if existing:
        return
    await db.reward_ledger.insert_one({"created_at": now_utc(), **entry})
