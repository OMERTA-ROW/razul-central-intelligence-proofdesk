import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IssueForm, SeverityBadge, type IssueInput } from "@/components/IssueForm";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";

const issueQuery = (id: string) => queryOptions({
  queryKey: ["issues", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("qa_issues").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/console/issues/$issueId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(issueQuery(params.issueId)),
  component: IssueDetail,
});

function IssueDetail() {
  const { issueId } = Route.useParams();
  const { data: issue } = useSuspenseQuery(issueQuery(issueId));
  const { isOwner } = useAccess();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (!issue) return <p className="text-muted-foreground">Issue not found or not visible to you. <Link to="/console" className="text-primary">Back</Link></p>;

  async function save(v: IssueInput) {
    const { error } = await supabase.from("qa_issues").update(v).eq("id", issueId);
    if (error) return void toast.error(error.message);
    toast.success("Issue updated.");
    qc.invalidateQueries({ queryKey: ["issues"] });
  }
  async function remove() {
    if (!confirm("Delete this issue permanently?")) return;
    const { error } = await supabase.from("qa_issues").delete().eq("id", issueId);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["issues"] });
    navigate({ to: "/console" });
  }
  return (
    <div className="space-y-6">
      <Link to="/console" className="label-mono hover:text-foreground">← Evidence queue</Link>
      <div className="flex items-center gap-3">
        <SeverityBadge s={issue.severity} />
        <h1 className="text-2xl font-bold">{issue.title}</h1>
      </div>
      <p className="font-mono text-xs text-muted-foreground">Logged {new Date(issue.created_at).toLocaleString()} · updated {new Date(issue.updated_at).toLocaleString()} · source: {issue.source}</p>
      <div className="rounded-lg border bg-card p-6">
        <IssueForm initial={issue} onSubmit={save} submitLabel="Save changes" />
      </div>
      {isOwner && <Button variant="destructive" onClick={remove}>Delete issue</Button>}
    </div>
  );
}
