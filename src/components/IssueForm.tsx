import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, SEVERITIES, STATUSES } from "@/lib/razul";
import type { Database } from "@/integrations/supabase/types";

export type IssueRow = Database["public"]["Tables"]["qa_issues"]["Row"];
export type IssueInput = Pick<IssueRow, "title" | "category" | "severity" | "status" | "build_version" | "platform" | "expected_behavior" | "observed_behavior" | "repro_steps" | "evidence_ref">;

const empty: IssueInput = {
  title: "", category: "other", severity: "major", status: "new", build_version: "", platform: "",
  expected_behavior: "", observed_behavior: "", repro_steps: "", evidence_ref: "",
};

export function IssueForm({ initial, onSubmit, submitLabel }: { initial?: Partial<IssueInput>; onSubmit: (v: IssueInput) => Promise<void>; submitLabel: string }) {
  const [v, setV] = useState<IssueInput>({ ...empty, ...initial });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof IssueInput>(k: K, val: IssueInput[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(v); } finally { setBusy(false); } }}>
      <div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input required minLength={3} maxLength={200} value={v.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="space-y-2"><Label>Category</Label>
        <Select value={v.category} onValueChange={(x) => set("category", x as IssueInput["category"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select></div>
      <div className="space-y-2"><Label>Severity</Label>
        <Select value={v.severity} onValueChange={(x) => set("severity", x as IssueInput["severity"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select></div>
      <div className="space-y-2"><Label>Build version</Label><Input required maxLength={100} placeholder="e.g. 0.14.2-nightly" value={v.build_version} onChange={(e) => set("build_version", e.target.value)} /></div>
      <div className="space-y-2"><Label>Status</Label>
        <Select value={v.status} onValueChange={(x) => set("status", x as IssueInput["status"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
        </Select></div>
      <div className="space-y-2"><Label>Platform (optional)</Label><Input value={v.platform ?? ""} onChange={(e) => set("platform", e.target.value)} /></div>
      <div className="space-y-2"><Label>Evidence reference</Label><Input placeholder="Clip URL, capture ID, log path…" value={v.evidence_ref ?? ""} onChange={(e) => set("evidence_ref", e.target.value)} /></div>
      <div className="space-y-2"><Label>Expected behavior</Label><Textarea required value={v.expected_behavior} onChange={(e) => set("expected_behavior", e.target.value)} /></div>
      <div className="space-y-2"><Label>Observed behavior</Label><Textarea required value={v.observed_behavior} onChange={(e) => set("observed_behavior", e.target.value)} /></div>
      <div className="space-y-2 sm:col-span-2"><Label>Repro steps</Label><Textarea required rows={4} value={v.repro_steps} onChange={(e) => set("repro_steps", e.target.value)} /></div>
      <div className="sm:col-span-2"><Button disabled={busy} type="submit">{submitLabel}</Button></div>
    </form>
  );
}

const sevTone: Record<string, string> = {
  blocker: "bg-destructive text-destructive-foreground",
  critical: "border border-destructive text-destructive",
  major: "border border-warning text-warning",
  minor: "border text-muted-foreground",
  trivial: "border text-muted-foreground",
};
export function SeverityBadge({ s }: { s: string }) {
  return <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${sevTone[s] ?? ""}`}>{s}</span>;
}
