// Pure, browser-safe agent access policy. Server routes enforce it; tests cover it.
export const TARGETS = ["razul-hub", "anomaly-legacy", "jackboy", "omni", "guardian", "jax"] as const;
export type Target = (typeof TARGETS)[number];
export const AGENT_ROLES = ["sentinel", "angeltech", "demontech"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const OBSERVE_SCOPES = ["qa:read", "qa:report", "memory:read", "memory:write", "tasks:read", "tasks:report"] as const;
export const DEV_SCOPES = ["dev:propose", "dev:write"] as const;
/** Scopes reserved to one agent role (mirrors the DB trigger). */
export const ROLE_SCOPES: Record<string, AgentRole> = {
  "health:report": "sentinel", "ops:routine": "sentinel", "research:propose": "angeltech", "security:inspect": "demontech",
};
export const ALL_SCOPES = [...OBSERVE_SCOPES, "health:report", "ops:routine", "research:propose", "security:inspect", ...DEV_SCOPES] as const;
export type Scope = (typeof ALL_SCOPES)[number];

export type GrantLike = { target: string; scopes: string[]; expires_at: string; revoked_at: string | null };
export type AgentLike = { status: string; duties: string[]; role?: string };

export function isGrantActive(g: GrantLike, now = new Date()) {
  return !g.revoked_at && new Date(g.expires_at) > now;
}

/** Allowed only if the agent is active, holds an unexpired, unrevoked grant for the target with the scope,
 *  and dev scopes additionally require the 'developer' duty. */
export function authorize(agent: AgentLike, grants: GrantLike[], target: Target, scope: Scope, now = new Date()) {
  if (agent.status !== "active") return { ok: false as const, reason: "agent_not_active" };
  if ((DEV_SCOPES as readonly string[]).includes(scope) && !agent.duties.includes("developer"))
    return { ok: false as const, reason: "dev_duty_required" };
  const reserved = ROLE_SCOPES[scope];
  if (reserved && agent.role !== reserved) return { ok: false as const, reason: `role_${reserved}_required` };
  const g = grants.find((x) => x.target === target && x.scopes.includes(scope) && isGrantActive(x, now));
  return g ? { ok: true as const } : { ok: false as const, reason: "no_active_grant" };
}

export const isWellFormedAgentToken = (t: string) => /^rza_[0-9a-f]{64}$/.test(t);

/** Razul severity -> Jackboy agent-ingest severity (info|low|medium|high|critical). */
export function toJackboySeverity(s: string) {
  return ({ blocker: "critical", critical: "critical", major: "high", minor: "medium", trivial: "low" } as Record<string, string>)[s] ?? "info";
}
