import { createFileRoute } from "@tanstack/react-router";
import { INTEGRATIONS } from "@/lib/razul";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/console/integrations")({
  component: Integrations,
});

const contractDoc = {
  schema: "razul.integration-contract.v1",
  status: "draft — no endpoint live",
  auth: {
    human: "Email/password session (owner/reviewer roles), separate from machines",
    machine: "Bearer service credential `rzl_…` (SHA-256 hashed at rest, scoped, expiring, revocable by owner)",
    scopes: ["evidence:write", "telemetry:write", "issues:read", "issues:write"],
  },
  planned_endpoints: [
    { method: "POST", path: "/api/public/razul/evidence", scope: "evidence:write", body: { build_version: "string", session_id: "string", category: "issue_category", evidence_ref: "string", captured_at: "ISO-8601", notes: "string?" } },
    { method: "POST", path: "/api/public/razul/telemetry", scope: "telemetry:write", body: { build_version: "string", session_id: "string", samples: [{ t: "ms", frame_ms: "number", net_rtt_ms: "number?", state_hash: "string?" }] } },
    { method: "GET", path: "/api/public/razul/issues?status=triaged", scope: "issues:read" },
    { method: "PATCH", path: "/api/public/razul/issues/:id/status", scope: "issues:write", body: { status: "fixed | verified" } },
  ],
  systems: INTEGRATIONS,
};

function Integrations() {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(contractDoc, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "razul-integration-contract.json"; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integration readiness</h1>
          <p className="text-sm text-muted-foreground">No external system is connected. These are documented contracts only.</p>
        </div>
        <Button className="ml-auto" variant="outline" onClick={download}>Download contract JSON</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((s) => (
          <div key={s.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-offline" />
              <h2 className="font-semibold">{s.name}</h2>
              <span className="ml-auto rounded border px-2 py-0.5 font-mono text-[10px] uppercase text-offline">Disconnected</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{s.ref}</p>
            <p className="mt-3 text-sm">{s.direction}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s.contract}</p>
            <p className="label-mono mt-4 mb-1">Prerequisites</p>
            <ul className="space-y-1 text-sm text-muted-foreground">{s.prerequisites.map((p) => <li key={p}>☐ {p}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
