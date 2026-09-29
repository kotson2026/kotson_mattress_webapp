import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

async function verifyHmacSha256(dataStr: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(dataStr));
    const hexSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (hexSignature.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < hexSignature.length; i++) {
      mismatch |= hexSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const razorpayKeySecret = (Deno.env.get("RAZORPAY_KEY_SECRET") || "").trim();

    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: "Payment gateway secret not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing required payment verification identifiers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Cryptographic HMAC-SHA256 Signature Verification
    const expectedData = `${razorpay_order_id}|${razorpay_payment_id}`;
    const isValid = await verifyHmacSha256(expectedData, razorpay_signature, razorpayKeySecret);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid payment signature", status: "signature_invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authoritative Transition to PAID in PostgreSQL (Atomic, Idempotent, Consumes Reservations)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: paymentResult, error: paymentErr } = await supabase.rpc("kotson_payment_success", {
      p_order_id: order_id || null,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_razorpay_signature: razorpay_signature,
      p_method: "razorpay",
      p_source: "verify",
    });

    if (paymentErr) {
      return new Response(
        JSON.stringify({ error: paymentErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: paymentResult.status,
        order_id: paymentResult.order_id,
        order_number: paymentResult.order_number,
        idempotent: paymentResult.idempotent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
