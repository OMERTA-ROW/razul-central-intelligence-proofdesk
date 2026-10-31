import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessQuery, useAccess } from "@/lib/access";
import { claimOwner } from "@/lib/razul.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/console")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accessQuery),
  head: () => ({ meta: [{ title: "Console — Razul" }, { name: "description", content: "Razul's private QA observer console." }] }),
  component: ConsoleLayout,
});

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function ConsoleLayout() {
  const access = useAccess();
  const signOut = useSignOut();
  if (!access.isMember) return <NoAccess {...access} signOut={signOut} />;
  const nav = [
    { to: "/console", label: "QA observations" },
    { to: "/console/memory", label: "Memory" },
    { to: "/console/agents", label: "Agents & dispatch" },
    { to: "/console/integrations", label: "Ecosystem" },
  ] as const;
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-3">
          <div>
            <div className="font-bold">Razul</div>
            <div className="label-mono">Ecosystem memory · observer · dispatcher</div>
          </div>
          <nav className="flex gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/console" }}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="font-mono text-muted-foreground">{access.email}</span>
            <span className="rounded border border-primary/40 px-2 py-0.5 font-mono uppercase text-primary">{access.roles.join(", ")}</span>
            <Button size="sm" variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8"><Outlet /></main>
    </div>
  );
}

function NoAccess(p: ReturnType<typeof useAccess> & { signOut: () => void }) {
  const claim = useServerFn(claimOwner);
  const qc = useQueryClient();
  async function doClaim() {
    try { await claim(); toast.success("Owner role granted."); await qc.invalidateQueries({ queryKey: ["access"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8">
        <p className="label-mono">Access denied</p>
        <h1 className="text-2xl font-bold">No console access</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{p.email}</span> is signed in but is not the owner. Human access to Razul is owner-only.
        </p>
        {p.bootstrapEligible && (
          <div className="rounded border border-primary/40 bg-accent p-4 text-sm">
            <p className="mb-3">This email matches the configured owner and no owner exists yet.</p>
            <Button onClick={doClaim}>Claim owner role</Button>
          </div>
        )}
        {!p.ownerExists && !p.bootstrapConfigured && (
          <p className="text-xs text-warning">Owner bootstrap not configured: the RAZUL_OWNER_EMAIL secret is missing.</p>
        )}
        <Button variant="outline" onClick={p.signOut}>Sign out</Button>
      </div>
    </main>
  );
}
