"""Secure, Idempotent Owner Admin Bootstrapper.

Initializes the authoritative Owner Admin account from server-side environment
variables (OWNER_EMAIL and SEED_OWNER_PASSWORD).
Guarantees:
- Password is never hardcoded.
- Never logs, echoes, or commits the password.
- Fully idempotent: will NOT overwrite an existing Owner Admin password.
- Safe to call during container startup or as an administrative CLI command.
"""

import asyncio
import logging
import os
import sys
import uuid
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env", override=True)

logger = logging.getLogger("kotson.bootstrap")


async def bootstrap_owner_admin() -> bool:
    """Ensure Owner Admin account exists in the authoritative database."""
    from lib.db import db
    from lib.security import hash_password, now_utc, normalize_email

    owner_email = normalize_email(os.environ.get("OWNER_EMAIL", "hello@kotsonmattress.com"))
    existing_owner = await db.users.find_one({"email": owner_email})

    if existing_owner:
        logger.info("[BOOTSTRAP] Owner Admin account (%s) already exists. Skipping bootstrap.", owner_email)
        return True

    owner_password = os.environ.get("SEED_OWNER_PASSWORD", "").strip()
    if not owner_password:
        logger.info(
            "[BOOTSTRAP] Owner Admin account (%s) not found and SEED_OWNER_PASSWORD is not configured. "
            "Skipping bootstrap. Normal startup proceeds.",
            owner_email
        )
        return False

    owner_phone = os.environ.get("OWNER_PHONE", "").strip() or None
    password_hash = hash_password(owner_password)
    owner_doc = {
        "id": str(uuid.uuid4()),
        "email": owner_email,
        "phone": owner_phone,
        "name": "Kotson Owner Admin",
        "password_hash": password_hash,
        "roles": ["owner", "admin"],
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    await db.users.insert_one(owner_doc)
    logger.info("[BOOTSTRAP] Authoritative Owner Admin account (%s) successfully bootstrapped into database.", owner_email)
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    asyncio.run(bootstrap_owner_admin())
