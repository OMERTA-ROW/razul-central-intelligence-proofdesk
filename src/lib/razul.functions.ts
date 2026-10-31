import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SERVICE_SCOPES } from "./razul";

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

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => {
    const email = String(i?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Invalid email");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const token = randomToken();
    const { error } = await context.supabase.from("invitations").insert({
      email: data.email,
      role: "reviewer",
      token_hash: await sha256Hex(token),
      invited_by: context.userId,
    });
    if (error) throw new Error("Only the owner can create invitations.");
    return { token };
  });

export const createServiceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { label: string; scopes: string[] }) => {
    const label = String(i?.label ?? "").trim().slice(0, 80);
    const scopes = (i?.scopes ?? []).filter((s) => (SERVICE_SCOPES as readonly string[]).includes(s));
    if (!label || scopes.length === 0) throw new Error("Label and at least one scope required");
    return { label, scopes };
  })
  .handler(async ({ data, context }) => {
    const token = `rzl_${randomToken(24)}`;
    const { error } = await context.supabase.from("service_credentials").insert({
      label: data.label,
      scopes: data.scopes,
      token_prefix: token.slice(0, 10),
      token_hash: await sha256Hex(token),
      created_by: context.userId,
      expires_at: new Date(Date.now() + 90 * 864e5).toISOString(),
    });
    if (error) throw new Error("Only the owner can issue service credentials.");
    return { token };
  });
