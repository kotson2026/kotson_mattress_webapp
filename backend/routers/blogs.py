"""KOTSON — Blog CMS router: Owner Admin management & Public Storefront publishing."""

from datetime import datetime
import os
from pathlib import Path
import re
import shutil
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from lib.db import db
from lib.security import CATALOG_MANAGERS, OWNER, ADMIN, audit, now_utc, require_role, user_from_request
from lib.services import clean_doc
from models.blog import BlogCreate, BlogImage, BlogOut, BlogUpdate

router = APIRouter()

# Persistent upload directory for blog media
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "blogs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def slugify(text: str) -> str:
    """Generate a clean, lowercase, hyphen-separated, URL-safe slug."""
    text = (text or "").strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def normalize_strings(items: Optional[List[str]]) -> List[str]:
    """Clean, trim whitespace, deduplicate case-insensitively, and preserve order."""
    if not items:
        return []
    seen = set()
    cleaned = []
    for item in items:
        if not item or not isinstance(item, str):
            continue
        trimmed = item.strip()
        if not trimmed:
            continue
        lower = trimmed.lower()
        if lower not in seen:
            seen.add(lower)
            cleaned.append(trimmed)
    return cleaned


def validate_publish_fields(doc: dict):
    """Enforce all production-required fields when publishing."""
    errors = []
    if not (doc.get("title") or "").strip():
        errors.append("Title is required for publishing")
    if not (doc.get("slug") or "").strip():
        errors.append("Slug is required for publishing")
    if not (doc.get("excerpt") or "").strip():
        errors.append("Excerpt is required for publishing")
    if not (doc.get("content_markdown") or "").strip():
        errors.append("Main content is required for publishing")
    if not (doc.get("conclusion_markdown") or "").strip():
        errors.append("Conclusion is required for publishing")
    if not (doc.get("cover_image") or "").strip():
        errors.append("Cover image is required for publishing")
    if not (doc.get("seo_title") or "").strip():
        errors.append("SEO title is required for publishing")
    if not (doc.get("seo_description") or "").strip():
        errors.append("SEO description is required for publishing")

    if errors:
        raise HTTPException(status_code=422, detail=", ".join(errors))


async def check_scheduled_blogs():
    """Promote scheduled blogs whose scheduled_at has arrived."""
    now = now_utc()
    await db.blogs.update_many(
        {"status": "scheduled", "scheduled_at": {"$lte": now}},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}}
    )


# =========================================================================
# PUBLIC STOREFRONT ENDPOINTS
# =========================================================================

@router.get("/blogs")
async def list_public_blogs(
    tag: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
):
    """Public blog listing: only published blogs, never drafts/scheduled/archived."""
    await check_scheduled_blogs()

    now = now_utc()
    query: dict = {
        "$or": [
            {"status": "published"},
            {"status": "scheduled", "scheduled_at": {"$lte": now}},
        ]
    }

    if tag and tag.strip():
        query["tags"] = {"$in": [re.compile(f"^{re.escape(tag.strip())}$", re.IGNORECASE)]}

    if q and q.strip():
        query["$and"] = query.get("$and", [])
        search_rgx = re.compile(re.escape(q.strip()), re.IGNORECASE)
        query["$and"].append({
            "$or": [
                {"title": search_rgx},
                {"excerpt": search_rgx},
                {"keywords": {"$in": [search_rgx]}},
                {"tags": {"$in": [search_rgx]}},
            ]
        })

    total = await db.blogs.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.blogs.find(query).sort("published_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "items": [clean_doc(d) for d in docs],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/blogs/{slug}")
async def get_public_blog(slug: str):
    """Public article detail: only accessible if published."""
    await check_scheduled_blogs()

    now = now_utc()
    doc = await db.blogs.find_one({
        "slug": slug.strip().lower(),
        "$or": [
            {"status": "published"},
            {"status": "scheduled", "scheduled_at": {"$lte": now}},
        ]
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Blog not found")

    res = clean_doc(doc)

    published_query = {
        "_id": {"$ne": doc.get("_id")},
        "$or": [
            {"status": "published"},
            {"status": "scheduled", "scheduled_at": {"$lte": now}},
        ],
    }

    pub_at = doc.get("published_at") or doc.get("created_at") or now
    prev_doc = await db.blogs.find_one(
        {**published_query, "published_at": {"$lt": pub_at}},
        sort=[("published_at", -1)]
    )
    next_doc = await db.blogs.find_one(
        {**published_query, "published_at": {"$gt": pub_at}},
        sort=[("published_at", 1)]
    )

    if prev_doc:
        res["prev_story"] = {"title": prev_doc.get("title", ""), "slug": prev_doc.get("slug", "")}
    if next_doc:
        res["next_story"] = {"title": next_doc.get("title", ""), "slug": next_doc.get("slug", "")}

    # Fetch real related stories:
    # 1. Matching tags
    # 2. Matching keywords
    # 3. Other recent published posts
    tags = doc.get("tags") or []
    keywords = doc.get("keywords") or []

    related_docs = []
    seen_slugs = {str(doc.get("slug", ""))}

    if tags:
        tag_matches = await db.blogs.find({
            **published_query,
            "tags": {"$in": tags},
        }).sort("published_at", -1).limit(4).to_list(4)
        for d in tag_matches:
            d_slug = str(d.get("slug", ""))
            if d_slug not in seen_slugs:
                seen_slugs.add(d_slug)
                related_docs.append(clean_doc(d))

    if len(related_docs) < 4 and keywords:
        kw_matches = await db.blogs.find({
            **published_query,
            "keywords": {"$in": keywords},
        }).sort("published_at", -1).limit(4).to_list(4)
        for d in kw_matches:
            d_slug = str(d.get("slug", ""))
            if d_slug not in seen_slugs:
                seen_slugs.add(d_slug)
                related_docs.append(clean_doc(d))

    if len(related_docs) < 4:
        recent_matches = await db.blogs.find(published_query).sort("published_at", -1).limit(4).to_list(4)
        for d in recent_matches:
            d_slug = str(d.get("slug", ""))
            if d_slug not in seen_slugs:
                seen_slugs.add(d_slug)
                related_docs.append(clean_doc(d))

    res["related_stories"] = related_docs[:3]
    return res


# =========================================================================
# OWNER ADMIN BLOG MANAGEMENT ENDPOINTS
# =========================================================================

@router.get("/admin/blogs/check-slug")
async def check_slug_availability(
    slug: str = Query(...),
    exclude_id: Optional[str] = Query(None),
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Check if a slug is available or suggest a numbered variant."""
    clean = slugify(slug)
    if not clean:
        return {"available": False, "suggested": "", "message": "Enter a valid slug"}

    q: dict = {"slug": clean}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}

    existing = await db.blogs.find_one(q)
    if not existing:
        return {"available": True, "suggested": clean}

    # Generate suggestion
    count = 1
    suggested = f"{clean}-{count}"
    while True:
        sq = {"slug": suggested}
        if exclude_id:
            sq["id"] = {"$ne": exclude_id}
        if not await db.blogs.find_one(sq):
            break
        count += 1
        suggested = f"{clean}-{count}"

    return {
        "available": False,
        "suggested": suggested,
        "message": f"Slug '{clean}' is already in use. Suggested: '{suggested}'"
    }


@router.get("/admin/blogs")
async def list_admin_blogs(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Admin blog list: with status filtering, search, pagination."""
    query: dict = {}
    if status and status.upper() != "ALL":
        query["status"] = status.lower()

    if q and q.strip():
        search_rgx = re.compile(re.escape(q.strip()), re.IGNORECASE)
        query["$or"] = [
            {"title": search_rgx},
            {"slug": search_rgx},
            {"excerpt": search_rgx},
            {"keywords": {"$in": [search_rgx]}},
            {"tags": {"$in": [search_rgx]}},
        ]

    total = await db.blogs.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.blogs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "items": [clean_doc(d) for d in docs],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/admin/blogs/{blog_id}")
async def get_admin_blog(
    blog_id: str,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Fetch blog details for editing."""
    doc = await db.blogs.find_one({"id": blog_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Blog not found")
    return clean_doc(doc)


@router.post("/admin/blogs", status_code=201)
async def create_blog(
    input: BlogCreate,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Create a new blog story. Author is derived securely from session."""
    title = (input.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")
    if len(title) > 300:
        raise HTTPException(status_code=422, detail="Title cannot exceed 300 characters")

    slug = slugify(input.slug) if input.slug else slugify(title)
    if not slug:
        raise HTTPException(status_code=422, detail="A valid title or slug is required")

    # Enforce uniqueness
    existing = await db.blogs.find_one({"slug": slug})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A blog with the slug '{slug}' already exists. Please choose a distinct title or edit the slug."
        )

    author_name = user.get("name") or user.get("email", "Kotson Editorial")
    now = now_utc()

    doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "slug": slug,
        "excerpt": (input.excerpt or "").strip(),
        "content_markdown": input.content_markdown or "",
        "conclusion_markdown": input.conclusion_markdown or "",
        "cover_image": (input.cover_image or "").strip(),
        "content_images": [img.model_dump() for img in input.content_images],
        "conclusion_images": [img.model_dump() for img in input.conclusion_images],
        "seo_title": (input.seo_title or "").strip(),
        "seo_description": (input.seo_description or "").strip(),
        "keywords": normalize_strings(input.keywords),
        "tags": normalize_strings(input.tags),
        "status": input.status.lower() if input.status in ("draft", "published", "scheduled", "archived") else "draft",
        "author_id": user["id"],
        "author_name": author_name,
        "created_at": now,
        "updated_at": now,
        "published_at": now if input.status == "published" else None,
        "scheduled_at": input.scheduled_at if input.status == "scheduled" else None,
        "archived_at": now if input.status == "archived" else None,
    }

    if doc["status"] == "published":
        validate_publish_fields(doc)

    await db.blogs.insert_one(doc)
    await audit(user, "blog.create", "blogs", doc["id"], f"Created blog '{title}' ({doc['status']})")

    return clean_doc(doc)


@router.put("/admin/blogs/{blog_id}")
async def update_blog(
    blog_id: str,
    input: BlogUpdate,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Update existing blog. Enforces slug uniqueness and publication validation."""
    existing = await db.blogs.find_one({"id": blog_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Blog not found")

    patch: dict = {}
    if input.title is not None:
        title = input.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        patch["title"] = title

    if input.slug is not None:
        new_slug = slugify(input.slug)
        if not new_slug:
            raise HTTPException(status_code=422, detail="Slug cannot be empty")
        if new_slug != existing.get("slug"):
            conflict = await db.blogs.find_one({"slug": new_slug, "id": {"$ne": blog_id}})
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=f"A blog with the slug '{new_slug}' already exists."
                )
            patch["slug"] = new_slug

    if input.excerpt is not None:
        patch["excerpt"] = input.excerpt.strip()

    if input.content_markdown is not None:
        patch["content_markdown"] = input.content_markdown

    if input.conclusion_markdown is not None:
        patch["conclusion_markdown"] = input.conclusion_markdown

    if input.cover_image is not None:
        patch["cover_image"] = input.cover_image.strip()

    if input.content_images is not None:
        patch["content_images"] = [img.model_dump() for img in input.content_images]

    if input.conclusion_images is not None:
        patch["conclusion_images"] = [img.model_dump() for img in input.conclusion_images]

    if input.seo_title is not None:
        patch["seo_title"] = input.seo_title.strip()

    if input.seo_description is not None:
        patch["seo_description"] = input.seo_description.strip()

    if input.keywords is not None:
        patch["keywords"] = normalize_strings(input.keywords)

    if input.tags is not None:
        patch["tags"] = normalize_strings(input.tags)

    if input.scheduled_at is not None:
        patch["scheduled_at"] = input.scheduled_at

    now = now_utc()
    if input.status is not None:
        st = input.status.lower()
        if st in ("draft", "published", "scheduled", "archived"):
            patch["status"] = st
            if st == "published":
                merged = {**existing, **patch}
                validate_publish_fields(merged)
                if not existing.get("published_at"):
                    patch["published_at"] = now
            elif st == "archived":
                patch["archived_at"] = now

    patch["updated_at"] = now

    await db.blogs.update_one({"id": blog_id}, {"$set": patch})
    await audit(user, "blog.update", "blogs", blog_id, f"Updated blog fields: {list(patch.keys())}")

    updated = await db.blogs.find_one({"id": blog_id})
    return clean_doc(updated)


@router.post("/admin/blogs/{blog_id}/publish")
async def publish_blog_now(
    blog_id: str,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Publish blog immediately with strict validation of required fields."""
    blog = await db.blogs.find_one({"id": blog_id})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    validate_publish_fields(blog)

    now = now_utc()
    patch = {
        "status": "published",
        "updated_at": now,
    }
    if not blog.get("published_at"):
        patch["published_at"] = now

    await db.blogs.update_one({"id": blog_id}, {"$set": patch})
    await audit(user, "blog.publish", "blogs", blog_id, f"Published blog '{blog.get('title')}'")

    updated = await db.blogs.find_one({"id": blog_id})
    return clean_doc(updated)


@router.post("/admin/blogs/{blog_id}/unpublish")
async def unpublish_blog(
    blog_id: str,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Revert blog back to draft."""
    blog = await db.blogs.find_one({"id": blog_id})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    now = now_utc()
    await db.blogs.update_one({"id": blog_id}, {"$set": {"status": "draft", "updated_at": now}})
    await audit(user, "blog.unpublish", "blogs", blog_id, f"Unpublished blog '{blog.get('title')}'")

    updated = await db.blogs.find_one({"id": blog_id})
    return clean_doc(updated)


@router.post("/admin/blogs/{blog_id}/archive")
async def archive_blog(
    blog_id: str,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Archive a blog post (non-destructive retirement)."""
    blog = await db.blogs.find_one({"id": blog_id})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    now = now_utc()
    await db.blogs.update_one(
        {"id": blog_id},
        {"$set": {"status": "archived", "archived_at": now, "updated_at": now}}
    )
    await audit(user, "blog.archive", "blogs", blog_id, f"Archived blog '{blog.get('title')}'")

    updated = await db.blogs.find_one({"id": blog_id})
    return clean_doc(updated)


@router.delete("/admin/blogs/{blog_id}")
async def delete_blog(
    blog_id: str,
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Permanent deletion with audit log."""
    blog = await db.blogs.find_one({"id": blog_id})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    await db.blogs.delete_one({"id": blog_id})
    await audit(user, "blog.delete", "blogs", blog_id, f"Permanently deleted blog '{blog.get('title')}'")

    return {"status": "success", "message": f"Blog '{blog.get('title')}' permanently deleted"}


# =========================================================================
# PERSISTENT IMAGE UPLOAD ENDPOINT
# =========================================================================

@router.post("/admin/blogs/upload-image")
async def upload_blog_image(
    file: UploadFile = File(...),
    user=Depends(require_role(*CATALOG_MANAGERS)),
):
    """Upload and validate blog image. Saves persistently and logs into asset library."""
    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Allowed types: JPG, PNG, WEBP, GIF, AVIF."
        )

    # Sanitize original filename and check extension
    orig_name = file.filename or "image.webp"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]:
        ext = ".webp"

    asset_id = str(uuid.uuid4())
    stored_filename = f"{asset_id}{ext}"
    dest_path = UPLOAD_DIR / stored_filename

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 10 MB limit."
        )

    # Write persistently
    with open(dest_path, "wb") as f:
        f.write(contents)

    # Relative URL that is routed through FastAPI
    relative_url = f"/api/uploads/blogs/{stored_filename}"

    # Also record in asset_library for enterprise reuse
    size_kb = round(len(contents) / 1024, 1)
    await db.asset_library.insert_one({
        "id": asset_id,
        "title": orig_name,
        "url": relative_url,
        "category": "Blogs",
        "file_size_kb": size_kb,
        "file_type": file.content_type,
        "alt_text": orig_name,
        "tags": ["blog"],
        "used_in_count": 1,
        "is_test_data": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    })

    await audit(user, "blog.upload_image", "assets", asset_id, f"Uploaded blog image {orig_name} ({size_kb} KB)")

    return {
        "id": asset_id,
        "url": relative_url,
        "filename": orig_name,
        "size_kb": size_kb,
    }
