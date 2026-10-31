import { authorize, isWellFormedAgentToken, type Scope, type Target } from "./agent-policy";

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function audit(row: { agent_id: string | null; action: string; target: string | null; outcome: string; detail?: Record<string, unknown> }) {
  const db = await getAdmin();
  await db.from("agent_audit").insert({ ...row, detail: (row.detail ?? {}) as never });
}

export const deny = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

/** Authenticates a machine agent by its rza_ bearer credential and checks every required (target, scope). */
export async function authenticateAgent(request: Request, action: string, required: [Target, Scope][]) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!isWellFormedAgentToken(token)) {
    await audit({ agent_id: null, action, target: required[0]?.[0] ?? null, outcome: "denied", detail: { reason: "malformed_token" } });
    return { error: deny(401, "Missing or malformed agent credential") };
  }
  const db = await getAdmin();
  const { data: cred } = await db.from("agent_credentials").select("id, agent_id, expires_at, revoked_at").eq("token_hash", await sha256Hex(token)).maybeSingle();
  if (!cred || cred.revoked_at || new Date(cred.expires_at) <= new Date()) {
    await audit({ agent_id: cred?.agent_id ?? null, action, target: required[0]?.[0] ?? null, outcome: "denied", detail: { reason: "invalid_revoked_or_expired_credential" } });
    return { error: deny(401, "Invalid, revoked or expired credential") };
  }
  const [{ data: agent }, { data: grants }] = await Promise.all([
    db.from("agents").select("id, name, status, duties").eq("id", cred.agent_id).single(),
    db.from("agent_grants").select("target, scopes, expires_at, revoked_at").eq("agent_id", cred.agent_id),
  ]);
  if (!agent) return { error: deny(401, "Unknown agent") };
  for (const [target, scope] of required) {
    const r = authorize(agent, grants ?? [], target, scope);
    if (!r.ok) {
      await audit({ agent_id: agent.id, action, target, outcome: "denied", detail: { scope, reason: r.reason } });
      return { error: deny(403, `Not authorized: ${scope} on ${target} (${r.reason})`) };
    }
  }
  const now = new Date().toISOString();
  await Promise.all([
    db.from("agent_credentials").update({ last_used_at: now }).eq("id", cred.id),
    db.from("agents").update({ last_seen_at: now }).eq("id", agent.id),
  ]);
  return { agent, grants: grants ?? [], db };
}
