// Supabase Edge Function: auth-register
// Authoritative customer registration with Supabase Auth, MSG91 verification, and dual identity linkage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { normalizePhone, extract10Digits, mintReferralCode } from "../_shared/crypto.ts";
import { verifyMsg91Token } from "../_shared/msg91.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      phone,
      password,
      confirm_password,
      referral_code,
      consent,
      msg91_verification_token,
      msg91_request_id,
    } = body;

    // 1. Validation
    const cleanName = (name || "").trim();
    if (!cleanName || cleanName.length < 2) {
      return new Response(JSON.stringify({ ok: false, error: "Full Name is required" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return new Response(JSON.stringify({ ok: false, error: "Please provide a valid email address" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canonPhone = normalizePhone(phone || "");
    const phone10 = extract10Digits(canonPhone);
    if (!phone10 || phone10.length !== 10) {
      return new Response(JSON.stringify({ ok: false, error: "Please enter a valid 10-digit Indian mobile number" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: "Password must be at least 8 characters long" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (confirm_password !== undefined && password !== confirm_password) {
      return new Response(JSON.stringify({ ok: false, error: "Passwords do not match" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (consent === false) {
      return new Response(JSON.stringify({ ok: false, error: "Consent to Terms and Privacy Policy is required" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Authoritative MSG91 OTP Evidence Verification
    const otpVerify = await verifyMsg91Token(msg91_verification_token, canonPhone, msg91_request_id);
    if (!otpVerify.verified) {
      return new Response(JSON.stringify({ ok: false, error: otpVerify.message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Initialize Supabase Admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Duplicate checks
    const { data: existingUserEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingUserEmail) {
      return new Response(JSON.stringify({ ok: false, error: "This email is already registered. Sign in instead." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingUserPhone } = await supabase
      .from("users")
      .select("id")
      .or(`phone.eq.${canonPhone},phone.eq.${phone10},phone.eq.+91${phone10}`)
      .maybeSingle();

    if (existingUserPhone) {
      return new Response(JSON.stringify({ ok: false, error: "This phone number is already registered. Sign in instead." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Mint unique referral code
    let userReferralCode = mintReferralCode();
    for (let i = 0; i < 5; i++) {
      const { data: codeCheck } = await supabase
        .from("users")
        .select("id")
        .eq("referral_code", userReferralCode)
        .maybeSingle();
      if (!codeCheck) break;
      userReferralCode = mintReferralCode();
    }

    // 6. Check referred_by code if supplied
    let verifiedReferredBy = null;
    if (referral_code && typeof referral_code === "string") {
      const cleanRef = referral_code.trim().toUpperCase();
      const { data: refOwner } = await supabase
        .from("users")
        .select("id")
        .eq("referral_code", cleanRef)
        .eq("is_active", true)
        .maybeSingle();
      if (refOwner) {
        verifiedReferredBy = cleanRef;
      }
    }

    // 7. Create Supabase Auth Identity
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      phone: canonPhone,
      password: password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        name: cleanName,
        roles: ["customer"],
        referral_code: userReferralCode,
      },
      app_metadata: {
        provider: "email",
        providers: ["email", "phone"],
        roles: ["customer"],
      },
    });

    if (authError || !authData.user) {
      console.error("Supabase Auth create user failed:", authError);
      return new Response(JSON.stringify({ ok: false, error: authError?.message || "Failed to create authentication user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuthId = authData.user.id;
    const applicationUserId = crypto.randomUUID();

    // 8. Register in public.users via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc("kotson_register_customer", {
      p_user_id: applicationUserId,
      p_email: cleanEmail,
      p_phone: canonPhone,
      p_name: cleanName,
      p_password_hash: "SUPABASE_AUTH_MANAGED",
      p_supabase_auth_id: supabaseAuthId,
      p_referral_code: userReferralCode,
      p_referred_by: verifiedReferredBy,
      p_consent: {
        agreed: true,
        terms_and_privacy: true,
        agreed_at: new Date().toISOString(),
        version: "2026-v1",
      },
    });

    if (rpcError) {
      console.error("Registration RPC error:", rpcError);
      // Rollback auth user
      await supabase.auth.admin.deleteUser(supabaseAuthId);
      return new Response(JSON.stringify({ ok: false, error: rpcError.message || "Failed to persist user profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: applicationUserId,
          email: cleanEmail,
          phone: canonPhone,
          name: cleanName,
          roles: ["customer"],
          referral_code: userReferralCode,
          supabase_auth_id: supabaseAuthId,
        },
        message: "Registration successful. You can now log in.",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Registration internal error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
