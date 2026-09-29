"""Supabase & PostgreSQL client connection layer.

Authoritative production database configuration for Kotson.
Connects via supabase-py and asyncpg pool using server-side privileged credentials.
Never exposes service role key to frontend.
"""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "") or os.environ.get("POSTGRES_URL", "")

_supabase_client = None
_pg_pool = None


def is_supabase_configured() -> bool:
    """Return True if valid Supabase URL and service role key or Database URL are configured."""
    has_api = bool(SUPABASE_URL and not SUPABASE_URL.startswith("https://your-project") and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY))
    has_db = bool(DATABASE_URL and not DATABASE_URL.startswith("postgresql://postgres:your-password"))
    return has_api or has_db


def get_supabase_client():
    """Return initialized server-side Supabase client using Service Role Key (privileged)."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not is_supabase_configured():
        return None

    try:
        from supabase import create_client, Client
        key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
        _supabase_client = create_client(SUPABASE_URL, key)
        logger.info("Initialized server-side Supabase client for %s", SUPABASE_URL)
        return _supabase_client
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        return None


async def get_pg_pool():
    """Return asyncpg connection pool to PostgreSQL."""
    global _pg_pool
    if _pg_pool is not None:
        return _pg_pool

    if not DATABASE_URL or DATABASE_URL.startswith("postgresql://postgres:your-password"):
        return None

    try:
        import asyncpg
        min_size = int(os.environ.get("DB_POOL_MIN", "1"))
        max_size = int(os.environ.get("DB_POOL_MAX", "4"))
        command_timeout = float(os.environ.get("DB_TIMEOUT", "30.0"))
        _pg_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=min_size,
            max_size=max_size,
            command_timeout=command_timeout,
        )
        logger.info(
            "Connected asyncpg pool to PostgreSQL at %s (min=%d, max=%d)",
            DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "local",
            min_size,
            max_size,
        )
        return _pg_pool
    except Exception as exc:
        logger.warning("Could not connect to PostgreSQL via asyncpg: %s", exc)
        return None
