import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const { data: ownerExists } = await supabase.rpc("owner_exists");
    const ownerEmail = (process.env["RAZUL_OWNER_EMAIL"] ?? "").trim().toLowerCase();
    const email = String((claims as Record<string, unknown>)["email"] ?? "").toLowerCase();
    return {
      email,
      roles: (roles ?? []).map((r) => r.role),
      ownerExists: !!ownerExists,
      bootstrapConfigured: ownerEmail.length > 0,
      bootstrapEligible: !ownerExists && ownerEmail.length > 0 && ownerEmail === email,
    };
  });

// One-time owner bootstrap: only the confirmed account whose email equals the
// RAZUL_OWNER_EMAIL secret can claim owner, and only while no owner exists.
export const claimOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerEmail = (process.env["RAZUL_OWNER_EMAIL"] ?? "").trim().toLowerCase();
    if (!ownerEmail) throw new Error("Owner bootstrap is not configured (RAZUL_OWNER_EMAIL secret missing).");
    const { data: exists } = await context.supabase.rpc("owner_exists");
    if (exists) throw new Error("An owner already exists.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !u.user) throw new Error("Could not verify account.");
    if ((u.user.email ?? "").toLowerCase() !== ownerEmail) throw new Error("This account is not the configured owner.");
    if (!u.user.email_confirmed_at) throw new Error("Confirm your email before claiming owner.");
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "owner" });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const issueAgentCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agentId: string; days: number }) => {
    const days = Math.min(90, Math.max(1, Math.floor(Number(i?.days) || 30)));
    if (!/^[0-9a-f-]{36}$/.test(String(i?.agentId))) throw new Error("Invalid agent");
    return { agentId: i.agentId, days };
  })
  .handler(async ({ data, context }) => {
    const token = `rza_${randomToken(32)}`;
    const { error } = await context.supabase.from("agent_credentials").insert({
      agent_id: data.agentId,
      token_prefix: token.slice(0, 12),
      token_hash: await sha256Hex(token),
      created_by: context.userId,
      expires_at: new Date(Date.now() + data.days * 864e5).toISOString(),
    });
    if (error) throw new Error("Only the owner can issue agent credentials.");
    return { token };
  });

/** Reports which connections have their required secrets configured. Booleans only, never values. */
export const getConnectionReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    jackboy: { baseUrl: !!process.env["JACKBOY_BASE_URL"], ingestToken: !!process.env["JACKBOY_INGEST_TOKEN"] },
  }));
