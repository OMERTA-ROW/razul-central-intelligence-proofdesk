import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { INTEGRATIONS } from "@/lib/razul";
import { getConnectionReadiness } from "@/lib/razul.functions";

export const Route = createFileRoute("/_authenticated/console/integrations")({ component: Integrations });

function Integrations() {
  const fn = useServerFn(getConnectionReadiness);
  const { data } = useQuery({ queryKey: ["readiness"], queryFn: () => fn() });
  const status = (id: string, h: string) => {
    if (h === "live") return ["Live", "text-success"];
    if (id === "jackboy" && data?.jackboy.baseUrl && data.jackboy.ingestToken) return ["Configured — untested until first relay", "text-warning"];
    if (h === "defined_needs_secrets") return ["Handshake exists — credentials pending", "text-warning"];
    return ["No handshake — not connected", "text-offline"];
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project access readiness</h1>
        <p className="text-sm text-muted-foreground">Based on read-only inspection of each project. No other project was modified.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((s) => {
          const [label, tone] = status(s.id, s.handshake);
          return (
            <div key={s.id} className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold">{s.name}</h2>
              <p className="font-mono text-xs text-muted-foreground">{s.ref}</p>
              <p className={`mt-2 text-sm font-semibold ${tone}`}>{label}</p>
              {s.id === "jackboy" && data && (
                <p className="font-mono text-xs text-muted-foreground">JACKBOY_BASE_URL: {data.jackboy.baseUrl ? "set" : "missing"} · JACKBOY_INGEST_TOKEN: {data.jackboy.ingestToken ? "set" : "missing"}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{s.finding}</p>
              <p className="label-mono mt-4 mb-1">Pending prerequisites</p>
              <ul className="space-y-1 text-sm text-muted-foreground">{s.prerequisites.map((p) => <li key={p}>☐ {p}</li>)}</ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
