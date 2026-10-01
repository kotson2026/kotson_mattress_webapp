import psycopg2

env = {}
with open('backend/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

with open('backend/migrations/019_kotson_product_reviews.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

conn = psycopg2.connect(env['DATABASE_URL'])
conn.autocommit = True
cur = conn.cursor()
cur.execute(sql)
print("Migration 019 applied successfully!")
cur.close()
conn.close()
