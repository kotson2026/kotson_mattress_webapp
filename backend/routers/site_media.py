"""Hero video + scrolling announcement bar. Both owner-editable from Website Studio.

Security: raw iframe HTML is never accepted. The owner supplies a YouTube URL and the
server extracts the 11-character video id, so only a known-good embed URL is ever rendered.
"""

import re
import urllib.request
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


def extract_youtube_id(url: str) -> Optional[str]:
    """Return the 11-char video id or None."""
    raw = (url or "").strip()
    if not raw:
        return None
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", raw):
        return raw
    for pat in _PATTERNS:
        m = re.search(pat, raw)
        if m:
            return m.group(1)
    return None


def validate_hero_video(url: str) -> tuple[str, str]:
    """Validate video URL. Returns (video_type, video_id).

    Supports:
      1. Direct MP4 video URLs (validated against remote host with range playback check)
      2. YouTube URLs
    """
    raw = (url or "").strip()
    if not raw:
        raise HTTPException(422, "Enter a valid video URL")
    if "<" in raw or ">" in raw:
        raise HTTPException(422, "Paste the URL only — embed or iframe HTML is not accepted")

    # Check for direct MP4 / video streaming URL
    if ".mp4" in raw.lower() or "videotourl" in raw.lower():
        # Validate that the remote host allows playback and returns valid video for preview & website domains
        for origin in ["http://localhost:3000", "https://kotsonmattress.com"]:
            req = urllib.request.Request(
                raw,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Range": "bytes=0-1024",
                    "Origin": origin,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status not in (200, 206):
                        raise HTTPException(422, f"Video host returned unexpected status {resp.status} for origin {origin}")
                    ctype = resp.headers.get("Content-Type", "")
                    if ctype and "video" not in ctype and "octet-stream" not in ctype and "application" not in ctype:
                        raise HTTPException(422, f"URL does not return a playable video stream (Content-Type: {ctype})")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(422, f"Could not validate MP4 video playback from host ({origin}): {exc}")

        vid = raw.split("/")[-1].split("?")[0].replace(".mp4", "")
        return "mp4", vid or "direct-mp4"

    # Check for YouTube URL
    yt_id = extract_youtube_id(raw)
    if yt_id:
        return "youtube", yt_id

    raise HTTPException(422, "Enter a direct MP4 video URL (e.g. https://videotourl.com/videos/...mp4) or a YouTube URL")


class HeroVideoIn(BaseModel):
    video_url: str = Field(min_length=3, max_length=1000)
    poster_url: Optional[str] = Field(default=None, max_length=1000)
    poster_alt: Optional[str] = Field(default=None, max_length=300)
    enabled: bool = True


class HeroVideoOut(BaseModel):
    video_id: str
    video_url: str
    video_type: str = "mp4"
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
    vurl = doc.get("video_url")
    vid = doc.get("video_id")
    if not vurl and not vid:
        return None
    vtype = doc.get("video_type") or ("mp4" if (vurl and (".mp4" in vurl.lower() or "videotourl" in vurl.lower())) else "youtube")
    poster = doc.get("poster_url") or None
    fallback_poster = (
        doc.get("poster_fallback_url")
        or (f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg" if (vtype == "youtube" and vid) else None)
    )
    return HeroVideoOut(
        video_id=vid or "hero-video",
        video_url=vurl or "",
        video_type=vtype,
        embed_url=vurl if vtype == "mp4" else (_embed_url(vid) if vid else ""),
        poster_url=poster,
        poster_fallback_url=fallback_poster,
        poster_alt=doc.get("poster_alt") or "Kotson organic latex mattress video",
        poster_pending=not poster and not fallback_poster,
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
    vtype, vid = validate_hero_video(input.video_url)
    poster = _validate_href(input.poster_url)
    doc = {
        "id": HERO_SETTINGS_ID,
        "video_id": vid,
        "video_type": vtype,
        "video_url": input.video_url.strip(),
        "poster_url": poster,
        "poster_alt": (input.poster_alt or "").strip() or None,
        "enabled": input.enabled,
        "updated_at": now_utc(),
    }
    await db.settings.update_one({"id": HERO_SETTINGS_ID}, {"$set": doc}, upsert=True)
    await audit(user, "hero_video.update", "settings", HERO_SETTINGS_ID, f"type={vtype} video_id={vid}")
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
