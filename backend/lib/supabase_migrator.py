"""Supabase / PostgreSQL Schema Migration Engine.

Reads version-controlled SQL files in `backend/migrations/*.sql`
and applies them idempotently to PostgreSQL via `DATABASE_URL`.
Tracks applied migrations in `schema_migrations` table.
"""

import logging
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


async def apply_supabase_migrations() -> List[str]:
    """Execute all pending SQL migrations against PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not database_url or database_url.startswith("postgresql://postgres:your-password"):
        logger.info("DATABASE_URL not configured for live PostgreSQL. Migrations ready on disk in %s", MIGRATIONS_DIR)
        return []

    try:
        import asyncpg
    except ImportError:
        logger.warning("asyncpg not installed, skipping migration execution")
        return []

    applied = []
    try:
        conn = await asyncpg.connect(database_url)
        try:
            # Ensure schema_migrations table exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Fetch applied migration versions
            rows = await conn.fetch("SELECT version FROM schema_migrations;")
            applied_versions = {r["version"] for r in rows}

            # Find all .sql files in migrations dir sorted alphabetically
            migration_files = sorted(list(MIGRATIONS_DIR.glob("*.sql")))
            for mfile in migration_files:
                version = mfile.name
                if version in applied_versions:
                    continue

                logger.info("Applying migration %s...", version)
                sql_content = mfile.read_text(encoding="utf-8")
                
                # Execute migration inside transaction
                async with conn.transaction():
                    await conn.execute(sql_content)
                    await conn.execute("INSERT INTO schema_migrations (version) VALUES ($1);", version)
                applied.append(version)
                logger.info("Successfully applied migration %s", version)

        finally:
            await conn.close()
    except Exception as exc:
        logger.error("Error executing Supabase / PostgreSQL migrations: %s", exc)

    return applied
