import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, authenticateAgent, deny } from "@/lib/agent-auth.server";
import { EVIDENCE, KINDS, PROJECTS } from "@/lib/memory";

const schema = z.object({
  kind: z.enum(KINDS),
  project: z.enum(PROJECTS).default("ecosystem"),
  title: z.string().trim().min(3).max(300),
  body: z.string().max(20000).default(""),
  evidence: z.enum(EVIDENCE),
  sources: z.array(z.object({ url: z.string().url().max(500).refine((u) => /^https?:\/\//.test(u)), title: z.string().max(300).optional() })).max(30).default([]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  occurred_at: z.string().datetime({ offset: true }).optional(),
}).refine((d) => d.kind !== "research" || d.sources.length > 0, { message: "research entries need at least one source URL", path: ["sources"] });

/** Ecosystem memory: agents read (memory:read) and append (memory:write) on razul-hub. Append-only for agents. */
export const Route = createFileRoute("/api/public/agents/v1/knowledge")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const r = await authenticateAgent(request, "knowledge.list", [["razul-hub", "memory:read"]]);
        if ("error" in r) return r.error;
        const url = new URL(request.url);
        let q = r.db.from("knowledge_entries").select("id,kind,project,title,body,evidence,sources,tags,occurred_at,created_at").order("created_at", { ascending: false }).limit(100);
        const project = url.searchParams.get("project");
        if (project && (PROJECTS as readonly string[]).includes(project)) q = q.eq("project", project);
        const { data } = await q;
        await audit({ agent_id: r.agent.id, action: "knowledge.list", target: "razul-hub", outcome: "ok", detail: { count: data?.length ?? 0 } });
        return Response.json({ entries: data ?? [] }, { headers: { "cache-control": "no-store" } });
      },
      POST: async ({ request }) => {
        const r = await authenticateAgent(request, "knowledge.create", [["razul-hub", "memory:write"]]);
        if ("error" in r) return r.error;
        const raw = await request.text();
        if (raw.length > 60_000) return deny(413, "Payload too large");
        let body: unknown;
        try { body = JSON.parse(raw); } catch { return deny(400, "Invalid JSON"); }
        const p = schema.safeParse(body);
        if (!p.success) {
          await audit({ agent_id: r.agent.id, action: "knowledge.create", target: "razul-hub", outcome: "rejected", detail: { reason: p.error.issues.map((i) => i.message).join("; ") } });
          return deny(422, "Invalid payload: " + p.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
        }
        const { data, error } = await r.db.from("knowledge_entries").insert({ ...p.data, occurred_at: p.data.occurred_at ?? null, agent_id: r.agent.id, author_user: null }).select("id").single();
        if (error) return deny(500, "Could not store entry");
        await audit({ agent_id: r.agent.id, action: "knowledge.create", target: "razul-hub", outcome: "ok", detail: { entry: data.id, kind: p.data.kind } });
        return Response.json({ id: data.id }, { status: 201 });
      },
    },
  },
});
