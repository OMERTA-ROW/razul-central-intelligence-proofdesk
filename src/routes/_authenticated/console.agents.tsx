import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { issueAgentCredential } from "@/lib/razul.functions";
import { useAccess } from "@/lib/access";
import { ALL_SCOPES, DEV_SCOPES, TARGETS, isGrantActive } from "@/lib/agent-policy";
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
  const refresh = () => ["agents", "grants", "creds", "audit"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (!isOwner) return <p className="text-muted-foreground">Owner only.</p>;

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("agents").insert({ name, duties: dev ? ["qa_observer", "developer"] : ["qa_observer"], created_by: u.user!.id, purpose: "Razul QA observer agent" });
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
        <p className="text-sm text-muted-foreground">Machine identities, separate from human login. Each agent needs its own credential and per-project grants. Default duty is observe/report only.</p>
      </div>
      <form onSubmit={createAgent} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Input required placeholder="Agent name, e.g. razul-qa-01" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={dev} onCheckedChange={(c) => setDev(!!c)} />Also assign development duty</label>
        <Button>Create agent</Button>
      </form>
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} grants={grants.filter((g) => g.agent_id === a.id)} creds={creds.filter((c) => c.agent_id === a.id)} onChange={refresh} setStatus={setStatus} />
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

type AgentRow = { id: string; name: string; duties: string[]; status: string; last_seen_at: string | null };
type GrantRow = { id: string; target: string; scopes: string[]; expires_at: string; revoked_at: string | null };
type CredRow = { id: string; token_prefix: string; expires_at: string; revoked_at: string | null; last_used_at: string | null };

function AgentCard({ agent, grants, creds, onChange, setStatus }: { agent: AgentRow; grants: GrantRow[]; creds: CredRow[]; onChange: () => void; setStatus: (id: string, s: "active" | "paused" | "revoked") => void }) {
  const issue = useServerFn(issueAgentCredential);
  const [token, setToken] = useState("");
  const [target, setTarget] = useState<string>("razul-hub");
  const [scopes, setScopes] = useState<string[]>(["qa:read"]);
  const [days, setDays] = useState(30);
  const isDev = agent.duties.includes("developer");

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
        <span className="label-mono">{agent.duties.join(" + ")}</span>
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
            const disabled = (DEV_SCOPES as readonly string[]).includes(s) && !isDev;
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
    </section>
  );
}
