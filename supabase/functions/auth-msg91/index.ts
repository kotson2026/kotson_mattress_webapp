// Supabase Edge Function: auth-msg91
// Server-side MSG91 OTP orchestration, access-token validation, and rate protection.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { normalizePhone, extract10Digits, maskPhone } from "../_shared/crypto.ts";

const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY") || "";
const MSG91_TEMPLATE_ID = Deno.env.get("MSG91_TEMPLATE_ID") || "";
const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
const MSG91_SEND_OTP_URL = "https://api.msg91.com/api/v5/otp";

// Rate limiting in-memory cache (per container instance)
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(key: string, limit = 5, windowMs = 3600000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) return true;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return false;
}

import { verifyMsg91Token } from "../_shared/msg91.ts";
export { verifyMsg91Token };

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "verify";
    const body = await req.json().catch(() => ({}));

    if (action === "send_otp") {
      const canonPhone = normalizePhone(body.phone || "");
      const phone10 = extract10Digits(canonPhone);
      if (!phone10 || phone10.length !== 10) {
        return new Response(
          JSON.stringify({ ok: false, error: "Please enter a valid 10-digit Indian mobile number" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isRateLimited(`otp_send_${phone10}`, 5, 3600000)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Too many OTP requests. Please try again after an hour." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
        // Return simulated delivery for staging/testing
        console.log(`[MSG91 STAGING SIMULATION] OTP sent to ${maskPhone(canonPhone)}`);
        return new Response(
          JSON.stringify({ ok: true, phone: canonPhone, mode: "simulation", message: "OTP sent successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Dispatch via MSG91 Send OTP API
      const resp = await fetch(MSG91_SEND_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authkey: MSG91_AUTH_KEY,
          template_id: MSG91_TEMPLATE_ID,
          mobile: canonPhone,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ ok: resp.ok, data, phone: canonPhone }),
        { status: resp.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify" || action === "verify_token") {
      const result = await verifyMsg91Token(
        body.token || body.msg91_verification_token,
        body.phone,
        body.requestId || body.msg91_request_id
      );

      return new Response(
        JSON.stringify({ ok: result.verified, message: result.message }),
        { status: result.verified ? 200 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
