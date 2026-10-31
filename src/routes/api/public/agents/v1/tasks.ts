import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, authenticateAgent, deny } from "@/lib/agent-auth.server";
import { authorize, type Scope, type Target } from "@/lib/agent-policy";

/** Dispatcher: an agent pulls only its own tasks (tasks:read) and reports on them (tasks:report).
 *  A task can only be acknowledged/reported if the agent also holds the task's required scope on its target. */
export const Route = createFileRoute("/api/public/agents/v1/tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const r = await authenticateAgent(request, "tasks.list", [["razul-hub", "tasks:read"]]);
        if ("error" in r) return r.error;
        const { data } = await r.db.from("agent_tasks").select("id,target,required_scope,instruction,status,created_at")
          .eq("agent_id", r.agent.id).in("status", ["queued", "acknowledged", "in_progress"]).order("created_at");
        return Response.json({ tasks: data ?? [] }, { headers: { "cache-control": "no-store" } });
      },
      PATCH: async ({ request }) => {
        const r = await authenticateAgent(request, "tasks.report", [["razul-hub", "tasks:report"]]);
        if ("error" in r) return r.error;
        const p = z.object({
          id: z.string().uuid(),
          status: z.enum(["acknowledged", "in_progress", "reported", "failed"]),
          result: z.string().max(8000).optional(),
          result_entry: z.string().uuid().optional(),
        }).safeParse(await request.json().catch(() => null));
        if (!p.success) return deny(422, "Invalid payload");
        const { data: task } = await r.db.from("agent_tasks").select("*").eq("id", p.data.id).eq("agent_id", r.agent.id).maybeSingle();
        if (!task) return deny(404, "Task not found for this agent");
        if (["reported", "failed", "cancelled"].includes(task.status)) return deny(409, `Task already ${task.status}`);
        const allowed = authorize(r.agent, r.grants, task.target as Target, task.required_scope as Scope);
        if (!allowed.ok) {
          await audit({ agent_id: r.agent.id, action: "tasks.report", target: task.target, outcome: "denied", detail: { task: task.id, scope: task.required_scope, reason: allowed.reason } });
          return deny(403, `Not authorized for task scope ${task.required_scope} on ${task.target} (${allowed.reason})`);
        }
        await r.db.from("agent_tasks").update({ status: p.data.status, result: p.data.result ?? task.result, result_entry: p.data.result_entry ?? task.result_entry, updated_at: new Date().toISOString() }).eq("id", task.id);
        await audit({ agent_id: r.agent.id, action: "tasks.report", target: task.target, outcome: "ok", detail: { task: task.id, status: p.data.status } });
        return Response.json({ ok: true });
      },
    },
  },
});
