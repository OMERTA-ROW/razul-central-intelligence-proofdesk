import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Razul — Private Observer Console" },
      { name: "description", content: "Owner-only console for Razul, the ecosystem memory, observation and research agent system." },
      { property: "og:title", content: "Razul — Private Observer Console" },
      { property: "og:description", content: "Owner-only console for Razul, the ecosystem memory, observation and research agent system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-lg border bg-card p-8">
        <p className="label-mono">Restricted system · owner only</p>
        <h1 className="mt-3 text-3xl font-bold">Razul</h1>
        <p className="text-lg text-primary">Ecosystem memory, observation & research</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Private owner console. Agents connect with their own scoped machine identities, never a shared login.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild><Link to="/auth">Sign in</Link></Button>
          <Button asChild variant="outline"><Link to="/console">Open console</Link></Button>
        </div>
      </div>
    </main>
  );
}
