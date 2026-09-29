// Supabase Edge Function: commerce-cart
// Authoritative Cart, Pricing, Coupons, Merging, and Stock Reservation Gateway.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "get";
    const body = await req.json().catch(() => ({}));

    // Authoritative Admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. GET OR CREATE CART
    if (action === "get_or_create" || action === "init") {
      const { data, error } = await supabase.rpc("kotson_get_or_create_cart", {
        p_token: body.token || null,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. VIEW CART
    if (action === "get" || action === "view") {
      const { data, error } = await supabase.rpc("kotson_cart_view", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_user_id: body.user_id || null,
      });

      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: error.message?.includes("Access denied") ? 403 : 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. ADD ITEM
    if (action === "add_item") {
      const { data, error } = await supabase.rpc("kotson_cart_add_item", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_variant_id: body.variant_id,
        p_qty: body.qty || 1,
        p_user_id: body.user_id || null,
      });

      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. UPDATE QUANTITY
    if (action === "update_qty") {
      const { data, error } = await supabase.rpc("kotson_cart_update_qty", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_variant_id: body.variant_id,
        p_qty: body.qty,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. REMOVE ITEM
    if (action === "remove_item") {
      const { data, error } = await supabase.rpc("kotson_cart_remove_item", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_variant_id: body.variant_id,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. CLEAR CART
    if (action === "clear") {
      const { data, error } = await supabase.rpc("kotson_cart_clear", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. APPLY COUPON
    if (action === "apply_coupon") {
      const { data, error } = await supabase.rpc("kotson_cart_apply_coupon", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_coupon_code: body.coupon_code,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. APPLY REFERRAL
    if (action === "apply_referral") {
      const { data, error } = await supabase.rpc("kotson_cart_apply_referral", {
        p_cart_id: body.cart_id,
        p_token: body.token || null,
        p_referral_code: body.referral_code,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. MERGE GUEST CART
    if (action === "merge") {
      const { data, error } = await supabase.rpc("kotson_cart_merge", {
        p_guest_token: body.guest_token,
        p_user_id: body.user_id,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, cart: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. AUTHORITATIVE PRICE CALCULATION
    if (action === "calculate_pricing") {
      const { data, error } = await supabase.rpc("kotson_calculate_pricing", {
        p_items: body.items || [],
        p_referral_code: body.referral_code || null,
        p_coupon_code: body.coupon_code || null,
        p_user_id: body.user_id || null,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, pricing: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 11. ATOMIC STOCK RESERVATION
    if (action === "reserve_stock") {
      const { data, error } = await supabase.rpc("kotson_reserve_inventory", {
        p_cart_id: body.cart_id || null,
        p_user_id: body.user_id || null,
        p_items: body.items,
        p_ttl_minutes: body.ttl_minutes || 15,
      });

      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, reservation: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Commerce cart error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
