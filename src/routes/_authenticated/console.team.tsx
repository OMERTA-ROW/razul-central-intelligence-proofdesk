import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createInvitation } from "@/lib/razul.functions";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/console/team")({ component: Team });

function Team() {
  const { isOwner } = useAccess();
  if (!isOwner) return <p className="text-muted-foreground">Owner only.</p>;
  return <div className="space-y-8"><Invitations /><Members /></div>;
}

function Invitations() {
  const qc = useQueryClient();
  const invite = useServerFn(createInvitation);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const { data } = useQuery({ queryKey: ["invitations"], queryFn: async () => (await supabase.from("invitations").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function send(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { token } = await invite({ data: { email } });
      setLink(`${window.location.origin}/invite?token=${token}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    } catch (err) { toast.error((err as Error).message); }
  }
  async function revoke(id: string) {
    const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["invitations"] });
  }
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Invitations</h2>
      <p className="mb-4 text-sm text-muted-foreground">Invite a reviewer by email. Share the one-time link privately; it expires in 7 days and only works for that email.</p>
      <form onSubmit={send} className="flex gap-2"><Input type="email" required placeholder="reviewer@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} /><Button>Create invite</Button></form>
      {link && <div className="mt-3 rounded border border-primary/40 bg-accent p-3 text-xs"><p className="mb-1">Copy now — shown once:</p><code className="break-all">{link}</code></div>}
      <ul className="mt-4 divide-y text-sm">
        {data?.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <span className="font-mono">{i.email}</span>
            <span className="label-mono">{i.accepted_at ? "accepted" : i.revoked_at ? "revoked" : new Date(i.expires_at) < new Date() ? "expired" : "pending"}</span>
            {!i.accepted_at && !i.revoked_at && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke(i.id)}>Revoke</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Members() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["members"], queryFn: async () => (await supabase.from("user_roles").select("*").order("created_at")).data ?? [] });
  async function remove(id: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["members"] });
  }
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Members</h2>
      <ul className="mt-3 divide-y text-sm">
        {data?.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <span className="font-mono text-xs">{m.user_id}</span><span className="label-mono">{m.role}</span>
            {m.role === "reviewer" && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(m.id)}>Remove access</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

