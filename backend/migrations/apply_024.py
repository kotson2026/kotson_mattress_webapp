import asyncio
import asyncpg
from pathlib import Path

DB_URL = "postgresql://postgres:LMeLkDNLHPeBj7uF@db.buodzslvzkungwufdkca.supabase.co:5432/postgres"

async def apply():
    sql_path = Path(__file__).parent / "024_fix_inventory_reservations_user_id_fk.sql"
    sql = sql_path.read_text(encoding="utf-8")
    print(f"Connecting to database to apply {sql_path.name}...")
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute(sql)
        print("Migration 024 applied successfully to production database!")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply())
