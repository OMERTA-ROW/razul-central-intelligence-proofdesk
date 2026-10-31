import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INTEGRATIONS } from "@/lib/razul";

const overviewQuery = queryOptions({
  queryKey: ["razul-overview"],
  queryFn: async () => {
    const [mem, agents, grants, tasks] = await Promise.all([
      supabase.from("knowledge_entries").select("id,title,body,status,origin,project,kind,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("agents").select("id,name,role,status"),
      supabase.from("agent_grants").select("id,target,revoked_at,expires_at"),
      supabase.from("agent_tasks").select("id,status"),
    ]);
    return { mem: mem.data ?? [], agents: agents.data ?? [], grants: grants.data ?? [], tasks: tasks.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/console/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  head: () => ({ meta: [{ title: "Razul — Ecosystem memory & watchers" }, { name: "description", content: "Razul's owner console: memory, watcher agents and connection readiness." }] }),
  component: Front,
});

const tone: Record<string, string> = { confirmed: "text-success border-success/40", proposed: "text-warning border-warning/40", superseded: "text-offline border-offline/40" };

function Front() {
  const { data } = useSuspenseQuery(overviewQuery);
  const now = Date.now();
  const liveGrants = data.grants.filter((g) => !g.revoked_at && new Date(g.expires_at).getTime() > now);
  const active = data.agents.filter((a) => a.status === "active");
  const queued = data.tasks.filter((t) => t.status === "queued").length;
  const charter = data.mem.filter((m) => m.origin === "recovered_brief");

  return (
    <div className="space-y-8">
      <section className="rounded-lg border bg-card p-6">
        <p className="label-mono">Razul · owner-only</p>
        <h1 className="mt-1 text-3xl font-bold">Ecosystem memory, research & watcher agents</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Razul keeps the ecosystem's history and observations, records sourced public-web research, and dispatches authorized
          Sentinel / AngelTech / DemonTech agents that each hold their own scoped, expiring access to assigned projects.
          Agents only act when an external runtime polls their tasks — nothing runs autonomously from here.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Memory entries" value={data.mem.length} />
          <Stat label="Active agents" value={`${active.length}/${data.agents.length}`} />
          <Stat label="Live grants" value={liveGrants.length} />
          <Stat label="Queued tasks" value={queued} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center"><h2 className="font-semibold">Charter memory</h2><Link to="/console/memory" className="ml-auto text-xs text-primary">All memory →</Link></div>
          <p className="label-mono mb-3">Recovered from owner brief · labeled confirmed / proposed / superseded</p>
          <ul className="space-y-3">
            {charter.map((m) => (
              <li key={m.id} className="text-sm">
                <span className={`mr-2 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone[m.status]}`}>{m.status}</span>
                <span className="font-medium">{m.title}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center"><h2 className="font-semibold">Connection readiness</h2><Link to="/console/integrations" className="ml-auto text-xs text-primary">Details →</Link></div>
          <p className="label-mono mb-3">Only verified handshakes are shown as live</p>
          <ul className="divide-y text-sm">
            {INTEGRATIONS.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <span className={`h-2 w-2 rounded-full ${i.handshake === "live" ? "bg-success" : i.handshake === "defined_needs_secrets" ? "bg-warning" : "bg-offline"}`} />
                <span className="font-medium">{i.name}</span>
                <span className="ml-auto label-mono">{i.handshake === "live" ? "live" : i.handshake === "defined_needs_secrets" ? "needs secrets" : "not connected"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Agent runtime: <span className="text-offline">none connected</span>. Tasks stay queued until an agent polls with its own credential.</p>
          <div className="mt-4 flex gap-2 text-xs">
            <Link to="/console/agents" className="text-primary">Manage agents & grants →</Link>
            <Link to="/console/qa" className="ml-auto text-primary">Game QA log →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded border p-3"><p className="label-mono">{label}</p><p className="mt-1 font-mono text-xl">{value}</p></div>;
}
