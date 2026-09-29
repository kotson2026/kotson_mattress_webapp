// Supabase Edge Function: auth-login
// Dual-mode authentication: seamless login for Supabase Auth users + idempotent PBKDF2 legacy migration bridge.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { normalizePhone, extract10Digits, verifyLegacyPbkdf2 } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
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
    const rawIdentifier = (body.identifier || body.email || body.phone || "").trim();
    const password = body.password || "";

    if (!rawIdentifier || !password) {
      return new Response(JSON.stringify({ ok: false, error: "Email or phone and password are required" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Resolve user from public.users by email or phone
    let query = adminClient.from("users").select("*");
    if (rawIdentifier.includes("@")) {
      query = query.eq("email", rawIdentifier.toLowerCase());
    } else {
      const canonPhone = normalizePhone(rawIdentifier);
      const phone10 = extract10Digits(canonPhone);
      query = query.or(`phone.eq.${canonPhone},phone.eq.${phone10},phone.eq.+91${phone10},phone.eq.0${phone10}`);
    }

    const { data: userRecord, error: userError } = await query.maybeSingle();

    if (userError || !userRecord) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid email/phone or password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userRecord.is_active) {
      return new Response(JSON.stringify({ ok: false, error: "Account deactivated — contact administration" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUserId = userRecord.id;
    const userEmail = userRecord.email;
    const userRoles = userRecord.roles || ["customer"];
    let supabaseAuthId = userRecord.supabase_auth_id;

    // 2. CHECK IF MIGRATION BRIDGE NEEDED (Unmigrated legacy user)
    if (!supabaseAuthId || !userRecord.migrated_at) {
      console.log(`Evaluating legacy PBKDF2 migration bridge for user ${publicUserId}...`);
      const legacyHash = userRecord.password_hash || "";

      // Verify password against legacy PBKDF2 hash securely
      const isValid = await verifyLegacyPbkdf2(password, legacyHash);
      if (!isValid) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid email/phone or password" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Legacy credentials valid! Migrate user to Supabase Auth
      console.log(`PBKDF2 verified. Migrating user ${publicUserId} to Supabase Auth...`);

      // Check if auth.users already has this email
      let existingAuthUser = null;
      try {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        existingAuthUser = (listData?.users || []).find(
          (u) => u.email?.toLowerCase() === userEmail.toLowerCase()
        );
      } catch (err) {
        console.warn("Could not list auth users:", err);
      }

      if (existingAuthUser) {
        supabaseAuthId = existingAuthUser.id;
        // Update password in Supabase Auth to match
        await adminClient.auth.admin.updateUserById(supabaseAuthId, {
          password: password,
          app_metadata: { roles: userRoles },
          user_metadata: { name: userRecord.name, roles: userRoles, referral_code: userRecord.referral_code },
        });
      } else {
        // Create new Supabase Auth user
        const { data: newAuthData, error: createError } = await adminClient.auth.admin.createUser({
          email: userEmail,
          phone: userRecord.phone || undefined,
          password: password,
          email_confirm: true,
          phone_confirm: !!userRecord.phone_verified,
          app_metadata: { provider: "email", providers: ["email"], roles: userRoles },
          user_metadata: { name: userRecord.name, roles: userRoles, referral_code: userRecord.referral_code },
        });

        if (createError || !newAuthData?.user) {
          console.error("Migration auth create failed:", createError);
          return new Response(JSON.stringify({ ok: false, error: "Identity migration failed. Please try again." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        supabaseAuthId = newAuthData.user.id;
      }

      // Link identity in public.users via RPC
      const { error: linkError } = await adminClient.rpc("kotson_link_supabase_auth", {
        p_user_id: publicUserId,
        p_supabase_auth_id: supabaseAuthId,
      });

      if (linkError) {
        console.error("Link RPC error:", linkError);
      } else {
        console.log(`Successfully linked public user ${publicUserId} with Supabase Auth ID ${supabaseAuthId}`);
      }
    }

    // 3. ESTABLISH SUPABASE AUTH SESSION
    // Authenticate using public client to generate authoritative tokens
    const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: userEmail,
      password: password,
    });

    if (signInError || !signInData.session) {
      console.error("Supabase Auth signInWithPassword error:", signInError);
      return new Response(JSON.stringify({ ok: false, error: signInError?.message || "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        session: signInData.session,
        user: {
          id: publicUserId,
          email: userRecord.email,
          phone: userRecord.phone,
          name: userRecord.name,
          roles: userRoles,
          referral_code: userRecord.referral_code,
          supabase_auth_id: supabaseAuthId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Login internal error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
