import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IssueForm, SeverityBadge, type IssueInput } from "@/components/IssueForm";
import { CATEGORIES, OPEN_STATUSES, PLANNED_ANALYSIS, SEVERITIES, categoryLabel } from "@/lib/razul";

export const issuesQuery = queryOptions({
  queryKey: ["issues"],
  queryFn: async () => {
    const { data, error } = await supabase.from("qa_issues").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/console/qa")({
  loader: ({ context }) => context.queryClient.ensureQueryData(issuesQuery),
  component: Operations,
});

function Operations() {
  const { data: issues } = useSuspenseQuery(issuesQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const queue = issues.filter((i) => (OPEN_STATUSES as readonly string[]).includes(i.status));

  async function create(v: IssueInput) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("qa_issues").insert({ ...v, reported_by: u.user!.id, source: "manual" });
    if (error) return void toast.error(error.message);
    toast.success("Issue logged.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["issues"] });
  }

  function exportHandoff() {
    const payload = {
      schema: "razul.handoff.v1",
      generated_at: new Date().toISOString(),
      source: "Razul — Game Development Observer (manual review)",
      note: "Manually logged issues only. No automated telemetry analysis included.",
      issues: queue.map(({ reported_by: _r, agent_id: _a, ...i }) => i),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `razul-handoff-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Manual review" value="Active" tone="success" detail="Issue logging & evidence references are live." />
        <StatusCard label="Agent API (this hub)" value="Live" tone="success" detail="Granted agents can read/report issues with their own credential." />
        <StatusCard label="Automated analysis" value="Planned" tone="offline" detail="No autonomous telemetry analysis runs; agents report what they observe." />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">Evidence queue</h2>
            <p className="label-mono">{queue.length} open · {issues.length} total</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportHandoff} disabled={!queue.length}>Export handoff JSON</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm">Log issue</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>Log observed issue</DialogTitle></DialogHeader>
                <IssueForm onSubmit={create} submitLabel="Save issue" />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Queue is empty. Log an issue from reviewed game-test evidence.</p>
        ) : (
          <ul className="divide-y">
            {queue.map((i) => (
              <li key={i.id}>
                <Link to="/console/issues/$issueId" params={{ issueId: i.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted">
                  <SeverityBadge s={i.severity} />
                  <span className="font-medium">{i.title}</span>{i.source === "agent" && <span className="label-mono text-primary">agent</span>}
                  <span className="label-mono">{categoryLabel(i.category)}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{i.build_version} · {i.status.replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Review report</h2>
          <p className="label-mono mb-3">All issues by category</p>
          <table className="w-full text-sm">
            <tbody>
              {CATEGORIES.map(([k, l]) => {
                const n = issues.filter((i) => i.category === k).length;
                return <tr key={k} className="border-t"><td className="py-1.5">{l}</td><td className="text-right font-mono">{n}</td></tr>;
              })}
            </tbody>
          </table>
          <p className="label-mono mt-4 mb-2">By severity (open)</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {SEVERITIES.map((s) => <span key={s} className="flex items-center gap-1"><SeverityBadge s={s} /><span className="font-mono">{queue.filter((i) => i.severity === s).length}</span></span>)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Planned automated analysis</h2>
          <p className="label-mono mb-3">Not implemented · requires telemetry ingest</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {PLANNED_ANALYSIS.map((p) => <li key={p}>○ {p}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "success" | "offline" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="label-mono">{label}</p>
      <p className={`mt-1 flex items-center gap-2 text-lg font-semibold ${tone === "success" ? "text-success" : "text-offline"}`}>
        <span className={`h-2 w-2 rounded-full ${tone === "success" ? "bg-success pulse-dot" : "bg-offline"}`} />{value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
