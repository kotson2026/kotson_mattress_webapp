import { createClient } from "@supabase/supabase-js";
import type { AuthOut, User } from "./types";

// Public browser configuration ONLY — never expose service_role or backend secrets!
const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://buodzslvzkungwufdkca.supabase.co";
const _supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Kotson] VITE_SUPABASE_ANON_KEY is not set. " +
      "Add it to frontend/.env.development for local dev, or to Vercel environment variables for production. " +
      "All Supabase requests will fail until this is configured."
    );
  } else {
    // Production: surface in console without exposing config details
    console.error("[Kotson] Supabase configuration is incomplete. Please contact support if this problem persists.");
  }
}

export const SUPABASE_URL = _supabaseUrl;
export const SUPABASE_ANON_KEY = _supabaseAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});


export interface SupabaseAuthResult {
  ok: boolean;
  user?: User;
  session?: unknown;
  error?: string;
  message?: string;
  guest_cart_merged?: number;
}

async function extractFunctionError(error: any, fallback: string): Promise<string> {
  if (error && error.context && typeof error.context.json === "function") {
    try {
      const errBody = await error.context.json();
      if (errBody && typeof errBody === "object") {
        if (typeof errBody.error === "string") return errBody.error;
        if (typeof errBody.message === "string") return errBody.message;
      }
    } catch (_e) {
      // fallback
    }
  }
  return error?.message || fallback;
}

/**
 * Perform login via Supabase Edge Function bridge (supporting dual mode: Supabase Auth & PBKDF2 migration).
 */
export async function supabaseLogin(identifier: string, password: string): Promise<AuthOut> {
  const { data, error } = await supabase.functions.invoke("auth-login", {
    body: { identifier, password },
  });

  if (error || !data || !data.ok) {
    const errorMsg = data?.error || await extractFunctionError(error, "Invalid email/phone or password");
    throw new Error(errorMsg);
  }

  // If a session was returned, set it into supabase client
  if (data.session) {
    await supabase.auth.setSession(data.session);
  }

  return {
    user: data.user,
    guest_cart_merged: data.guest_cart_merged || 0,
  };
}

/**
 * Customer signup via Supabase Edge Function with MSG91 OTP verification.
 */
export async function supabaseSignup(body: {
  email: string;
  name: string;
  password: string;
  phone: string;
  referral_code?: string | null;
  consent?: boolean;
  msg91_verification_token?: string | null;
  msg91_request_id?: string | null;
}): Promise<AuthOut> {
  const { data, error } = await supabase.functions.invoke("auth-register", {
    body,
  });

  if (error || !data || !data.ok) {
    const errorMsg = data?.error || await extractFunctionError(error, "Registration failed");
    throw new Error(errorMsg);
  }

  return {
    user: data.user,
    guest_cart_merged: data.guest_cart_merged || 0,
  };
}

/**
 * Authoritative Supabase Auth Logout.
 */
export async function supabaseLogout(): Promise<{ ok: boolean }> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase auth signOut error:", err);
  }
  return { ok: true };
}

/**
 * Verify phone OTP for password reset via Edge Function.
 */
export async function supabaseVerifyForgotPasswordOtp(body: {
  phone: string;
  msg91_verification_token: string;
  msg91_request_id?: string | null;
}): Promise<{ ok: boolean; reset_token: string; message: string }> {
  const { data, error } = await supabase.functions.invoke("auth-forgot-password", {
    body: { ...body, action: "verify" },
  });

  if (error || !data || !data.ok) {
    const errorMsg = data?.message || data?.error || await extractFunctionError(error, "OTP verification failed");
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Submit password reset with short-lived token via Edge Function.
 */
export async function supabaseSubmitPasswordReset(body: {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke("auth-forgot-password", {
    body: { ...body, action: "reset" },
  });

  if (error || !data || !data.ok) {
    const errorMsg = data?.message || data?.error || await extractFunctionError(error, "Password reset failed");
    throw new Error(errorMsg);
  }

  return data;
}

