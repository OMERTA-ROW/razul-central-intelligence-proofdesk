import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { redirect?: string };
const safePath = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/console");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — Razul Console" },
      { name: "description", content: "Sign in to Razul's private observer console." },
      { property: "og:title", content: "Sign in — Razul Console" },
      { property: "og:description", content: "Sign in to Razul's private observer console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const target = safePath(redirect);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target as "/console" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + target },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account. Access still requires an invitation or owner bootstrap.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("If that account exists, a reset link has been sent.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <p className="label-mono">Razul · secure access</p>
        <h1 className="text-2xl font-bold">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
        </h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <Button className="w-full" disabled={busy} type="submit">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          {mode !== "signin" ? (
            <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>
          ) : (
            <>
              <button type="button" onClick={() => setMode("signup")}>Have an invitation? Create account</button>
              <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
