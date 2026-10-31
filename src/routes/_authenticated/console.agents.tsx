import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { issueAgentCredential } from "@/lib/razul.functions";
import { useAccess } from "@/lib/access";
import { ALL_SCOPES, DEV_SCOPES, ROLE_SCOPES, TARGETS, isGrantActive } from "@/lib/agent-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/console/agents")({ component: Agents });

const q = <T,>(key: string, fn: () => PromiseLike<{ data: T | null }>) => ({ queryKey: [key], queryFn: async () => (await fn()).data ?? ([] as unknown as T) });

function Agents() {
  const { isOwner } = useAccess();
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery(q("agents", () => supabase.from("agents").select("*").order("created_at")));
  const { data: grants = [] } = useQuery(q("grants", () => supabase.from("agent_grants").select("*").order("created_at", { ascending: false })));
  const { data: creds = [] } = useQuery(q("creds", () => supabase.from("agent_credentials").select("id,agent_id,token_prefix,expires_at,revoked_at,last_used_at,created_at").order("created_at", { ascending: false })));
  const { data: log = [] } = useQuery(q("audit", () => supabase.from("agent_audit").select("*").order("created_at", { ascending: false }).limit(100)));
  const [name, setName] = useState("");
  const [dev, setDev] = useState(false);
  const [role, setRole] = useState<string>("sentinel");
  const { data: tasks = [] } = useQuery(q("tasks", () => supabase.from("agent_tasks").select("*").order("created_at", { ascending: false })));
  const refresh = () => ["agents", "grants", "creds", "audit", "tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (!isOwner) return <p className="text-muted-foreground">Owner only.</p>;

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("agents").insert({ name, role: role as never, duties: dev ? ["qa_observer", "developer"] : ["qa_observer"], created_by: u.user!.id, purpose: `Razul-dispatched ${role}` });
    if (error) return void toast.error(error.message);
    setName(""); setDev(false); refresh();
  }
  async function setStatus(id: string, status: "active" | "paused" | "revoked") {
    const { error } = await supabase.from("agents").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Agent identities</h1>
        <p className="text-sm text-muted-foreground">Machine identities, separate from the owner login. Each agent has its own key and per-project grants. Role-specific scopes (health/ops, research, security) only work for that role. No agent runtime is connected yet: tasks wait until an agent pulls them with its key.</p>
      </div>
      <form onSubmit={createAgent} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Input required placeholder="Agent name, e.g. razul-qa-01" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border bg-input px-2 py-1.5 text-sm">
          <option value="sentinel">Sentinel — project health & routine ops</option>
          <option value="angeltech">AngelTech — discovery & optimization scout</option>
          <option value="demontech">DemonTech — authorized security inspector</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={dev} onCheckedChange={(c) => setDev(!!c)} />Also assign development duty</label>
        <Button>Create agent</Button>
      </form>
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} grants={grants.filter((g) => g.agent_id === a.id)} creds={creds.filter((c) => c.agent_id === a.id)} tasks={tasks.filter((t) => t.agent_id === a.id)} onChange={refresh} setStatus={setStatus} />
      ))}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Audit log</h2>
        <ul className="mt-3 max-h-96 divide-y overflow-y-auto font-mono text-xs">
          {log.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-3 py-1.5">
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              <span>{l.action}</span><span className={l.outcome === "ok" ? "text-success" : "text-destructive"}>{l.outcome}</span>
              <span className="text-muted-foreground">{l.target ?? ""} {agents.find((a) => a.id === l.agent_id)?.name ?? ""}</span>
              <span className="text-muted-foreground">{JSON.stringify(l.detail).slice(0, 140)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type AgentRow = { id: string; name: string; duties: string[]; role: string; status: string; last_seen_at: string | null };
type TaskRow = { id: string; target: string; required_scope: string; instruction: string; status: string; result: string | null; created_at: string };
type GrantRow = { id: string; target: string; scopes: string[]; expires_at: string; revoked_at: string | null };
type CredRow = { id: string; token_prefix: string; expires_at: string; revoked_at: string | null; last_used_at: string | null };

function AgentCard({ agent, grants, creds, tasks, onChange, setStatus }: { agent: AgentRow; grants: GrantRow[]; creds: CredRow[]; tasks: TaskRow[]; onChange: () => void; setStatus: (id: string, s: "active" | "paused" | "revoked") => void }) {
  const issue = useServerFn(issueAgentCredential);
  const [token, setToken] = useState("");
  const [target, setTarget] = useState<string>("razul-hub");
  const [scopes, setScopes] = useState<string[]>(["qa:read"]);
  const [days, setDays] = useState(30);
  const isDev = agent.duties.includes("developer");
  const [instr, setInstr] = useState("");
  const activeGrantScopes = grants.filter((g) => isGrantActive(g)).flatMap((g) => g.scopes.map((sc) => `${g.target}|${sc}`));
  const [taskKey, setTaskKey] = useState("");
  async function dispatch() {
    const [t, sc] = taskKey.split("|");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("agent_tasks").insert({ agent_id: agent.id, target: t!, required_scope: sc!, instruction: instr, created_by: u.user!.id });
    if (error) toast.error(error.message); else { setInstr(""); onChange(); }
  }

  async function grant() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("agent_grants").insert({ agent_id: agent.id, target, scopes, granted_by: u.user!.id, expires_at: new Date(Date.now() + days * 864e5).toISOString() });
    if (error) toast.error(error.message); else onChange();
  }
  const revoke = async (table: "agent_grants" | "agent_credentials", id: string) => {
    const { error } = await supabase.from(table).update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">{agent.name}</h2>
        <span className="rounded border border-primary/40 px-2 py-0.5 font-mono text-[10px] uppercase text-primary">{agent.role}</span><span className="label-mono">{agent.duties.join(" + ")}</span>
        <span className={`font-mono text-xs uppercase ${agent.status === "active" ? "text-success" : "text-destructive"}`}>{agent.status}</span>
        <span className="font-mono text-xs text-muted-foreground">last seen: {agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleString() : "never"}</span>
        <div className="ml-auto flex gap-2">
          {agent.status === "active" && <Button size="sm" variant="outline" onClick={() => setStatus(agent.id, "paused")}>Pause</Button>}
          {agent.status === "paused" && <Button size="sm" variant="outline" onClick={() => setStatus(agent.id, "active")}>Resume</Button>}
          {agent.status !== "revoked" && <Button size="sm" variant="destructive" onClick={() => setStatus(agent.id, "revoked")}>Revoke agent</Button>}
        </div>
      </div>

      <div>
        <p className="label-mono mb-2">Credentials</p>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-20" /><span className="text-xs text-muted-foreground">days</span>
          <Button size="sm" disabled={agent.status === "revoked"} onClick={async () => { try { setToken((await issue({ data: { agentId: agent.id, days } })).token); onChange(); } catch (e) { toast.error((e as Error).message); } }}>Issue credential</Button>
        </div>
        {token && <div className="mt-2 rounded border border-primary/40 bg-accent p-3 text-xs"><p>Copy now — stored only as a hash. Give it to this agent's runtime as a secret.</p><code className="break-all">{token}</code></div>}
        <ul className="mt-2 divide-y text-xs">
          {creds.map((c) => {
            const active = !c.revoked_at && new Date(c.expires_at) > new Date();
            return <li key={c.id} className="flex items-center gap-3 py-1.5 font-mono"><span>{c.token_prefix}…</span><span className="text-muted-foreground">expires {new Date(c.expires_at).toLocaleDateString()} · used {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : "never"}</span><span>{active ? "active" : c.revoked_at ? "revoked" : "expired"}</span>{active && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke("agent_credentials", c.id)}>Revoke</Button>}</li>;
          })}
        </ul>
      </div>

      <div>
        <p className="label-mono mb-2">Per-project grants</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded border bg-input px-2 py-1">{TARGETS.map((t) => <option key={t}>{t}</option>)}</select>
          {ALL_SCOPES.map((s) => {
            const disabled = ((DEV_SCOPES as readonly string[]).includes(s) && !isDev) || (!!ROLE_SCOPES[s] && ROLE_SCOPES[s] !== agent.role);
            return <label key={s} className={`flex items-center gap-1 font-mono ${disabled ? "opacity-40" : ""}`}><Checkbox disabled={disabled} checked={scopes.includes(s)} onCheckedChange={(c) => setScopes((x) => c ? [...x, s] : x.filter((y) => y !== s))} />{s}</label>;
          })}
          <Button size="sm" disabled={!scopes.length || agent.status === "revoked"} onClick={grant}>Grant ({days}d)</Button>
        </div>
        <ul className="mt-2 divide-y text-xs">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-1.5 font-mono"><span>{g.target}</span><span>{g.scopes.join(", ")}</span><span className="text-muted-foreground">until {new Date(g.expires_at).toLocaleDateString()}</span><span>{isGrantActive(g) ? "active" : g.revoked_at ? "revoked" : "expired"}</span>{isGrantActive(g) && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke("agent_grants", g.id)}>Revoke</Button>}</li>
          ))}
        </ul>
        {!isDev && <p className="mt-1 text-xs text-muted-foreground">Development scopes are locked: this agent has observe duty only.</p>}
      </div>

      <div>
        <p className="label-mono mb-2">Dispatch</p>
        <div className="flex flex-wrap gap-2">
          <select value={taskKey} onChange={(e) => setTaskKey(e.target.value)} className="rounded border bg-input px-2 py-1 text-sm">
            <option value="">Choose granted target + scope…</option>
            {activeGrantScopes.map((k) => <option key={k} value={k}>{k.replace("|", " · ")}</option>)}
          </select>
          <Input placeholder="Instruction for this agent" value={instr} onChange={(e) => setInstr(e.target.value)} className="min-w-64 flex-1" />
          <Button size="sm" disabled={!taskKey || instr.length < 3 || agent.status !== "active"} onClick={dispatch}>Queue task</Button>
        </div>
        <ul className="mt-2 divide-y text-xs">
          {tasks.map((t) => (
            <li key={t.id} className="py-1.5"><span className="font-mono">{t.status}</span> · <span className="font-mono text-muted-foreground">{t.target} · {t.required_scope}</span> — {t.instruction}{t.result && <div className="mt-1 text-muted-foreground">↳ {t.result}</div>}</li>
          ))}
        </ul>
        {tasks.some((t) => t.status === "queued") && <p className="mt-1 text-xs text-warning">Queued tasks wait until this agent's runtime pulls them. Nothing executes on its own.</p>}
      </div>
    </section>
  );
}
