import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/invite")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  head: () => ({ meta: [{ title: "Accept invitation — Razul Console" }, { name: "description", content: "Accept an invitation to Razul's console." }] }),
  component: InvitePage,
});

const messages: Record<string, string> = {
  invalid_invitation: "This invitation link is not valid.",
  invitation_revoked: "This invitation was revoked by the owner.",
  invitation_used: "This invitation has already been used.",
  invitation_expired: "This invitation has expired. Ask the owner for a new one.",
  email_mismatch: "This invitation was issued to a different email address.",
};

function InvitePage() {
  const { token } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc("redeem_invitation", { _token: token });
    setBusy(false);
    if (error) {
      const key = Object.keys(messages).find((k) => error.message.includes(k));
      return toast.error(key ? messages[key] : error.message);
    }
    toast.success("Invitation accepted. Welcome to Razul's console.");
    await qc.invalidateQueries({ queryKey: ["access"] });
    navigate({ to: "/console" });
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8">
        <p className="label-mono">Invitation</p>
        <h1 className="text-2xl font-bold">Join Razul's console</h1>
        <p className="text-sm text-muted-foreground">Signed in as <span className="font-mono text-foreground">{user.email}</span>. The invitation must match this email.</p>
        <Button disabled={!token || busy} onClick={accept} className="w-full">Accept invitation as reviewer</Button>
      </div>
    </main>
  );
}
