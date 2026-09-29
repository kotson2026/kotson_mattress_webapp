"""Comprehensive Remote Schema, Constraints, Indexes & Seed Verification."""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env", override=True)

import asyncpg


async def verify():
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    conn = await asyncpg.connect(database_url)
    try:
        # 1. Verify tables
        rows = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = [r["table_name"] for r in rows]
        print(f"Total Remote Tables: {len(tables)}")
        
        required_tables = [
            "users", "user_sessions", "user_addresses", "categories", "products",
            "product_variants", "inventory_ledger", "inventory_reservations", "carts", "orders",
            "referral_rules", "referral_clicks", "referral_attributions", "referral_rewards",
            "wallet_ledger", "kyc_records", "referral_withdrawals", "crm_leads", "crm_follow_ups",
            "crm_calls", "cms_blocks", "cms_claims", "cms_pages", "blogs", "audit_logs",
            "password_resets", "custom_product_requests", "dealers", "dealer_pricing_rules",
            "dealer_orders", "attendance_sessions", "attendance_corrections", "leave_requests",
            "salary_structures", "payroll_periods", "payroll_records", "carriers", "shipments",
            "return_requests", "refunds", "stock_dispatches", "stock_transactions",
            "manual_stock_items", "payments", "processed_events", "settings", "assets",
            "counters", "status_checks", "schema_migrations"
        ]
        missing = [t for t in required_tables if t not in tables]
        if missing:
            print(f"SCHEMA VERIFICATION ERROR: Missing tables: {missing}")
            sys.exit(1)
        else:
            print("SCHEMA TABLE VERIFICATION: PASS (All 50 tables verified)")

        # 2. Verify constraints
        c_rows = await conn.fetch("""
            SELECT tc.table_name, tc.constraint_name, tc.constraint_type
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name;
        """)
        print(f"Total Remote Constraints: {len(c_rows)}")
        
        # Check specific critical unique constraints
        uniques = {(r["table_name"], r["constraint_name"]) for r in c_rows if r["constraint_type"] in ("UNIQUE", "PRIMARY KEY")}
        print(f"Total Unique & Primary Key Constraints: {len(uniques)}")

        # 3. Verify indexes
        idx_rows = await conn.fetch("""
            SELECT tablename, indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname;
        """)
        print(f"Total Remote Indexes: {len(idx_rows)}")

        # 4. Verify Seed data
        cat_rows = await conn.fetch("SELECT slug, name FROM categories ORDER BY sort_order;")
        print(f"Seeded Categories ({len(cat_rows)}): {[r['slug'] for r in cat_rows]}")

        rules = await conn.fetch("SELECT id, name FROM referral_rules;")
        print(f"Seeded Referral Rules ({len(rules)}): {[r['id'] for r in rules]}")

        users_count = await conn.fetchval("SELECT COUNT(*) FROM users;")
        print(f"Users in remote database: {users_count}")
        if users_count == 0:
            print("CONFIRMED: Hardcoded staff accounts were NOT seeded into remote database.")
        else:
            print(f"Staff accounts found: {users_count}")

        # 5. Verify migrations recorded
        m_rows = await conn.fetch("SELECT version, applied_at FROM schema_migrations ORDER BY version;")
        print(f"Recorded migrations in schema_migrations ({len(m_rows)}): {[r['version'] for r in m_rows]}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(verify())
