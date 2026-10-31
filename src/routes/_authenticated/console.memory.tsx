import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVIDENCE, KINDS, PROJECTS } from "@/lib/memory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/console/memory")({ component: Memory });

const sel = "rounded border bg-input px-2 py-1.5 text-sm";

function Memory() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data: entries = [] } = useQuery({
    queryKey: ["knowledge", filter],
    queryFn: async () => {
      let q = supabase.from("knowledge_entries").select("*, agents(name)").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("project", filter as (typeof PROJECTS)[number]);
      return (await q).data ?? [];
    },
  });
  const [f, setF] = useState({ kind: "observation", project: "ecosystem", evidence: "observed", title: "", body: "", source: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const sources = f.source.trim() ? [{ url: f.source.trim() }] : [];
    const { error } = await supabase.from("knowledge_entries").insert({
      kind: f.kind as never, project: f.project, evidence: f.evidence as never, title: f.title, body: f.body, sources, author_user: u.user!.id,
    });
    if (error) return void toast.error(error.message.includes("research_needs_sources") ? "Research entries need a source URL." : error.message);
    setF({ ...f, title: "", body: "", source: "" });
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ecosystem memory</h1>
        <p className="text-sm text-muted-foreground">Persistent history, observations, research and reports. Agents with memory:write append here; research must cite sources. No web research runs automatically.</p>
      </div>
      <form onSubmit={add} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <select className={sel} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>{PROJECTS.map((k) => <option key={k}>{k}</option>)}</select>
        <select className={sel} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })}>{EVIDENCE.map((k) => <option key={k}>{k}</option>)}</select>
        <Input className="sm:col-span-3" required minLength={3} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea className="sm:col-span-3" placeholder="Details" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <Input className="sm:col-span-2" type="url" placeholder="Source URL (required for research)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
        <Button>Save to memory</Button>
      </form>
      <div className="flex items-center gap-2">
        <span className="label-mono">Project</span>
        <select className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}><option>all</option>{PROJECTS.map((k) => <option key={k}>{k}</option>)}</select>
        <span className="label-mono ml-auto">{entries.length} entries</span>
      </div>
      {entries.length === 0 ? <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No memory recorded yet.</p> : (
        <ul className="space-y-3">
          {entries.map((x) => (
            <li key={x.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-primary/40 px-2 py-0.5 font-mono text-[10px] uppercase text-primary">{x.kind}</span>
                <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${x.status === "confirmed" ? "border-success/40 text-success" : x.status === "proposed" ? "border-warning/40 text-warning" : "border-offline/40 text-offline"}`}>{x.status}</span>
                <span className="label-mono">{x.project} · {x.evidence}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{x.agent_id ? `agent: ${(x.agents as { name: string } | null)?.name ?? "removed"}` : x.origin === "recovered_brief" ? "recovered owner brief" : "owner"} · {new Date(x.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 font-medium">{x.title}</p>
              {x.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{x.body}</p>}
              {(x.sources as { url?: string; label?: string; note?: string }[]).map((s, i) => s.url
                ? <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block break-all font-mono text-xs text-primary">{s.url}{s.note ? ` (${s.note})` : ""}</a>
                : <span key={i} className="block font-mono text-xs text-muted-foreground">source: {s.label}</span>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
