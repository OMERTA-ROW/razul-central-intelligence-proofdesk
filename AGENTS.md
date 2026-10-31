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
- Machine access uses `service_credentials` (hashed, scoped, expiring, revocable), separate from human login; no ingest endpoint exists yet — any future `/api/public/razul/*` route must verify the hash, scope, expiry and revocation itself.
- External systems (Anomaly Legacy, Jackboy, OMNI, Guardian) are shown as disconnected contracts in `src/lib/razul.ts`; never display fabricated telemetry or claim a connection without a live, verified integration.
