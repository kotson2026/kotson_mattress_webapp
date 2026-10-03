import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const razorpayKeyId = (Deno.env.get("RAZORPAY_KEY_ID") || "").trim();
    const razorpayKeySecret = (Deno.env.get("RAZORPAY_KEY_SECRET") || "").trim();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Identify user from Authorization header if present
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      cart_id,
      token,
      shipping_address,
      billing_address,
      referral_code,
      coupon_code,
      ttl_minutes = 15,
    } = body;

    if (!cart_id) {
      return new Response(
        JSON.stringify({ error: "cart_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shipping_address || !shipping_address.name || !shipping_address.phone) {
      return new Response(
        JSON.stringify({ error: "Valid shipping_address with recipient name and phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authoritative Order Creation & Stock Reservation in PostgreSQL
    const { data: order, error: orderErr } = await supabase.rpc("kotson_checkout_start_order", {
      p_cart_id: cart_id,
      p_token: token || null,
      p_user_id: userId || null,
      p_shipping_address: shipping_address,
      p_billing_address: billing_address || null,
      p_referral_code: referral_code || null,
      p_coupon_code: coupon_code || null,
      p_ttl_minutes: ttl_minutes,
    });

    if (orderErr) {
      const status = orderErr.message.includes("Access denied") ? 403 : 400;
      return new Response(
        JSON.stringify({ error: orderErr.message }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Razorpay Order Creation (Server-Side)
    let razorpayOrderId = order.razorpay_order_id || null;
    let gatewayState = razorpayKeyId.startsWith("rzp_live_") ? "ready_live" : "ready_test";

    if (!razorpayKeyId || !razorpayKeySecret) {
      gatewayState = "pending_keys";
    } else if (!razorpayOrderId) {
      try {
        const authStr = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authStr}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: order.total_paise, // Strict integer paise
            currency: "INR",
            receipt: (order.order_number || "ORDER").slice(0, 40),
            payment_capture: 1,
          }),
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          razorpayOrderId = rzpData.id;

          // Attach Razorpay order ID to Kotson order & record payment attempt
          await supabase.rpc("kotson_checkout_attach_razorpay_order", {
            p_order_id: order.id,
            p_razorpay_order_id: razorpayOrderId,
            p_user_id: userId || null,
            p_guest_access_token: order.guest_access_token || null,
          });
        } else {
          const errData = await rzpRes.text();
          gatewayState = "error";
          console.error("Razorpay order creation failed:", errData);
        }
      } catch (err: any) {
        gatewayState = "network_error";
        console.error("Failed to connect to Razorpay:", err.message);
      }
    }

    // 3. Return safe checkout payload (NEVER expose secrets!)
    return new Response(
      JSON.stringify({
        order_id: order.id,
        order_number: order.order_number,
        amount_paise: order.total_paise,
        currency: "INR",
        status: order.status,
        payment_status: order.payment_status,
        razorpay_order_id: razorpayOrderId,
        key_id: razorpayKeyId || null, // Public test key ID only
        guest_access_token: order.guest_access_token || null,
        is_retry: order.is_retry || false,
        gateway_state: gatewayState,
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
