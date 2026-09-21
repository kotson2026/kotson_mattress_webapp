"""Seeds the video hero config and the scrolling announcement bar messages.

The three messages the owner asked for verbatim: Free Shipping, Chemical-Free, 100% Organic.
Each is linked to its claim where one exists, so Website Studio can warn when the underlying
claim is still a draft. Idempotent: safe to re-run.
"""

import asyncio
import uuid

from lib.db import db
from lib.security import now_utc
from routers.site_media import HERO_SETTINGS_ID, extract_youtube_id

VIDEO_URL = "https://www.youtube.com/embed/xoRN3hDvsD8"

ITEMS = [
    ("Free Shipping", "/policies/policy_shipping", "free_shipping"),
    ("Chemical-Free", None, None),
    ("100% Organic", "/collections/mattresses", "gols_organic"),
]


async def main() -> None:
    print("Seeding hero video + announcement bar…")

    vid = extract_youtube_id(VIDEO_URL)
    await db.settings.update_one(
        {"id": HERO_SETTINGS_ID},
        {
            "$set": {
                "id": HERO_SETTINGS_ID,
                "video_id": vid,
                "video_url": VIDEO_URL,
                "enabled": True,
                "updated_at": now_utc(),
            },
            # poster stays unset until the owner uploads one — never invented
            "$setOnInsert": {"poster_url": None, "poster_alt": None},
        },
        upsert=True,
    )
    print(f"  hero video id: {vid} (poster: owner-supplied, currently pending)")

    for i, (label, href, claim_key) in enumerate(ITEMS):
        if await db.announcements.find_one({"label": label}):
            continue
        await db.announcements.insert_one(
            {
                "id": str(uuid.uuid4()),
                "label": label,
                "href": href,
                "claim_key": claim_key,
                "enabled": True,  # owner asked for these three explicitly
                "sort": i,
                "created_at": now_utc(),
            }
        )

    rows = await db.announcements.find({}).sort("sort", 1).to_list(40)
    print(f"  announcements: {len(rows)}")
    for r in rows:
        claim = await db.claims.find_one({"key": r["claim_key"]}) if r.get("claim_key") else None
        note = ""
        if claim and claim.get("status") != "published":
            note = f"  [claim '{r['claim_key']}' is {claim.get('status')} — Website Studio shows a warning]"
        print(f"    {r['sort']}. {r['label']} enabled={r['enabled']}{note}")


if __name__ == "__main__":
    asyncio.run(main())
