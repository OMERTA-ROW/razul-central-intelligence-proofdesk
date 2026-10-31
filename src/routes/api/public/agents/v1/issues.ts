import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, authenticateAgent, deny } from "@/lib/agent-auth.server";
import { CATEGORIES, SEVERITIES } from "@/lib/razul";

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum(CATEGORIES.map(([k]) => k) as [string, ...string[]]),
  severity: z.enum(SEVERITIES),
  build_version: z.string().trim().min(1).max(100),
  platform: z.string().max(100).optional(),
  expected_behavior: z.string().trim().min(1).max(4000),
  observed_behavior: z.string().trim().min(1).max(4000),
  repro_steps: z.string().trim().min(1).max(4000),
  evidence_ref: z.string().trim().min(1).max(500), // agents must cite evidence
});

export const Route = createFileRoute("/api/public/agents/v1/issues")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const r = await authenticateAgent(request, "issues.list", [["razul-hub", "qa:read"]]);
        if ("error" in r) return r.error;
        const { data } = await r.db.from("qa_issues")
          .select("id,title,category,severity,status,build_version,platform,expected_behavior,observed_behavior,repro_steps,evidence_ref,source,created_at,updated_at")
          .order("created_at", { ascending: false }).limit(200);
        await audit({ agent_id: r.agent.id, action: "issues.list", target: "razul-hub", outcome: "ok", detail: { count: data?.length ?? 0 } });
        return Response.json({ issues: data ?? [] }, { headers: { "cache-control": "no-store" } });
      },
      POST: async ({ request }) => {
        const r = await authenticateAgent(request, "issues.create", [["razul-hub", "qa:report"]]);
        if ("error" in r) return r.error;
        const raw = await request.text();
        if (raw.length > 20_000) return deny(413, "Payload too large");
        let body: unknown;
        try { body = JSON.parse(raw); } catch { return deny(400, "Invalid JSON"); }
        const p = schema.safeParse(body);
        if (!p.success) {
          await audit({ agent_id: r.agent.id, action: "issues.create", target: "razul-hub", outcome: "rejected", detail: { reason: p.error.issues.map((i) => i.path.join(".")).join(",") } });
          return deny(422, "Invalid payload: " + p.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
        }
        const { data, error } = await r.db.from("qa_issues").insert({
          ...p.data, category: p.data.category as never, source: "agent", agent_id: r.agent.id, reported_by: null, status: "new",
        }).select("id").single();
        if (error) return deny(500, "Could not store issue");
        await audit({ agent_id: r.agent.id, action: "issues.create", target: "razul-hub", outcome: "ok", detail: { issue: data.id } });
        return Response.json({ id: data.id }, { status: 201 });
      },
    },
  },
});
