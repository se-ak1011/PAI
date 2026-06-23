import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin moderation endpoint. Keeps RLS fully locked for normal clients: this is
// the ONLY path that can read all disputes/reviews or write moderation actions.
// It (1) identifies the caller from their JWT, (2) confirms they're in the
// `admins` table, then (3) does the work with the service role.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Who is calling? Verify the user's JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    // 2) Service-role client (bypasses RLS) — used for the admin check + work.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const { data: adminRow } = await admin
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "Not authorized" }, 403);

    const { action, payload } = await req.json();

    switch (action) {
      case "list_disputes": {
        const { data, error } = await admin
          .from("disputes")
          .select(`*, contractor:contractor_id(username), customer:customer_id(username), job_post:job_post_id(title)`)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }

      case "resolve_dispute": {
        const { id, outcome, note } = payload ?? {};
        if (!id || !outcome || !note?.trim()) return json({ error: "id, outcome and note are required" }, 400);
        if (!["release_to_contractor", "refund_customer"].includes(outcome)) return json({ error: "Invalid outcome" }, 400);
        const { error } = await admin
          .from("disputes")
          .update({
            status: "resolved",
            resolution_outcome: outcome,
            resolution_note: note.trim(),
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "list_reviews": {
        const { data, error } = await admin
          .from("reviews")
          .select(`*, author:author_id(username), subject:subject_id(username)`)
          .eq("mode", "contractor_to_customer")
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }

      case "moderate_review": {
        const { id, status } = payload ?? {};
        if (!id || !["published", "removed"].includes(status)) return json({ error: "id and a valid status are required" }, 400);
        const { error } = await admin.from("reviews").update({ status }).eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("admin error:", err);
    return json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
