import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

async function verifyWebhookHmac(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hexSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const webhookSecret = (Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || Deno.env.get("RAZORPAY_KEY_SECRET") || "").trim();

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Webhook secret is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Read Raw Request Body
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing x-razorpay-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Cryptographic HMAC Signature Verification
    const isValid = await verifyWebhookHmac(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Deduplication with processed_events table
    const eventIdHeader = req.headers.get("x-razorpay-event-id");
    const eventId = eventIdHeader || (await sha256Hex(rawBody));

    let bodyJson: any = {};
    try {
      bodyJson = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Malformed webhook body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventType = bodyJson.event || "unknown";

    const { data: dedupResult, error: dedupErr } = await supabase.rpc("kotson_record_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: bodyJson,
    });

    if (dedupErr) {
      console.error("Deduplication check error:", dedupErr);
    } else if (dedupResult && dedupResult.deduplicated) {
      // Idempotent: event was already processed
      return new Response(
        JSON.stringify({ ok: true, deduplicated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Process Supported Razorpay Events
    const payload = bodyJson.payload || {};
    let razorpayOrderId: string | null = null;
    let paymentId: string | null = null;
    let paymentMethod = "razorpay";

    if (payload.payment && payload.payment.entity) {
      const p = payload.payment.entity;
      paymentId = p.id || null;
      razorpayOrderId = p.order_id || null;
      paymentMethod = p.method || "razorpay";
    }

    if (payload.order && payload.order.entity) {
      razorpayOrderId = payload.order.entity.id || razorpayOrderId;
    }

    if ((eventType === "payment.captured" || eventType === "order.paid") && razorpayOrderId) {
      // Authoritative transition to PAID (Idempotent, consumes reservations)
      await supabase.rpc("kotson_payment_success", {
        p_order_id: null,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: paymentId || `pay_wh_${Date.now()}`,
        p_razorpay_signature: signature,
        p_method: paymentMethod,
        p_raw_response: payload,
        p_source: "webhook",
      });
    } else if (eventType === "payment.failed" && razorpayOrderId) {
      const p = payload.payment?.entity || {};
      await supabase.rpc("kotson_payment_failed", {
        p_razorpay_order_id: razorpayOrderId,
        p_error_code: p.error_code || "PAYMENT_FAILED",
        p_error_description: p.error_description || "Payment failed at gateway",
      });
    }

    return new Response(
      JSON.stringify({ ok: true, event: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
