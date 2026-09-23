import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes


async def sweeper_loop():
    from lib.services import sweep_expired_reservations

    while True:
        try:
            await sweep_expired_reservations()
        except Exception:
            logger.exception("reservation sweeper failed")
        await asyncio.sleep(60)


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    app.state.sweeper_task = asyncio.create_task(sweeper_loop())  # reconciliation: releases expired stock reservations
    try:
        if await db.products.count_documents({}) == 0:
            import seed
            import seed_crm
            import seed_site_media
            await seed.main()
            await seed_crm.main()
            await seed_site_media.main()
        
        # Ensure CMS restoration of existing website pages and sections
        from lib.cms_migrator import ensure_cms_migrated
        await ensure_cms_migrated()
    except Exception as exc:
        logger.warning("Startup auto-seed / CMS migration check skipped or failed: %s", exc)
    yield
    app.state.sweeper_task.cancel()
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Resource routers (one module per resource) fold into the single /api router
from routers import (  # noqa: E402
    admin,
    auth,
    cart,
    catalog,
    checkout,
    content,
    crm,
    crm_calls,
    crm_leads,
    dealers,
    fulfilment,
    orders,
    referrals,
    site_media,
    sales,
    cms,
    dev_data,
    dispatch,
    assets,
    claims_trust,
)

api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(cart.router)
api_router.include_router(checkout.router)
api_router.include_router(orders.router)
api_router.include_router(content.router)
api_router.include_router(admin.router)
api_router.include_router(crm.router)
api_router.include_router(dealers.router)
api_router.include_router(referrals.router)
api_router.include_router(crm_leads.router)
api_router.include_router(crm_calls.router)
api_router.include_router(fulfilment.router)
api_router.include_router(site_media.router)
api_router.include_router(sales.router)
api_router.include_router(cms.router)
api_router.include_router(dev_data.router)
api_router.include_router(dispatch.router)
api_router.include_router(assets.router)
api_router.include_router(claims_trust.router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
