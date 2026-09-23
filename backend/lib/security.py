"""Auth + permission core: password hashing, sessions, role policy. Server-side only."""

import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SESSION_COOKIE = "ks_session"
CART_COOKIE = "ks_cart"
SESSION_TTL_DAYS = 30

# Staging-grade in-memory login rate limiter (documented limitation; not a secret store).
_login_attempts: dict[str, list[float]] = {}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False


def login_rate_limited(key: str, limit: int = 1000, window_s: int = 300) -> bool:
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("ENV") != "production":
        return False
    now = time.time()
    hits = [t for t in _login_attempts.get(key, []) if now - t < window_s]
    _login_attempts[key] = hits
    if len(hits) >= limit:
        return True
    hits.append(now)
    return False



def normalize_email(email: str) -> str:
    return email.strip().lower()


def mint_referral_code() -> str:
    return "KS" + secrets.token_hex(3).upper()  # e.g. KS7FA2C1


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user_id,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=SESSION_TTL_DAYS),
        }
    )
    return token


async def destroy_session(token: str) -> None:
    await db.sessions.delete_one({"token": token})


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("APP_URL", "").startswith("https://"),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


async def user_from_request(request: Request):
    """Returns the user doc (or None). Sessions are httpOnly cookies — never tokens in JSON."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    session = await db.sessions.find_one({"token": token})
    if not session:
        return None
    expires = session.get("expires_at")
    if expires is not None and expires.replace(tzinfo=timezone.utc) < now_utc():
        await db.sessions.delete_one({"token": token})
        return None
    user = await db.users.find_one({"id": session["user_id"]})
    if not user or not user.get("is_active", True):
        return None
    return user


async def optional_user(user=Depends(user_from_request)):
    return user


def require_user(user=Depends(user_from_request)):
    if not user:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


def has_role(user: dict, *roles: str) -> bool:
    user_roles = set(user.get("roles") or [])
    target_roles = set(roles)
    if any(r in target_roles for r in (OWNER, "owner_admin", ADMIN)):
        target_roles.update([OWNER, ADMIN, "owner_admin"])
    if any(r in target_roles for r in (CRM_MASTER, "crm_master_admin")):
        target_roles.update([CRM_MASTER, "crm_master_admin"])
    return bool(user_roles.intersection(target_roles))


def require_role(*roles: str):
    """Central server-side permission gate. Row-level scope is enforced per-route on top of this."""

    async def guard(user=Depends(require_user)):
        if not has_role(user, *roles):
            raise HTTPException(status_code=403, detail="Not permitted for your role")
        return user

    return guard


# Role groups used across routers
OWNER = "owner"
OWNER_ADMIN = "owner"
ADMIN = "admin"
MANAGER = "manager"
CRM_MASTER = "crm_master"
CRM_MASTER_ADMIN = "crm_master"
CRM_MANAGER = "crm_manager"
CRM_EMPLOYEE = "crm_employee"
DEALER = "dealer"
AFFILIATE = "affiliate"
CUSTOMER = "customer"

STAFF_ROLES = [OWNER, ADMIN, MANAGER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE]
CATALOG_MANAGERS = [OWNER, ADMIN]  # pricing/CMS/product CRUD
FULFILMENT = [OWNER, ADMIN, MANAGER]
CRM_SCOPED = [OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE]


def can(user: dict, feature: str) -> bool:
    """Declarative capability helper for staff and customer features."""
    if not user:
        return False
    if has_role(user, OWNER, ADMIN):
        return True  # Full access to everything
    if feature in ("view_sales", "view_crm", "export_crm"):
        return has_role(user, CRM_MASTER)
    if feature in ("manage_leads", "call_leads"):
        return has_role(user, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)
    if feature in ("manage_orders", "fulfilment"):
        return has_role(user, MANAGER)
    if feature == "dealer_portal":
        return has_role(user, DEALER)
    return False



async def audit(actor: dict, action: str, entity: str, entity_id: str, detail: str = "") -> None:
    """Privileged-action audit trail — call on every staff/financial mutation."""
    await db.audit_log.insert_one(
        {
            "id": str(__import__("uuid").uuid4()),
            "actor_id": actor.get("id") if actor else "system",
            "actor_email": actor.get("email", "system"),
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "detail": detail,
            "created_at": now_utc(),
        }
    )
