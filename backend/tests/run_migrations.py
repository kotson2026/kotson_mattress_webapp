"""Kotson Sequential Remote Migration Runner.

Executes migrations 001 through 010 sequentially, one by one, inside isolated
transactions. Halts immediately if any migration fails.
Tracks applied migrations in schema_migrations table.
Never prints or logs secret connection strings or passwords.
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env", override=True)

import asyncpg

MIGRATIONS_DIR = BACKEND_DIR / "migrations"


async def main():
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not database_url:
        print("MIGRATION_RUNNER: FAILED - DATABASE_URL not configured")
        sys.exit(1)

    print("Connecting to remote PostgreSQL database...")
    conn = await asyncpg.connect(database_url)
    try:
        # 1. Ensure schema_migrations table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)

        # 2. Get already applied versions
        rows = await conn.fetch("SELECT version FROM schema_migrations;")
        applied_versions = {r["version"] for r in rows}

        # 3. Find all migration files sorted
        migration_files = sorted(list(MIGRATIONS_DIR.glob("*.sql")))
        print(f"Total migration files detected on disk: {len(migration_files)}")

        for mfile in migration_files:
            version = mfile.name
            if version in applied_versions:
                print(f"Migration {version}: ALREADY APPLIED (SKIPPED)")
                continue

            print(f"Applying Migration {version}...")
            sql_content = mfile.read_text(encoding="utf-8")

            # Execute migration inside transaction
            try:
                async with conn.transaction():
                    await conn.execute(sql_content)
                    await conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING;",
                        version
                    )
                print(f"Migration {version}: SUCCESS")
            except Exception as exc:
                import re
                sanitized_err = re.sub(r':[^@/:]+@', ':***@', str(exc))
                print(f"Migration {version}: FAILED - {type(exc).__name__}: {sanitized_err}")
                print(f"STOPPING MIGRATION EXECUTION IMMEDIATELY. Failed at {version}.")
                sys.exit(2)

        print("ALL MIGRATIONS EXECUTED AND VERIFIED SUCCESSFULLY.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
