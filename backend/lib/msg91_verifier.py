"""Server-side MSG91 OTP Verification Service.

Authoritatively validates MSG91 Custom Web SDK verification access tokens
against MSG91 control APIs before creating a customer account.
"""

import logging
import os
import re
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

MSG91_VERIFY_ACCESS_TOKEN_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken"


def get_msg91_auth_key() -> str:
    """Retrieve MSG91 private Auth Key strictly from server environment."""
    return os.environ.get("MSG91_AUTH_KEY", "").strip()


def extract_10_digits(phone: str) -> str:
    """Extract standard 10-digit Indian phone number."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    return digits[-10:] if len(digits) >= 10 else digits


def mask_phone_for_logs(phone: str) -> str:
    """Mask phone for safe logging (e.g. +91******3210)."""
    digits = extract_10_digits(phone)
    if len(digits) == 10:
        return f"+91******{digits[-4:]}"
    return "+91******"


async def verify_msg91_evidence(
    token: Optional[str],
    phone: str,
    req_id: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Authoritatively verify MSG91 access token server-side.
    Fails closed if token is missing, substituted with req_id, or invalid.

    Returns: (is_verified: bool, message: str)
    """
    clean_token = (token or "").strip()
    clean_req_id = (req_id or "").strip()

    # 1. Missing Token Check
    if not clean_token:
        return False, "Phone verification access token is required. Please verify your phone number via OTP."

    # 2. Request ID Substitution Attack Protection
    # A reqId is a transmission identifier, NOT an authoritative verification access token.
    if clean_req_id and clean_token == clean_req_id:
        logger.warning(
            "Request ID substitution attack detected: submitted token matches requestId (%s)",
            clean_req_id
        )
        return False, "Invalid verification token. Request ID cannot be used as verification evidence."

    # 3. Format and validate phone
    phone_10 = extract_10_digits(phone)
    if not phone_10 or len(phone_10) != 10:
        return False, "Invalid phone number format."

    # Safe test automation for development mode with dedicated test token prefix
    if os.environ.get("DATABASE_PROVIDER") != "supabase" and clean_token.startswith("test_mock_token_"):
        return True, "Phone verified (Automated Test Mode)"

    auth_key = get_msg91_auth_key()

    # 4. Fail closed if MSG91_AUTH_KEY is not configured (allow local dev simulation only when DATABASE_PROVIDER != 'supabase')
    if not auth_key:
        if os.environ.get("DATABASE_PROVIDER") != "supabase":
            logger.info(
                "[DEV AUDIT] Local dev verification accepted for phone %s (token present; MSG91_AUTH_KEY not set)",
                phone_10
            )
            return True, "Verified (Local Dev Mode)"
        logger.error(
            "MSG91 verification rejected: MSG91_AUTH_KEY is not configured in backend environment."
        )
        return False, "Server-side phone verification is unconfigured. Please contact support."

    # 5. Live Authoritative Verification against MSG91 API
    masked_phone = mask_phone_for_logs(phone)
    logger.info("Initiating MSG91 server verification for destination %s", masked_phone)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {
                "authkey": auth_key,
                "Content-Type": "application/json",
            }
            # Per MSG91 API v5 documentation: Request body expects 'access-token'
            payload = {
                "access-token": clean_token,
                "token": clean_token,
            }
            resp = await client.post(MSG91_VERIFY_ACCESS_TOKEN_URL, json=payload, headers=headers)

            if resp.status_code == 200:
                data = resp.json()

                # Per MSG91 documentation: Some routes return HTTP 200 with type="error" or code="201"
                resp_type = (data.get("type") or "").lower()
                resp_code = str(data.get("code") or "")

                if resp_type == "error" or resp_code in ("201", "400", "401", "403"):
                    err_msg = data.get("message") or "Invalid or expired verification access token."
                    logger.warning("MSG91 verification rejected: %s", err_msg)
                    return False, f"MSG91 verification failed: {err_msg}"

                if resp_type == "success" or data.get("status") == "success" or "data" in data or data.get("message") == "verified":
                    # Check phone binding if exposed by MSG91 response
                    verified_mobile = (
                        data.get("mobile")
                        or data.get("phone")
                        or (isinstance(data.get("data"), dict) and data["data"].get("mobile"))
                    )

                    if verified_mobile:
                        ret_phone_10 = extract_10_digits(str(verified_mobile))
                        if ret_phone_10 and ret_phone_10 != phone_10:
                            logger.warning(
                                "MSG91 verification phone mismatch: token bound to %s, registration submitted %s",
                                mask_phone_for_logs(ret_phone_10),
                                masked_phone
                            )
                            return False, "Verification token does not match the submitted phone number."

                    logger.info("MSG91 server verification succeeded for destination %s", masked_phone)
                    return True, "Phone verified authoritatively with MSG91."
                else:
                    logger.warning("MSG91 returned ambiguous response payload: %s", data)
                    return False, "Invalid or unrecognized verification token response from MSG91."
            elif resp.status_code in (401, 403):
                logger.error("MSG91 verifyAccessToken rejected with HTTP %s: Invalid Auth Key or IP not allowlisted.", resp.status_code)
                return False, "Phone verification service authentication error."
            else:
                logger.warning("MSG91 verifyAccessToken returned HTTP %s", resp.status_code)
                return False, "Could not verify OTP token with MSG91 service. Please try again."

    except httpx.TimeoutException:
        logger.error("Timeout connecting to MSG91 verify service for %s", masked_phone)
        return False, "Phone verification service timed out. Please try again."
    except Exception as exc:
        logger.error("Error communicating with MSG91 verify service: %s", type(exc).__name__)
        return False, "Phone verification service temporarily unreachable. Please try again."
