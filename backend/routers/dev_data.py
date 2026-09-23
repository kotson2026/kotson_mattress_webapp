"""Router for managing Kotson Development & Test Data."""

from fastapi import APIRouter, Depends, HTTPException
from lib.db import db
from lib.security import OWNER, require_role, now_utc
from lib.test_data_seed import (
    seed_kotson_test_data,
    remove_kotson_test_data,
    get_test_data_status,
    SEED_BATCH_ID,
)

router = APIRouter(tags=["test-data"])


@router.get("/admin/test-data/status")
async def test_data_status(user=Depends(require_role(OWNER, "admin", "crm_master"))):
    """Returns whether seed test data is active and the count of seeded records."""
    return await get_test_data_status(db)


@router.post("/admin/test-data/seed")
async def trigger_seed_test_data(user=Depends(require_role(OWNER))):
    """Strictly OWNER_ADMIN only: Idempotently seeds realistic test data."""
    res = await seed_kotson_test_data(db, force=False)
    # Log privileged action
    await db.audit_log.insert_one({
        "id": str(now_utc().timestamp()),
        "actor_id": user["id"],
        "actor_email": user["email"],
        "action": "test_data.seed",
        "entity": "seed_batch",
        "entity_id": SEED_BATCH_ID,
        "detail": f"Seeded test data batch {SEED_BATCH_ID}",
        "created_at": now_utc().isoformat(),
    })
    return res


@router.post("/admin/test-data/reset")
async def reset_test_data(user=Depends(require_role(OWNER))):
    """Strictly OWNER_ADMIN only: Purges existing test data and reseeds fresh."""
    res = await seed_kotson_test_data(db, force=True)
    await db.audit_log.insert_one({
        "id": str(now_utc().timestamp()),
        "actor_id": user["id"],
        "actor_email": user["email"],
        "action": "test_data.reset",
        "entity": "seed_batch",
        "entity_id": SEED_BATCH_ID,
        "detail": f"Purged and re-seeded test data batch {SEED_BATCH_ID}",
        "created_at": now_utc().isoformat(),
    })
    return res


@router.delete("/admin/test-data/cleanup")
async def cleanup_test_data(user=Depends(require_role(OWNER))):
    """Strictly OWNER_ADMIN only: Safely and completely purges all seeded test data in reverse dependency order."""
    res = await remove_kotson_test_data(db)
    await db.audit_log.insert_one({
        "id": str(now_utc().timestamp()),
        "actor_id": user["id"],
        "actor_email": user["email"],
        "action": "test_data.cleanup",
        "entity": "seed_batch",
        "entity_id": SEED_BATCH_ID,
        "detail": f"Purged all records for seed batch {SEED_BATCH_ID}",
        "created_at": now_utc().isoformat(),
    })
    return res
