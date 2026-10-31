import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — Razul Console" },
      { name: "description", content: "Set a new password for your Razul console account." },
      { property: "og:title", content: "Set new password — Razul Console" },
      { property: "og:description", content: "Set a new password for your Razul console account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/console" });
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <p className="label-mono">Account recovery</p>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>Update password</Button>
      </form>
    </main>
  );
}
