"""Acceptance and regression tests for Kotson database provider architecture.

Verifies:
1. When DATABASE_PROVIDER=supabase, PostgresDatabase is returned, NEVER LocalJsonDatabase.
2. When DATABASE_PROVIDER=supabase, local JSON storage is NEVER modified or written to.
3. When DATABASE_PROVIDER=supabase and credentials are missing, startup fails closed safely.
4. When DATABASE_PROVIDER=local, LocalJsonDatabase functions properly for isolated development.
"""

import os
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


class TestDatabaseProviderSafety(unittest.TestCase):

    def test_fail_closed_when_supabase_unconfigured(self):
        """Startup must raise RuntimeError if DATABASE_PROVIDER=supabase but config is missing."""
        orig_env = dict(os.environ)
        try:
            os.environ["DATABASE_PROVIDER"] = "supabase"
            os.environ["SUPABASE_URL"] = ""
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
            os.environ["DATABASE_URL"] = ""
            os.environ["POSTGRES_URL"] = ""

            # Reload lib.supabase_client and lib.db to simulate startup
            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

            with self.assertRaises(RuntimeError) as ctx:
                import lib.db
            
            self.assertIn("Production Database Connection Failed for DATABASE_PROVIDER=supabase", str(ctx.exception))
        finally:
            os.environ.clear()
            os.environ.update(orig_env)
            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

    def test_supabase_mode_returns_postgres_database_never_local_json(self):
        """When DATABASE_PROVIDER=supabase, db MUST be PostgresDatabase and _local_db MUST be None."""
        orig_env = dict(os.environ)
        try:
            os.environ["DATABASE_PROVIDER"] = "supabase"
            os.environ["SUPABASE_URL"] = "https://kotson-real-project.supabase.co"
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "configured-service-key-xyz"
            os.environ["DATABASE_URL"] = "postgresql://postgres:configured@db.kotson-real-project.supabase.co:5432/postgres"

            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

            import lib.db
            from lib.postgres_adapter import PostgresDatabase

            # P0 Assertion: db must be an instance of PostgresDatabase
            self.assertIsInstance(lib.db.db, PostgresDatabase)
            self.assertEqual(type(lib.db.db).__name__, "PostgresDatabase")

            # P0 Assertion: LocalJsonDatabase must NOT be instantiated
            self.assertIsNone(lib.db._local_db)
            self.assertNotEqual(type(lib.db.db).__name__, "LocalJsonDatabase")

        finally:
            os.environ.clear()
            os.environ.update(orig_env)
            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

    def test_no_local_json_write_when_in_supabase_mode(self):
        """In supabase mode, calling save_snapshot does not modify or touch kotson_local_db.json."""
        orig_env = dict(os.environ)
        json_file = BACKEND_DIR / "data" / "kotson_local_db.json"
        initial_mtime = json_file.stat().st_mtime if json_file.exists() else None

        try:
            os.environ["DATABASE_PROVIDER"] = "supabase"
            os.environ["SUPABASE_URL"] = "https://kotson-real-project.supabase.co"
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "configured-service-key-xyz"
            os.environ["DATABASE_URL"] = "postgresql://postgres:configured@db.kotson-real-project.supabase.co:5432/postgres"

            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

            import lib.db
            # Trigger snapshot call
            lib.db.save_db_snapshot()

            current_mtime = json_file.stat().st_mtime if json_file.exists() else None
            self.assertEqual(initial_mtime, current_mtime, "kotson_local_db.json was modified in supabase mode!")

        finally:
            os.environ.clear()
            os.environ.update(orig_env)
            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

    def test_local_provider_mode(self):
        """When DATABASE_PROVIDER=local, LocalJsonDatabase is used for development."""
        orig_env = dict(os.environ)
        try:
            os.environ["DATABASE_PROVIDER"] = "local"

            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]

            import lib.db
            from lib.db import LocalJsonDatabase

            self.assertIsInstance(lib.db.db, LocalJsonDatabase)
            self.assertIsNotNone(lib.db._local_db)
            self.assertEqual(type(lib.db.db).__name__, "LocalJsonDatabase")

        finally:
            os.environ.clear()
            os.environ.update(orig_env)
            if "lib.supabase_client" in sys.modules:
                del sys.modules["lib.supabase_client"]
            if "lib.db" in sys.modules:
                del sys.modules["lib.db"]


if __name__ == "__main__":
    unittest.main()
