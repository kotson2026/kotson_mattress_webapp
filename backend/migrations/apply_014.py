import asyncio
import asyncpg
from pathlib import Path

DB_URL = "postgresql://postgres:LMeLkDNLHPeBj7uF@db.buodzslvzkungwufdkca.supabase.co:5432/postgres"

async def apply():
    sql_path = Path(__file__).parent / "014_kotson_business_operations.sql"
    sql = sql_path.read_text(encoding="utf-8")
    print(f"Connecting to database to apply {sql_path.name}...")
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute(sql)
        print("Migration 014 applied successfully!")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply())
