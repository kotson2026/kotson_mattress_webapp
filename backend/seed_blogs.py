"""Seed initial authentic Kotson blog articles."""

from datetime import datetime, timezone
import uuid
from lib.db import db


"""Seed initial authentic Kotson blog articles."""

from datetime import datetime, timezone, timedelta
import uuid
from lib.db import db


async def main():
    now = datetime.now(timezone.utc)

    # Find owner user if exists
    owner = await db.users.find_one({"roles": "owner"})
    author_id = owner["id"] if owner else "owner-editorial"
    author_name = (owner.get("name") if owner else None) or "Kotson Sleep Research"

    articles = [
        {
            "id": str(uuid.uuid4()),
            "title": "Why Choosing a Good Mattress Matters for Quality Sleep",
            "slug": "why-choosing-a-good-mattress-matters-for-quality-sleep",
            "excerpt": "A good mattress is not merely a piece of furniture—it is a vital foundation for spinal alignment, deep REM recovery, and pain-free mornings. Discover the science behind restorative rest.",
            "content_markdown": """A good night's sleep is the cornerstone of overall physical and mental health. While lifestyle habits like limiting evening screen time and maintaining a consistent bedtime matter, one of the most critical factors influencing your rest is the surface you lie on for seven to eight hours every single night. 

A high-quality mattress is not a luxury purchase; it is a vital healthcare tool that directly dictates spinal ergonomics, circulation, and muscular restoration.

### 1. Supports Spinal Alignment

The primary function of a mattress is to keep your spine in a neutral, relaxed position throughout every sleep posture. When sleeping on an unsupportive or sagging mattress, heavier pivot points—such as your hips and lumbar region—sink excessively, causing your vertebrae to bend unnatural angles. Certified natural latex and zoned ergonomic construction adapt in real time to the contours of your body, keeping your cervical, thoracic, and lumbar spine in natural anatomical alignment.

### 2. Prevents Pain and Aches

Waking up with a stiff neck, sore lower back, or tender shoulders is often a direct symptom of poor sleep ergonomics. When a mattress fails to distribute body weight evenly, pressure points build up at the shoulders, hips, and knees. An orthopedically calibrated mattress eliminates these pressure spikes, allowing muscles and ligaments to fully relax rather than straining all night to compensate for inadequate support.

### 3. Reduces Stress and Enhances Comfort

Physical discomfort during sleep triggers micro-arousals—brief subconscious awakenings that fragment your rest and prevent you from entering the deep delta stages of non-REM sleep. By cushioning pressure points and providing quiet, motion-isolated resilience, a premium natural mattress creates an inviting sleep sanctuary that lowers cortisol levels and promotes psychological calm.

### 4. Improves Sleep Hygiene

Modern sleep hygiene extends beyond bedtime rituals to the physical environment you sleep in. Synthetic foam mattresses often trap body heat and accumulate dust mites, allergens, and VOC off-gassing. In contrast, organic latex and breathable natural textiles feature open-cell pin-core matrixes that continuously circulate fresh air, wicking away moisture and maintaining an optimal microclimate that keeps you comfortably cool throughout the night.

### 5. Boosts Productivity and Mood

Restorative sleep is when the brain consolidates memories, clears out metabolic waste, and rebalances essential neurotransmitters like serotonin and dopamine. By eliminating tossing, turning, and nocturnal aches, a truly supportive mattress ensures uninterrupted sleep cycles—leaving you energized, focused, and emotionally resilient each morning.""",
            "conclusion_markdown": """Investing in a mattress that properly supports your anatomy is an investment in your daily energy, cognitive clarity, and lifelong orthopedic wellness. When your bed actively supports your body, quality sleep transforms from an elusive goal into a natural nightly reality.""",
            "cover_image": "https://cdn.phototourl.com/member/2026-09-23-58e2ca4e-ebff-4af3-be34-e3e84717dbb8.jpg",
            "content_images": [
                {
                    "id": str(uuid.uuid4()),
                    "url": "https://cdn.phototourl.com/member/2026-09-26-9561608c-ea2e-49e7-965b-b3b52c72b043.png",
                    "alt_text": "Ergonomic Spinal Support and Pressure Relief Zones",
                    "created_at": now,
                }
            ],
            "conclusion_images": [],
            "seo_title": "Why Choosing a Good Mattress Matters for Quality Sleep | Kotson Naturals",
            "seo_description": "Learn why choosing the right mattress is essential for spinal alignment, alleviating morning pain, improving sleep hygiene, and boosting daytime energy.",
            "keywords": ["good mattress", "quality sleep", "spinal alignment", "mattress ergonomics", "kotson naturals"],
            "tags": ["Sleep Science", "Spine Health", "Mattress Guide"],
            "status": "published",
            "author_id": author_id,
            "author_name": author_name,
            "created_at": now,
            "updated_at": now,
            "published_at": now,
            "scheduled_at": None,
            "archived_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "How Natural Latex Supports Better Sleep",
            "slug": "how-natural-latex-supports-better-sleep",
            "excerpt": "Discover why 100% natural Dunlop and Talalay latex provide unmatched spinal alignment, pinpoint pressure relief, and breathable botanical temperature regulation.",
            "content_markdown": """## The Botanical Architecture of Deep Rest

Sleep is not merely passive downtime; it is an active biological restorative process. When your spine is held in neutral ergonomic alignment and body heat dissipates naturally, sleep cycles progress uninterrupted from light REM to restorative delta slow-wave sleep.

Traditional synthetic mattresses rely heavily on petroleum-derived polyurethane and memory foams. While these materials compress under weight, they often trap body heat and create a "sinking" sensation that restricts natural nocturnal movement. 

### Why Pure Latex Differs Fundamentally

1. **Instantaneous Push-Back Resilience**: Unlike slow-rebounding synthetic foam, certified natural latex responds dynamically to your posture within milliseconds. As you change positions throughout the night, the material immediately adapts to support your lumbar curvature.
2. **Open-Cell Breathability**: Harvested from the sap of *Hevea Brasiliensis* rubber trees, vulcanized natural latex boasts an open-cell matrix. Hundreds of pin-core ventilation channels continuously circulate ambient air, preventing thermal buildup.
3. **Zoned Pressure Distribution**: By varying firmness across targeted anatomic regions—head, shoulders, lumbar, pelvic, thighs, calves, and feet—natural latex alleviates peak pressure on critical joints.

> "A mattress should contour to your natural spinal curvature rather than forcing your skeleton to conform to a rigid plane."

### The Orthopedic Significance of Neutral Alignment

When you lie on your side, your spine should form a straight, horizontal line parallel to the bed surface. On your back, it should preserve the natural gentle 'S' curve of your cervical, thoracic, and lumbar vertebrae. Natural latex accommodates heavier pivot points like hips and shoulders while elevating the lower back to relieve disc compression.""",
            "conclusion_markdown": """Investing in a natural latex sleep sanctuary is an investment in restorative physical recovery, mental clarity, and lifetime durability. By harmonizing pure botanical materials with ergonomic engineering, Kotson Naturals provides a supportive foundation that elevates every waking hour.""",
            "cover_image": "https://cdn.phototourl.com/member/2026-09-26-af7dc6e9-091c-496e-ad79-c5638c2915e1.png",
            "content_images": [
                {
                    "id": str(uuid.uuid4()),
                    "url": "https://cdn.phototourl.com/member/2026-09-26-9561608c-ea2e-49e7-965b-b3b52c72b043.png",
                    "alt_text": "Kotson Natural Latex Mattress Layer Breakdown",
                    "created_at": now - timedelta(days=2),
                }
            ],
            "conclusion_images": [],
            "seo_title": "How Natural Latex Supports Better Sleep | Kotson Naturals",
            "seo_description": "Discover how 100% natural latex mattresses provide ergonomic spine alignment, cooling airflow, and restorative sleep backed by orthopedic research.",
            "keywords": ["natural latex", "sleep health", "organic mattress", "spinal alignment", "kotson naturals"],
            "tags": ["Natural Sleep", "Mattress Guide", "Sleep Science"],
            "status": "published",
            "author_id": author_id,
            "author_name": author_name,
            "created_at": now - timedelta(days=2),
            "updated_at": now - timedelta(days=2),
            "published_at": now - timedelta(days=2),
            "scheduled_at": None,
            "archived_at": None,
        },
    ]

    for article in articles:
        existing = await db.blogs.find_one({"slug": article["slug"]})
        if not existing:
            await db.blogs.insert_one(article)
            print(f"Seed: Blog '{article['title']}' inserted.")
        else:
            print(f"Seed: Blog '{article['title']}' already exists.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

