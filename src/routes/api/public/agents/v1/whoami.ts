import { createFileRoute } from "@tanstack/react-router";
import { authenticateAgent } from "@/lib/agent-auth.server";
import { isGrantActive } from "@/lib/agent-policy";

export const Route = createFileRoute("/api/public/agents/v1/whoami")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const r = await authenticateAgent(request, "whoami", []);
        if ("error" in r) return r.error;
        return Response.json(
          { agent: { id: r.agent.id, name: r.agent.name, duties: r.agent.duties, role: r.agent.role, status: r.agent.status }, grants: r.grants.filter((g) => isGrantActive(g)).map((g) => ({ target: g.target, scopes: g.scopes, expires_at: g.expires_at })) },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
