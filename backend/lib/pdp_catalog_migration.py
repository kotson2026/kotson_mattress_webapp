import asyncio
import os
import uuid
from lib.db import db
from lib.security import now_utc

P = 100  # rupees -> paise

# Ortho Therapy Variants
ORTHO_THERAPY = [
    # Queen (60" breadth)
    ("Queen", "72", "60", "6", 74000), ("Queen", "72", "60", "8", 80500), ("Queen", "72", "60", "10", 87000),
    ("Queen", "75", "60", "6", 78000), ("Queen", "75", "60", "8", 84500), ("Queen", "75", "60", "10", 91000),
    ("Queen", "78", "60", "6", 82000), ("Queen", "78", "60", "8", 88500), ("Queen", "78", "60", "10", 95000),
    # King (72" breadth)
    ("King", "72", "72", "6", 80000), ("King", "72", "72", "8", 86500), ("King", "72", "72", "10", 93000),
    ("King", "75", "72", "6", 83500), ("King", "75", "72", "8", 90000), ("King", "75", "72", "10", 96500),
    ("King", "78", "72", "6", 85000), ("King", "78", "72", "8", 91500), ("King", "78", "72", "10", 98000),
    ("King", "84", "72", "6", 90500), ("King", "84", "72", "8", 97500), ("King", "84", "72", "10", 104500),
]

# Spine Balance Variants
SPINE_BALANCE = [
    # Queen (60" breadth)
    ("Queen", "72", "60", "6", 72000), ("Queen", "72", "60", "8", 78500), ("Queen", "72", "60", "10", 85000),
    ("Queen", "75", "60", "6", 76000), ("Queen", "75", "60", "8", 82500), ("Queen", "75", "60", "10", 89000),
    ("Queen", "78", "60", "6", 80000), ("Queen", "78", "60", "8", 86500), ("Queen", "78", "60", "10", 93000),
    # King (72" breadth)
    ("King", "72", "72", "6", 78000), ("King", "72", "72", "8", 84500), ("King", "72", "72", "10", 91000),
    ("King", "75", "72", "6", 84500), ("King", "75", "72", "8", 88000), ("King", "75", "72", "10", 94500),
    ("King", "78", "72", "6", 83000), ("King", "78", "72", "8", 89500), ("King", "78", "72", "10", 96000),
    ("King", "84", "72", "6", 88500), ("King", "84", "72", "8", 95500), ("King", "84", "72", "10", 102500),
]

# Ortho Core Max Variants (Fixed Length 78)
ORTHO_CORE_MAX = [
    ("Queen", "78", "60", "6", 53000), ("Queen", "78", "60", "8", 59000), ("Queen", "78", "60", "10", 65000), ("Queen", "78", "60", "12", 71000),
    ("King", "78", "72", "6", 50000), ("King", "78", "72", "8", 56000), ("King", "78", "72", "10", 62000), ("King", "78", "72", "12", 68000),
]

# Topper Variants (Fixed Height 2)
TOPPER = [
    ("Queen", "72", "60", "2", 25000), ("Queen", "75", "60", "2", 26000), ("Queen", "78", "60", "2", 27000),
    ("King", "72", "72", "2", 28000), ("King", "75", "72", "2", 28000), ("King", "78", "72", "2", 29000),
]

# Pillows (length, breadth, height, price, name)
PILLOWS = [
    ("standard-classic-pillow", "60", "40", "13", 2899),
    ("standard-linea-pillow", "70", "40", "11", 3099),
    ("standard-flex-pillow", "60", "40", "15", 2199),
    ("standard-dudlis-pillow", "60", "40", None, 4299),
    ("ortho-wave-classic-pillow", "60", "40", "10/8", 3299),
    ("ortho-wave-linea-pillow", "70", "40", "10/8", 3299),
    ("ortho-wave-support-plus-pillow", "60", "40", "12/10", 3299),
    ("ortho-wave-acu-touch-pillow", "59", "36", "13/11", 3499),
    ("jumbo-pillow", "92", "40", "12", 3899),
    ("dualis-arc-pillow", "70", "43", None, 4899),
    ("dualis-travel-pillow", "43", "33", None, 1899),
    ("dualis-body-pillow", "183", None, None, 5399),
    ("natural-nest-junior-pillow", "48", "28", "9/7", 2099),
    ("natural-nest-mini-pillow", "44", "28", "6/6", 1899),
]

async def migrate_mattress_variants(slug, data, base_sku):
    product = await db.products.find_one({"slug": slug})
    if not product:
        print(f"Product {slug} not found.")
        return
    
    pid = product["id"]
    await db.variants.delete_many({"product_id": pid})
    print(f"Cleared old variants for {slug}")
    
    new_variants = []
    for i, (size, length, width, thickness, price) in enumerate(data, 1):
        # Format SKU to include dimensions: KS-ORTHOTHERAP-Q-72-60-6
        sz_char = "Q" if size == "Queen" else "K"
        sku = f"KS-{base_sku}-{sz_char}-{length}-{width}-{thickness}"
        new_variants.append({
            "id": str(uuid.uuid4()),
            "product_id": pid,
            "sku": sku,
            "size": size,
            "length": length,
            "width": width,
            "thickness": thickness,
            "firmness": None,
            "price": price * P,
            "mrp": None,
            "stock": 25,
            "reserved": 0,
            "is_active": True,
        })
    if new_variants:
        await db.variants.insert_many(new_variants)
    print(f"Inserted {len(new_variants)} variants for {slug}")


async def migrate_pillows():
    for slug, length, width, thickness, price in PILLOWS:
        product = await db.products.find_one({"slug": slug})
        if not product:
            print(f"Product {slug} not found, maybe standard-dualis-pillow?")
            if slug == "standard-dudlis-pillow":
                product = await db.products.find_one({"slug": "standard-dualis-pillow"})
            if not product:
                continue
        pid = product["id"]
        # Make sure specifications has dimensions for pillows
        specs = product.get("specifications", {})
        if length:
            specs["Length"] = f"{length} cm"
        if width:
            specs["Breadth"] = f"{width} cm"
        if thickness:
            specs["Height"] = f"{thickness} cm"
            
        await db.products.update_one({"id": pid}, {"$set": {"specifications": specs}})
        
        await db.variants.delete_many({"product_id": pid})
        sku_clean = slug.upper().replace("-", "")[:14]
        await db.variants.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": pid,
            "sku": f"KS-{sku_clean}-1",
            "size": "Standard",
            "length": length,
            "width": width,
            "thickness": thickness,
            "firmness": None,
            "price": price * P,
            "mrp": None,
            "stock": 25,
            "reserved": 0,
            "is_active": True,
        })
        print(f"Updated pillow: {slug} with dimensions {length}x{width}x{thickness} and price {price}")


async def main():
    print("Starting PDP Catalog Migration...")
    
    # 1. Update Pillow Names from Dudlis to Dualis and prices
    dudlis = await db.products.find_one({"slug": "standard-dudlis-pillow"})
    if dudlis:
        await db.products.update_one({"id": dudlis["id"]}, {"$set": {"name": "Standard Dualis Pillow"}})

    # Ortho Core Max name update to canonical
    orthocore = await db.products.find_one({"slug": "ortho-core-max-mattress"})
    if orthocore:
        await db.products.update_one({"id": orthocore["id"]}, {"$set": {"name": "Ortho Core Max"}})
        
    await migrate_mattress_variants("ortho-therapy-mattress", ORTHO_THERAPY, "ORTHOTHERA")
    await migrate_mattress_variants("spine-balance-mattress", SPINE_BALANCE, "SPINEBALAN")
    await migrate_mattress_variants("ortho-core-max-mattress", ORTHO_CORE_MAX, "ORTHOCOREM")
    await migrate_mattress_variants("topper", TOPPER, "TOPPER")
    
    await migrate_pillows()
    
    print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
