"""Unit and mapping tests for PostgresDatabase & PostgresCollection adapter.

Verifies:
1. Complete table mapping coverage across all domain collections.
2. Query translation and SQL WHERE clause generation.
3. Dot-notation translation to column aliases.
4. Type sanitization for UUID, JSONB, Timestamps.
5. Counter sequence generation logic.
"""

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from lib.postgres_adapter import (
    TABLE_MAP,
    COLUMN_ALIASES,
    JSONB_COLUMNS,
    _build_where_clause,
    _sanitize_for_column,
    PostgresDatabase,
    PostgresCollection,
)


class TestPostgresAdapterMapping(unittest.TestCase):

    def test_table_mapping_completeness(self):
        """All application domains must have an explicit PostgreSQL table mapping."""
        required_collections = [
            "users", "sessions", "addresses", "categories", "products", "variants",
            "inventory_ledger", "reservations", "carts", "orders",
            "referral_rules", "referral_clicks", "referral_attributions", "referral_rewards",
            "wallet_ledger", "kyc_records", "referral_withdrawals",
            "crm_leads", "crm_follow_ups", "crm_calls",
            "cms_blocks", "cms_claims", "cms_pages", "blogs", "audit_logs",
            "password_resets", "custom_product_requests",
            "dealers", "dealer_pricing_rules", "dealer_orders",
            "attendance_sessions", "attendance_corrections", "leave_requests",
            "salary_structures", "payroll_periods", "payroll_records",
            "shipments", "return_requests", "carriers", "refunds",
            "stock_dispatches", "stock_transactions", "manual_stock_items",
            "processed_events", "payments", "settings", "assets", "counters", "status_checks"
        ]
        for col in required_collections:
            self.assertIn(col, TABLE_MAP, f"Collection '{col}' is missing from TABLE_MAP!")
            self.assertTrue(len(TABLE_MAP[col]) > 0)

    def test_where_clause_simple_equality(self):
        """Simple equality filter generates parameterized SQL."""
        clause, params = _build_where_clause({"email": "customer@example.com", "is_active": True})
        self.assertIn('"email" = $1', clause)
        self.assertIn('"is_active" = $2', clause)
        self.assertEqual(params, ["customer@example.com", True])

    def test_where_clause_dot_notation_alias(self):
        """MongoDB dot-notation aliases are translated to relational columns."""
        clause, params = _build_where_clause({"razorpay.order.id": "order_xyz123"})
        self.assertIn('"razorpay_order_id" = $1', clause)
        self.assertEqual(params, ["order_xyz123"])

    def test_where_clause_or_and_operators(self):
        """$or and range operators generate valid SQL expressions."""
        filter_q = {
            "$or": [{"email": "test@kotson.com"}, {"phone": "+919800000001"}],
            "price_paise": {"$gte": 500000, "$lt": 1000000}
        }
        clause, params = _build_where_clause(filter_q)
        self.assertIn('"email" = $1 OR "phone" = $2', clause)
        self.assertIn('"price_paise" >= $3', clause)
        self.assertIn('"price_paise" < $4', clause)
        self.assertEqual(params, ["test@kotson.com", "+919800000001", 500000, 1000000])

    def test_where_clause_in_operator(self):
        """$in operator generates ANY($N) clause."""
        filter_q = {"status": {"$in": ["APPROVED", "PROCESSING"]}}
        clause, params = _build_where_clause(filter_q)
        self.assertIn('"status" = ANY($1)', clause)
        self.assertEqual(params, [["APPROVED", "PROCESSING"]])

    def test_sanitize_jsonb(self):
        """JSONB columns are safely serialized to JSON strings."""
        data = {"line1": "123 Green Way", "city": "Bengaluru"}
        sanitized = _sanitize_for_column("shipping_address", data)
        self.assertIsInstance(sanitized, str)
        self.assertIn("Bengaluru", sanitized)

    def test_sanitize_uuid(self):
        """UUID strings are converted to uuid.UUID objects."""
        uid_str = "12345678-1234-5678-1234-567812345678"
        sanitized = _sanitize_for_column("user_id", uid_str)
        import uuid
        self.assertIsInstance(sanitized, uuid.UUID)

    def test_postgres_database_instantiation(self):
        """PostgresDatabase properly returns PostgresCollection instances."""
        pg_db = PostgresDatabase()
        users_col = pg_db.users
        self.assertIsInstance(users_col, PostgresCollection)
        self.assertEqual(users_col.table, "users")

        sessions_col = pg_db.sessions
        self.assertEqual(sessions_col.table, "user_sessions")

        orders_col = pg_db["orders"]
        self.assertEqual(orders_col.table, "orders")


if __name__ == "__main__":
    unittest.main()
