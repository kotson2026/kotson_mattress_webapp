// Supabase Edge Function: auth-forgot-password
// Phone OTP verification, short-lived reset authorization, and secure password reset orchestration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { normalizePhone, extract10Digits } from "../_shared/crypto.ts";
import { verifyMsg91Token } from "../auth-msg91/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESET_SECRET = Deno.env.get("RESET_SECRET") || "kotson-reset-key-secret-2026";

// Short-lived reset token helper using HMAC-SHA256
async function createResetToken(userId: string, phone: string): Promise<string> {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const payload = `${userId}:${phone}:${expiresAt}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(RESET_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return btoa(JSON.stringify({ payload, sig: sigB64 }));
}

async function verifyResetToken(tokenStr: string): Promise<{ valid: boolean; userId?: string; phone?: string; error?: string }> {
  try {
    const raw = JSON.parse(atob(tokenStr));
    const { payload, sig } = raw;
    const [userId, phone, expiresAtStr] = payload.split(":");
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() > expiresAt) {
      return { valid: false, error: "Password reset authorization has expired. Please verify your phone again." };
    }

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(RESET_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));

    if (!isValid) {
      return { valid: false, error: "Invalid password reset token." };
    }

    return { valid: true, userId, phone };
  } catch (_e) {
    return { valid: false, error: "Malformed reset token." };
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "verify";
    const body = await req.json().catch(() => ({}));

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "verify" || action === "verify_otp") {
      const canonPhone = normalizePhone(body.phone || "");
      const phone10 = extract10Digits(canonPhone);
      if (!phone10 || phone10.length !== 10) {
        return new Response(JSON.stringify({ ok: false, error: "Please enter a valid 10-digit Indian mobile number" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authoritative MSG91 OTP verification
      const otpRes = await verifyMsg91Token(body.msg91_verification_token, canonPhone, body.msg91_request_id);
      if (!otpRes.verified) {
        return new Response(JSON.stringify({ ok: false, error: otpRes.message }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check account exists
      const { data: userRecord } = await adminClient
        .from("users")
        .select("id, email, is_active")
        .or(`phone.eq.${canonPhone},phone.eq.${phone10},phone.eq.+91${phone10},phone.eq.0${phone10}`)
        .maybeSingle();

      if (!userRecord) {
        return new Response(JSON.stringify({ ok: false, error: "No account found registered with this mobile number." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!userRecord.is_active) {
        return new Response(JSON.stringify({ ok: false, error: "Account deactivated — contact administration." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resetToken = await createResetToken(userRecord.id, canonPhone);
      return new Response(
        JSON.stringify({
          ok: true,
          reset_token: resetToken,
          message: "Mobile number verified. You can now choose a new password.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset" || action === "reset_password") {
      const { reset_token, new_password, confirm_password } = body;

      if (!reset_token) {
        return new Response(JSON.stringify({ ok: false, error: "Reset authorization token is required." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!new_password || new_password.length < 8) {
        return new Response(JSON.stringify({ ok: false, error: "Password must be at least 8 characters long." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (confirm_password !== undefined && new_password !== confirm_password) {
        return new Response(JSON.stringify({ ok: false, error: "Passwords do not match." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const verifiedToken = await verifyResetToken(reset_token);
      if (!verifiedToken.valid || !verifiedToken.userId) {
        return new Response(JSON.stringify({ ok: false, error: verifiedToken.error || "Invalid or expired reset token." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userRecord } = await adminClient
        .from("users")
        .select("id, email, phone, name, roles, referral_code, supabase_auth_id, migrated_at")
        .eq("id", verifiedToken.userId)
        .maybeSingle();

      if (!userRecord) {
        return new Response(JSON.stringify({ ok: false, error: "User account not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let supabaseAuthId = userRecord.supabase_auth_id;

      // If user is unmigrated, migrate them during reset!
      if (!supabaseAuthId) {
        console.log(`Migrating legacy user ${userRecord.id} during password reset...`);
        const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
          email: userRecord.email,
          phone: userRecord.phone || undefined,
          password: new_password,
          email_confirm: true,
          phone_confirm: true,
          app_metadata: { provider: "email", providers: ["email"], roles: userRecord.roles || ["customer"] },
          user_metadata: { name: userRecord.name, roles: userRecord.roles, referral_code: userRecord.referral_code },
        });

        if (createError || !newAuthUser?.user) {
          console.error("Auth user create failed during reset:", createError);
          return new Response(JSON.stringify({ ok: false, error: "Failed to update authentication credentials." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        supabaseAuthId = newAuthUser.user.id;
        await adminClient.rpc("kotson_link_supabase_auth", {
          p_user_id: userRecord.id,
          p_supabase_auth_id: supabaseAuthId,
        });
      } else {
        // Update password in Supabase Auth
        const { error: updateError } = await adminClient.auth.admin.updateUserById(supabaseAuthId, {
          password: new_password,
        });
        if (updateError) {
          console.error("Supabase Auth password update failed:", updateError);
          return new Response(JSON.stringify({ ok: false, error: updateError.message || "Failed to update password." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update public.users record
      await adminClient
        .from("users")
        .update({
          password_hash: "SUPABASE_AUTH_MANAGED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userRecord.id);

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Password reset successfully. You can now log in with your new password.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Forgot password internal error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
