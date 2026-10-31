<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Roles live only in `public.user_roles` (owner/reviewer); all access is enforced by RLS + `has_role`/`is_member`, never by client checks — UI gating is cosmetic.
- Owner bootstrap is one-time via `claimOwner` server fn, gated on the `RAZUL_OWNER_EMAIL` secret, a confirmed email, and no existing owner — never grant owner any other way.
- Invitations are reviewer-only, single-use, email-bound, SHA-256-hashed tokens redeemed through the `redeem_invitation` security-definer RPC.
- Machine access = per-agent identities (`agents`) with their own hashed, expiring, revocable `rza_` credentials and per-project `agent_grants` (target + scopes + expiry); every agent API call goes through `authenticateAgent` in `src/lib/agent-auth.server.ts` and is written to `agent_audit`. Policy lives in `src/lib/agent-policy.ts` (tested). Dev scopes require the `developer` duty (DB trigger + policy). `service_credentials` is deprecated.
- Cross-project access only through a handshake the other project already exposes (e.g. Jackboy `/api/public/agent-ingest` with a Jackboy-issued token stored as a secret here); never modify other projects from here.
- External systems (Anomaly Legacy, Jackboy, OMNI, Guardian) are shown as disconnected contracts in `src/lib/razul.ts`; never display fabricated telemetry or claim a connection without a live, verified integration.
