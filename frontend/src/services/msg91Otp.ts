/**
 * MSG91 Custom Web SDK OTP Service for Kotson Customer Registration.
 * Handles SDK script injection, initialization with exposeMethods: true,
 * and promise-wrapped sendOtp, retryOtp, and verifyOtp calls.
 */

import type { Msg91Configuration, Msg91ErrorResponse, Msg91SuccessResponse, Msg91VerifyResponse } from "../types/msg91";

const MSG91_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";
const SCRIPT_ID = "msg91-otp-provider-script";

// Configurable Widget parameters - strictly from environment variables without unsafe hardcoded fallback
export const MSG91_WIDGET_ID = (import.meta.env.VITE_MSG91_WIDGET_ID || "").trim();
export const MSG91_WIDGET_TOKEN = (import.meta.env.VITE_MSG91_WIDGET_TOKEN || "").trim();

let isScriptLoaded = false;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Load official MSG91 otp-provider.js script once.
 */
export function loadMsg91Script(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (isScriptLoaded && window.initSendOTP) return Promise.resolve(true);

  if (document.getElementById(SCRIPT_ID)) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.initSendOTP) {
          clearInterval(checkInterval);
          isScriptLoaded = true;
          resolve(true);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(Boolean(window.initSendOTP));
      }, 5000);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "text/javascript";
    script.src = MSG91_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      isScriptLoaded = true;
      resolve(true);
    };

    script.onerror = () => {
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Initialize MSG91 SendOTP widget with exposeMethods: true.
 * Per documentation: Do NOT attach duplicate business processing to global success/failure callbacks.
 */
export async function initMsg91Sdk(captchaRenderId: string = "kotson-msg91-captcha"): Promise<boolean> {
  if (isInitialized && window.sendOtp) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      if (import.meta.env.DEV) {
        console.warn(
          "[MSG91 CONFIG] Phone verification widget cannot initialize: " +
          (!MSG91_WIDGET_ID ? "VITE_MSG91_WIDGET_ID is missing. " : "") +
          (!MSG91_WIDGET_TOKEN ? "VITE_MSG91_WIDGET_TOKEN is missing. " : "") +
          "Add these as Vercel environment variables (public VITE_ prefix)."
        );
      }
      return false;
    }

    const loaded = await loadMsg91Script();
    if (!loaded || !window.initSendOTP) {
      console.error("[MSG91 SDK] Failed to load MSG91 otp-provider.js script.");
      return false;
    }

    try {
      const config: Msg91Configuration = {
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_WIDGET_TOKEN,
        exposeMethods: true,
        captchaRenderId,
        success: (data: any) => {
          // Global MSG91 SDK callback - individual calls pass their own resolution handlers
          if (import.meta.env.DEV) {
            console.debug("[MSG91 GLOBAL SUCCESS]", data?.message || data?.type || "Success");
          }
        },
        failure: (error: any) => {
          // Global MSG91 SDK failure callback
          if (import.meta.env.DEV) {
            console.warn("[MSG91 GLOBAL FAILURE]", error?.message || error?.code || "Failure");
          }
        },
      };

      window.initSendOTP(config);
      isInitialized = true;
      return true;
    } catch (err) {
      console.error("[MSG91 SDK] initSendOTP threw an exception:", err);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Map provider errors to customer-friendly messages without exposing raw internals.
 */
function mapFriendlyError(err: Msg91ErrorResponse | unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const msg = (err as Msg91ErrorResponse).message || "";
  const lower = msg.toLowerCase();

  if (lower.includes("invalid") && lower.includes("otp")) {
    return "The verification code is incorrect. Please try again.";
  }
  if (lower.includes("expire")) {
    return "This verification code has expired. Request a new code.";
  }
  if (lower.includes("limit") || lower.includes("too many") || lower.includes("throttle") || lower.includes("wait")) {
    return "Too many attempts. Please wait before trying again.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  return fallback;
}

/**
 * Format Indian 10-digit mobile number for MSG91 identifier (country code without "+", e.g. "919876543210").
 */
export function formatMsg91Identifier(phone10Digits: string): string {
  const digits = phone10Digits.replace(/\D/g, "");
  const raw10 = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return `91${raw10}`;
}

export interface SendOtpResult {
  success: boolean;
  reqId?: string;
  message?: string;
  error?: string;
}

/**
 * Request OTP for customer phone number.
 */
export async function sendMsg91Otp(phone10Digits: string): Promise<SendOtpResult> {
  if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
    if (import.meta.env.DEV) {
      console.warn("[MSG91] VITE_MSG91_WIDGET_ID and/or VITE_MSG91_WIDGET_TOKEN are not configured.");
    }
    return {
      success: false,
      error: "Phone verification is temporarily unavailable. Please try again later.",
    };
  }

  const ready = await initMsg91Sdk();
  if (!ready || typeof window.sendOtp !== "function") {
    return {
      success: false,
      error: "Phone verification is temporarily unavailable. Please try again.",
    };
  }

  const identifier = formatMsg91Identifier(phone10Digits);

  return new Promise((resolve) => {
    try {
      window.sendOtp!(
        identifier,
        (data: Msg91SuccessResponse) => {
          const rawMessage = typeof data?.message === "string" ? data.message : undefined;
          const isHexId = rawMessage && /^[a-fA-F0-9]{16,}$/.test(rawMessage.trim());
          const reqId = data?.reqId || (data as any)?.requestId || (isHexId ? rawMessage.trim() : undefined);
          resolve({
            success: true,
            reqId,
            message: isHexId ? "OTP sent successfully" : (rawMessage || "OTP sent successfully"),
          });
        },
        (error: Msg91ErrorResponse) => {
          const errorMsg = mapFriendlyError(
            error,
            "We couldn't send the verification code. Please check your phone number and try again."
          );
          resolve({
            success: false,
            error: errorMsg,
          });
        }
      );
    } catch {
      resolve({
        success: false,
        error: "We couldn't send the verification code. Please try again.",
      });
    }
  });
}

export interface VerifyOtpResult {
  success: boolean;
  token?: string;
  reqId?: string;
  message?: string;
  error?: string;
}

/**
 * Verify customer entered OTP with MSG91.
 */
export async function verifyMsg91Otp(otp: string, reqId?: string): Promise<VerifyOtpResult> {
  if (typeof window.verifyOtp !== "function") {
    return {
      success: false,
      error: "Phone verification service is unavailable. Please refresh and try again.",
    };
  }

  return new Promise((resolve) => {
    try {
      window.verifyOtp!(
        otp.trim(),
        (data: Msg91VerifyResponse) => {
          // Strictly extract the verified access token without using reqId as fallback
          let token: string | undefined = undefined;

          const rawData = data as unknown;
          if (typeof rawData === "string" && rawData.trim()) {
            token = rawData.trim();
          } else if (data && typeof data === "object") {
            const candidate =
              (data as any)["access-token"] ||
              data.token ||
              data.accessToken ||
              (data as any).jwt ||
              (data as any).verificationToken;

            if (typeof candidate === "string" && candidate.trim()) {
              token = candidate.trim();
            } else if (typeof data.message === "string" && data.message.trim().length > 20) {
              // MSG91 v5 occasionally returns the JWT in the message field
              token = data.message.trim();
            }
          }

          // Request ID is kept strictly separate
          const correlationReqId = data?.reqId || reqId;

          // Safe diagnostic inspection in development without printing the secret token
          if (import.meta.env.DEV) {
            console.debug("[MSG91 DIAGNOSTIC]", {
              hasToken: Boolean(token),
              tokenType: typeof token,
              requestIdPresent: Boolean(correlationReqId),
            });
          }

          if (!token) {
            resolve({
              success: false,
              error: "Verification completed, but access token was not returned by provider. Please retry.",
            });
            return;
          }

          resolve({
            success: true,
            token,
            reqId: correlationReqId,
            message: data?.message || "Phone number verified",
          });
        },
        (error: Msg91ErrorResponse) => {
          const errorMsg = mapFriendlyError(
            error,
            "The verification code is incorrect. Please try again."
          );
          resolve({
            success: false,
            error: errorMsg,
          });
        },
        reqId
      );
    } catch {
      resolve({
        success: false,
        error: "Verification failed. Please try again.",
      });
    }
  });
}

/**
 * Resend / Retry OTP.
 */
export async function retryMsg91Otp(reqId?: string): Promise<SendOtpResult> {
  if (typeof window.retryOtp !== "function") {
    return {
      success: false,
      error: "Resend is temporarily unavailable. Please try again.",
    };
  }

  return new Promise((resolve) => {
    try {
      // Use null channel for widget's default configured channel
      window.retryOtp!(
        null,
        (data: Msg91SuccessResponse) => {
          const rawMessage = typeof data?.message === "string" ? data.message : undefined;
          const isHexId = rawMessage && /^[a-fA-F0-9]{16,}$/.test(rawMessage.trim());
          const newReqId = data?.reqId || (isHexId ? rawMessage.trim() : reqId);
          resolve({
            success: true,
            reqId: newReqId,
            message: isHexId ? "OTP resent successfully" : (rawMessage || "OTP resent successfully"),
          });
        },
        (error: Msg91ErrorResponse) => {
          const errorMsg = mapFriendlyError(
            error,
            "Could not resend verification code. Please wait before trying again."
          );
          resolve({
            success: false,
            error: errorMsg,
          });
        },
        reqId
      );
    } catch {
      resolve({
        success: false,
        error: "Could not resend verification code. Please try again.",
      });
    }
  });
}
