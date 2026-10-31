import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, authenticateAgent, deny } from "@/lib/agent-auth.server";
import { toJackboySeverity } from "@/lib/agent-policy";
import { categoryLabel } from "@/lib/razul";

/**
 * Relays a Razul QA issue to Jackboy's existing handshake: POST {JACKBOY_BASE_URL}/api/public/agent-ingest
 * with the Jackboy-issued project token (jbk_…). Requires the agent to hold qa:read on razul-hub AND qa:report on jackboy.
 */
export const Route = createFileRoute("/api/public/agents/v1/relay/jackboy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const r = await authenticateAgent(request, "relay.jackboy", [["razul-hub", "qa:read"], ["jackboy", "qa:report"]]);
        if ("error" in r) return r.error;
        const base = process.env["JACKBOY_BASE_URL"];
        const token = process.env["JACKBOY_INGEST_TOKEN"];
        if (!base || !token) {
          await audit({ agent_id: r.agent.id, action: "relay.jackboy", target: "jackboy", outcome: "not_configured" });
          return deny(503, "Jackboy connection not configured (JACKBOY_BASE_URL / JACKBOY_INGEST_TOKEN missing)");
        }
        const p = z.object({ issue_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!p.success) return deny(422, "issue_id (uuid) required");
        const { data: issue } = await r.db.from("qa_issues").select("*").eq("id", p.data.issue_id).maybeSingle();
        if (!issue) return deny(404, "Issue not found");

        const detail = [
          `Category: ${categoryLabel(issue.category)}`, `Build: ${issue.build_version}`, issue.platform ? `Platform: ${issue.platform}` : "",
          `Expected: ${issue.expected_behavior}`, `Observed: ${issue.observed_behavior}`, `Repro: ${issue.repro_steps}`,
          issue.evidence_ref ? `Evidence: ${issue.evidence_ref}` : "", `Razul issue: ${issue.id}`,
        ].filter(Boolean).join("\n").slice(0, 4000);
        const payload: Record<string, unknown> = {
          agent: "angeltech", kind: "diagnostic", severity: toJackboySeverity(issue.severity),
          title: `[Razul QA] ${issue.title}`.slice(0, 200), detail,
        };
        if (issue.evidence_ref && /^https?:\/\//.test(issue.evidence_ref)) payload["source_url"] = issue.evidence_ref.slice(0, 500);

        let status = 0, text = "";
        try {
          const res = await fetch(new URL("/api/public/agent-ingest", base), {
            method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(payload),
          });
          status = res.status; text = (await res.text()).slice(0, 500);
        } catch (e) { text = (e as Error).message; }
        const ok = status === 202;
        await audit({ agent_id: r.agent.id, action: "relay.jackboy", target: "jackboy", outcome: ok ? "ok" : "upstream_error", detail: { issue: issue.id, status, body: text } });
        if (ok) await r.db.from("qa_issues").update({ relayed_to: { ...(issue.relayed_to as object), jackboy: new Date().toISOString() } }).eq("id", issue.id);
        return Response.json({ ok, upstream_status: status, upstream_body: text }, { status: ok ? 200 : 502 });
      },
    },
  },
});
