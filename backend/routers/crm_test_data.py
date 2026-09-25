"""CRM Test Data endpoints for seeding and safely purging test records."""

from fastapi import APIRouter, Depends
from lib.crm_test_seed import has_active_test_data, purge_test_data, seed_realistic_crm_test_data
from lib.security import CRM_MASTER, OWNER, audit, require_role

router = APIRouter()

CRM_ADMINS = (OWNER, CRM_MASTER)


@router.get("/crm/test-data/status")
async def check_test_data_status(user=Depends(require_role(*CRM_ADMINS))):
    """Returns whether synthetic test data is currently active."""
    active = await has_active_test_data()
    return {"is_test_data_active": active}


@router.post("/crm/test-data/seed")
async def seed_test_data(user=Depends(require_role(*CRM_ADMINS))):
    """Seeds realistic Kotson CRM records marked is_test_data = True."""
    res = await seed_realistic_crm_test_data()
    await audit(user, "crm.test_data.seed", "crm_test_data", "all")
    return res


@router.post("/crm/test-data/purge")
async def remove_test_data(user=Depends(require_role(*CRM_ADMINS))):
    """Safely purges ONLY records explicitly marked is_test_data = True."""
    res = await purge_test_data()
    await audit(user, "crm.test_data.purge", "crm_test_data", "all")
    return {"message": "Test data purged successfully", "details": res}
