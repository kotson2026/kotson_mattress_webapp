// Supabase Edge Function: admin-users
// Secure server-side user management using service-role key.
// Performs user creation, edits, soft-deactivate/delete, and audit logging.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: callerUser }, error: callerError } = await supabase.auth.getUser(token);
  if (callerError || !callerUser) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check caller role
  const { data: dbCaller } = await supabase
    .from("users")
    .select("id, roles")
    .or(`supabase_auth_id.eq.${callerUser.id},id.eq.${callerUser.id}`)
    .maybeSingle();

  const isOwnerAdmin = dbCaller?.roles?.some((r: string) => r === "owner" || r === "admin");
  if (!isOwnerAdmin) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden: Owner or Admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, userId, payload } = await req.json().catch(() => ({}));

    if (action === "list") {
      const { data, error } = await supabase.rpc("kotson_admin_get_users", {
        p_start_date: payload?.start_date || null,
        p_end_date: payload?.end_date || null,
        p_search: payload?.search || null,
        p_role: payload?.role || null,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create" || action === "edit" || action === "deactivate" || action === "activate" || action === "delete") {
      const { data, error } = await supabase.rpc("kotson_admin_user_action", {
        p_action: action,
        p_user_id: userId || null,
        p_payload: payload || {},
        p_actor_id: dbCaller.id,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: `Invalid action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
