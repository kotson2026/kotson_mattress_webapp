"""Hero video + scrolling announcement bar. Both owner-editable from Website Studio.

Security: raw iframe HTML is never accepted. The owner supplies a YouTube URL and the
server extracts the 11-character video id, so only a known-good embed URL is ever rendered.
"""

import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import CATALOG_MANAGERS, audit, now_utc, require_role
from lib.services import clean_doc

router = APIRouter()

# youtu.be/<id>, /embed/<id>, /shorts/<id>, /live/<id>, watch?v=<id>
_PATTERNS = [
    r"(?:youtube\.com|youtube-nocookie\.com)/embed/([A-Za-z0-9_-]{11})",
    r"(?:youtube\.com|youtube-nocookie\.com)/shorts/([A-Za-z0-9_-]{11})",
    r"(?:youtube\.com|youtube-nocookie\.com)/live/([A-Za-z0-9_-]{11})",
    r"youtu\.be/([A-Za-z0-9_-]{11})",
    r"[?&]v=([A-Za-z0-9_-]{11})",
]

HERO_SETTINGS_ID = "hero_video"


def extract_youtube_id(url: str) -> str:
    """Return the 11-char video id or raise 422. Rejects iframe HTML and unknown hosts."""
    raw = (url or "").strip()
    if not raw:
        raise HTTPException(422, "Enter a YouTube URL")
    if "<" in raw or ">" in raw:
        raise HTTPException(422, "Paste the YouTube URL only — embed/iframe HTML is not accepted")
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", raw):
        return raw
    for pat in _PATTERNS:
        m = re.search(pat, raw)
        if m:
            return m.group(1)
    raise HTTPException(422, "That is not a recognised YouTube URL")


class HeroVideoIn(BaseModel):
    video_url: str = Field(min_length=3, max_length=500)
    poster_url: Optional[str] = Field(default=None, max_length=1000)
    poster_alt: Optional[str] = Field(default=None, max_length=300)
    enabled: bool = True


class HeroVideoOut(BaseModel):
    video_id: str
    video_url: str
    embed_url: str
    poster_url: Optional[str] = None
    poster_fallback_url: Optional[str] = None
    poster_alt: Optional[str] = None
    poster_pending: bool = True
    enabled: bool = True


class AnnouncementIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    href: Optional[str] = Field(default=None, max_length=300)
    enabled: bool = False
    claim_key: Optional[str] = Field(default=None, max_length=60)
    sort: int = 0


class AnnouncementOut(AnnouncementIn):
    id: str
    claim_status: Optional[str] = None


def _embed_url(vid: str) -> str:
    """Muted + inline + single-video loop. Autoplay is attempted, never guaranteed."""
    return (
        f"https://www.youtube.com/embed/{vid}"
        f"?autoplay=1&mute=1&loop=1&playlist={vid}&playsinline=1"
        "&controls=1&rel=0&modestbranding=1"
    )


def _validate_href(href: Optional[str]) -> Optional[str]:
    if not href:
        return None
    h = href.strip()
    if not h:
        return None
    if h.startswith("/"):
        return h
    if h.startswith("http://") or h.startswith("https://"):
        return h
    raise HTTPException(422, "Link must be an internal path (/collections) or an http(s) URL")


async def _hero_doc() -> dict:
    doc = await db.settings.find_one({"id": HERO_SETTINGS_ID})
    return doc or {}


def _hero_out(doc: dict) -> Optional[HeroVideoOut]:
    vid = doc.get("video_id")
    if not vid:
        return None
    poster = doc.get("poster_url") or None
    return HeroVideoOut(
        video_id=vid,
        video_url=doc.get("video_url", ""),
        embed_url=_embed_url(vid),
        poster_url=poster,
        # The video's OWN official thumbnail — used only until the owner uploads a poster.
        # Not invented artwork: it is published by YouTube for this exact video.
        poster_fallback_url=f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg",
        poster_alt=doc.get("poster_alt") or None,
        poster_pending=not poster,
        enabled=bool(doc.get("enabled", True)),
    )


# ---------------------------------------------------------------- public


@router.get("/content/hero-video")
async def public_hero_video():
    out = _hero_out(await _hero_doc())
    if not out or not out.enabled:
        return {"configured": False}
    return {"configured": True, **out.model_dump()}


@router.get("/content/announcements", response_model=List[AnnouncementOut])
async def public_announcements():
    """Only owner-enabled messages are published. Enabling is the owner's approval action."""
    docs = await db.announcements.find({"enabled": True}).sort("sort", 1).to_list(40)
    return [AnnouncementOut(**clean_doc(d)) for d in docs]


# ---------------------------------------------------------------- admin


@router.get("/admin/hero-video")
async def admin_hero_video(user=Depends(require_role(*CATALOG_MANAGERS))):
    out = _hero_out(await _hero_doc())
    return {"configured": bool(out), **(out.model_dump() if out else {})}


@router.put("/admin/hero-video")
async def set_hero_video(input: HeroVideoIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    vid = extract_youtube_id(input.video_url)
    poster = _validate_href(input.poster_url)
    doc = {
        "id": HERO_SETTINGS_ID,
        "video_id": vid,
        "video_url": input.video_url.strip(),
        "poster_url": poster,
        "poster_alt": (input.poster_alt or "").strip() or None,
        "enabled": input.enabled,
        "updated_at": now_utc(),
    }
    await db.settings.update_one({"id": HERO_SETTINGS_ID}, {"$set": doc}, upsert=True)
    await audit(user, "hero_video.update", "settings", HERO_SETTINGS_ID, f"video_id={vid}")
    out = _hero_out(doc)
    return {"configured": True, **(out.model_dump() if out else {})}


@router.get("/admin/announcements", response_model=List[AnnouncementOut])
async def admin_announcements(user=Depends(require_role(*CATALOG_MANAGERS))):
    docs = await db.announcements.find({}).sort("sort", 1).to_list(60)
    rows: List[AnnouncementOut] = []
    for d in docs:
        row = AnnouncementOut(**clean_doc(d))
        if row.claim_key:
            claim = await db.claims.find_one({"key": row.claim_key})
            row.claim_status = claim.get("status") if claim else "missing"
        rows.append(row)
    return rows


@router.post("/admin/announcements", response_model=AnnouncementOut)
async def create_announcement(input: AnnouncementIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    href = _validate_href(input.href)
    last = await db.announcements.find({}).sort("sort", -1).limit(1).to_list(1)
    doc = input.model_dump() | {
        "id": str(uuid.uuid4()),
        "href": href,
        "sort": input.sort or ((last[0]["sort"] + 1) if last else 0),
        "created_at": now_utc(),
    }
    await db.announcements.insert_one(doc)
    await audit(user, "announcement.create", "announcement", doc["id"], input.label)
    return AnnouncementOut(**clean_doc(doc))


@router.patch("/admin/announcements/{aid}", response_model=AnnouncementOut)
async def update_announcement(aid: str, patch: dict, user=Depends(require_role(*CATALOG_MANAGERS))):
    allowed = {k: v for k, v in patch.items() if k in {"label", "href", "enabled", "claim_key", "sort"}}
    if "href" in allowed:
        allowed["href"] = _validate_href(allowed["href"])
    if not allowed:
        raise HTTPException(422, "Nothing to update")
    doc = await db.announcements.find_one_and_update(
        {"id": aid}, {"$set": allowed}, return_document=True
    )
    if not doc:
        raise HTTPException(404, "Announcement not found")
    await audit(user, "announcement.update", "announcement", aid, str(allowed))
    return AnnouncementOut(**clean_doc(doc))


@router.delete("/admin/announcements/{aid}")
async def delete_announcement(aid: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.announcements.find_one({"id": aid})
    if not doc:
        raise HTTPException(404, "Announcement not found")
    await db.announcements.delete_one({"id": aid})
    await audit(user, "announcement.delete", "announcement", aid, doc.get("label", ""))
    return {"ok": True, "deleted": aid}
