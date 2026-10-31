# Moving Tokeny off Lovable Cloud

> **Historické (říjen 2026).** Tokeny už na Supabase neběží – backend je Neon + Vercel (viz CLAUDE.md, sekce *Backend*). Tento dokument popisuje původní plán přesunu z Lovable Cloud a slouží jen pro kontext.

Runbook for moving the backend (Postgres, Auth, Edge Functions, Storage, cron) from the
Lovable Cloud-managed Supabase project `cfjusewixhycahgxoylm` (“old”) to a Supabase project in
Martin's own org (“new”). The frontend already runs on Vercel (`tokeny.martinpohl.cz`) and stays.

> **Status of the facts below.** Items marked **(unverified)** were not confirmed against the
> live system; check them when you get there. Everything else comes from the repo, from Supabase /
> Lovable docs, or was tested locally (`supabase/tests/run-restore-test.sh`).

## 0. What moves and what doesn't

| Thing | Moves? | How |
|---|---|---|
| Tables, RLS, functions, grants (`public`) | yes | Lovable export → `scripts/restore-lovable-export.sh` |
| Migration history (`supabase_migrations`) | yes **(unverified that Lovable's export contains it)** | same; otherwise `supabase migration repair`, see step 4 |
| Users, password hashes, Google/Apple identities, MFA factors (`auth`) | yes | same (data only) |
| Sessions / refresh tokens | **no** | everybody signs in once more (JWT secret changes) |
| Vault secrets (`vault.secrets`) | **no** | encrypted with the old project's root key, which Lovable doesn't hand out; recreate (step 6) |
| Provider API keys | yes | still plaintext in `provider_credentials.api_key` on Lovable; PR #16 moves them into the **new** Vault during `supabase db push` |
| Cron jobs | recreated | by migrations `20261030120400` + `20261030150000` (they read the project URL from Vault) |
| Email cron job (Lovable created it outside migrations) | recreated | `20261030150000_cron_jobs_from_vault.sql` |
| pgmq queues | recreated empty | `supabase/restore/post-restore.sql` (queued mail is lost; it's seconds' worth) |
| Storage `og-images` files | manual | download in Lovable UI, upload with `scripts/upload-storage.mjs` |
| Edge Functions (21) | redeployed | `supabase functions deploy` / `ci/supabase-deploy.yml` |
| Function secrets | manual | `supabase secrets set` (step 7) |
| Auth providers, redirect URLs, Send-Email hook | manual | dashboard (step 9) |
| Stripe webhook | manual | new endpoint + new `whsec_` (step 10) |

**Rules until the cutover is done**

- Do **not** deploy PR #16 (Vault keys) or this branch to Lovable Cloud. They are meant to be
  applied only on the new project, after the restore. (If `20261030150000` ran on Lovable without
  the Vault secrets, it would replace Lovable's email cron job with one that does nothing.)
- Do **not** merge the stack into `main` before the cutover: whether Lovable applies migrations it
  finds on `main` by itself is **(unverified)**.
- Don't delete the Lovable project until step 14 says so; it is the rollback.

## 1. Prerequisites

- Find the Lovable account that owns the Tokeny project. It is not in the workspace of
  `hello@martinpohl.cz`; possibly `martin.pohl@gmail.com` **(unverified)**.
- Tools: Supabase CLI, `psql`/`pg_restore` **16 or newer, built with zstd** (Postgres 17 client
  works), Node 20+/bun.
- Decide the plan and region for the new project. Free plan: the org already has 2 active
  projects (the Free limit), so a third Free project needs one paused, or Pro ($25/month,
  quoted by Supabase). Region: the old project appears to be in **eu-west-1 (unverified,
  inferred from its IP address)**; pick the same to keep latency the same.

## 2. Create the new project

Supabase dashboard → New project in org `stbenvuixsaazetpfydi`, region as above, strong DB
password (store it in your password manager). Note:

- `NEW_REF` (20 characters), the project URL `https://NEW_REF.supabase.co`
- API keys: Settings → API Keys. Use the **legacy `anon` and `service_role` JWT keys** (tab
  “Legacy API keys”). Several functions keep `verify_jwt = true`, and the email cron job
  authenticates with a JWT, so the new `sb_publishable_`/`sb_secret_` keys, which are not JWTs,
  are not a drop-in replacement **(that the legacy keys are still offered on new projects is
  unverified; if they aren't, tell me and I'll adapt the functions)**.
- Session pooler connection string (Connect → Session pooler, port 5432) → `NEW_DB_URL`.

Enable extensions (Database → Extensions): `pg_cron`, `pg_net`, `pgmq`, `supabase_vault` (the
restore script also tries to enable them).

## 3. Export from Lovable

Lovable → project → **More → Database → Manage → Settings → Export data**. Limits: one export
per 24 hours, max 15 GB; the file is stored in the project's storage and emailed to you. The
export is a PostgreSQL dump **(exact format unverified)**. Check it:

```sh
pg_restore --list export.dump | head      # custom/directory format: lists the TOC
pg_restore --list export.dump | grep -c 'TABLE DATA auth '   # > 0 means users are included
```

If it is a plain `.sql` file instead, `restore-lovable-export.sh` doesn't apply; restore with
`psql` and tell me, I'll adapt the script.

Do a **rehearsal** first (this export, a throwaway restore, steps 4–12 without the cutover),
then the real one at cutover (step 13). Because of the 24 h limit, the final export has to be at
least a day after the rehearsal export.

Also download the `og-images` bucket in Lovable → Storage, keeping the folder layout
`<user id>/<file>`. If Lovable's UI can only download single files, do that; it's a handful of
images per user who set one **(UI capabilities unverified)**.

## 4. Restore schema + data

```sh
NEW_DB_URL='postgresql://postgres.NEW_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres' \
  scripts/restore-lovable-export.sh export.dump
```

One transaction; any error rolls back. It restores `public` + `supabase_migrations` (schema and
data), `auth` data (skipping GoTrue's own migration table, sessions, refresh tokens, audit log),
then runs `supabase/restore/post-restore.sql` (signup trigger on `auth.users`, pgmq queues,
`og-images` bucket + policies). It prints row counts at the end; compare with step 12's queries
on the old project.

Then check the migration history:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

It should list the migrations that are on `main`. If the table is missing or empty (Lovable may
not track migrations there, **unverified**), mark them applied by hand, otherwise `db push`
would try to recreate existing tables:

```sh
supabase link --project-ref NEW_REF
git ls-tree --name-only origin/main supabase/migrations | sed 's#.*/##; s#_.*##' | sort -u \
  | xargs supabase migration repair --status applied
```

Note: `20260509120000` exists twice on `main` (`_stripe_subscriptions` and `_subscriptions`);
the P0 branch removed the duplicate. One history row for that version is correct.

## 5. Apply the pending migrations (includes PR #16)

From the branch being deployed (this stack, or `main` once it is merged):

```sh
supabase link --project-ref NEW_REF
supabase db push --dry-run      # expect only the 2026-10-30 migrations (P0, Pro, #16, cron)
supabase db push
```

`20261030140000_provider_keys_vault.sql` (#16) copies every plaintext key into the **new**
project's Vault and drops the plaintext column. This is why #16 must run after the restore.
Locally rehearsed with `PGURL=... supabase/tests/run-restore-test.sh`.

Or run `ci/supabase-deploy.yml` (move it to `.github/workflows/` first; secrets
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).

## 6. Vault secrets for the cron jobs

The cron jobs do nothing until these exist (they no-op without them, by design). SQL editor on
the new project:

```sql
SELECT vault.create_secret('https://NEW_REF.supabase.co', 'project_url');
SELECT vault.create_secret('<same value as the AUTO_SYNC_SECRET function secret>', 'auto_sync_secret');
SELECT vault.create_secret('<legacy service_role JWT of the NEW project>', 'email_queue_service_role_key');
```

Generate the auto-sync secret with `openssl rand -hex 32`. Don't put any of these into the repo.

## 7. Function secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.
Set the rest (values from Lovable → Cloud → Secrets, or from the respective dashboards; Lovable
doesn't show existing values back, so you may need to create new keys **(unverified)**):

```sh
supabase secrets set --project-ref NEW_REF \
  ANTHROPIC_API_KEY=... \
  RESEND_API_KEY=... \
  SEND_EMAIL_HOOK_SECRET='v1,whsec_...' \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  STRIPE_TRIAL_DAYS=14 \
  AUTO_SYNC_SECRET=... \
  APP_URL=https://tokeny.martinpohl.cz
```

`SEND_EMAIL_HOOK_SECRET` comes from step 9 (the hook generates it); `STRIPE_WEBHOOK_SECRET`
from step 10. `auth-email-hook` also accepts `SUPABASE_AUTH_HOOK_SECRET` as a fallback name.

## 8. Deploy the functions

```sh
supabase functions deploy --project-ref NEW_REF --use-api
supabase functions list --project-ref NEW_REF     # expect 21
```

`verify_jwt` per function comes from `supabase/config.toml` (false for auth-email-hook, fun-ai,
mcp, usage-summary, og-dashboard, get-shared-dashboard, stripe-webhook, auto-sync).

## 9. Auth configuration (dashboard → Authentication)

Settings in use on the old project: email, phone (Twilio), anonymous sign-ins, Google, Apple.

- **URL configuration:** Site URL `https://tokeny.martinpohl.cz`; redirect URLs
  `https://tokeny.martinpohl.cz/**`, `https://tokeny.pohl.uk/**`, `https://tokeny.martinpohl.cz/auth/callback`
  (plus any app/deep-link scheme the Apple apps use, check the old project's list).
- **Google:** same client ID/secret; in Google Cloud Console add the authorised redirect URI
  `https://NEW_REF.supabase.co/auth/v1/callback`.
- **Apple:** same Services ID / key; in the Apple developer portal add the return URL
  `https://NEW_REF.supabase.co/auth/v1/callback` and the domain `NEW_REF.supabase.co`. Native
  Sign in with Apple in the iOS/Mac apps needs the app's bundle IDs in the provider's client IDs.
- **Phone:** Twilio account SID, auth token, messaging service SID.
- **Anonymous sign-ins:** on.
- **Hooks → Send Email hook:** HTTPS, `https://NEW_REF.supabase.co/functions/v1/auth-email-hook`;
  generate the secret → `SEND_EMAIL_HOOK_SECRET` (step 7).
- Copy rate limits / MFA / password settings from the old project if they were changed from defaults
  **(unknown whether they were)**.

## 10. Stripe

Stripe dashboard → Developers → Webhooks → add endpoint
`https://NEW_REF.supabase.co/functions/v1/stripe-webhook`, same events as the old endpoint;
copy its signing secret → `STRIPE_WEBHOOK_SECRET`. Disable the old endpoint at cutover (step 13),
not before. Customers/subscriptions live in Stripe and in the restored `subscriptions` table.

## 11. Storage files

```sh
SUPABASE_URL=https://NEW_REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/upload-storage.mjs ./og-images-download
```

Pass the service-role key only through the environment.

## 12. Verify (before switching traffic)

On the new project (and the same counts on the old one via a fresh export, or in Lovable's
SQL view if it has one):

```sql
SELECT 'users', count(*) FROM auth.users
UNION ALL SELECT 'identities', count(*) FROM auth.identities
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'credentials', count(*) FROM public.provider_credentials
UNION ALL SELECT 'activity_rows', count(*) FROM public.activity_rows
UNION ALL SELECT 'subscriptions', count(*) FROM public.subscriptions
UNION ALL SELECT 'shared_dashboards', count(*) FROM public.shared_dashboards;

-- every credential has its key in the NEW Vault (#16)
SELECT count(*) AS credentials, count(s.id) AS with_vault_secret
FROM public.provider_credentials c LEFT JOIN vault.secrets s ON s.id = c.api_key_secret_id;

-- cron: two jobs, no hardcoded host
SELECT jobname, schedule, command FROM cron.job;
SELECT public.tokeny_function_url('auto-sync');      -- https://NEW_REF.supabase.co/functions/v1/auto-sync
SELECT status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
SELECT id, status_code, left(content::text, 200) FROM net._http_response ORDER BY id DESC LIMIT 10;
```

Functional checks, using a local build pointed at the new project (`node scripts/set-backend.mjs
NEW_REF <anon key>` on a scratch branch, `bun run dev`):

- sign in with email+password, Google, Apple, phone; sign up a new user (gets a profile);
  password-reset mail arrives (Send Email hook + Resend);
- dashboard shows the restored history; "Sync now" for each provider works (keys decrypt);
- MCP: `https://NEW_REF.supabase.co/functions/v1/mcp` answers with an existing MCP token;
- shared dashboard link renders, OG image loads;
- Stripe: test-mode checkout or "Send test webhook" returns 200;
- after the next `:17` past the hour, `cron.job_run_details` shows a successful auto-sync.

## 13. Cutover

1. Announce a short write freeze (or just pick a quiet hour).
2. Final Lovable export (≥ 24 h after the rehearsal export). Restore it into a **fresh** new
   project, or reset the rehearsal one first (`supabase db reset --linked` wipes it; then redo
   steps 4–6 and 11). Functions, secrets, auth and Stripe settings stay.
3. Point the code at the new project:
   ```sh
   node scripts/set-backend.mjs NEW_REF <legacy anon JWT of the new project>
   ```
   This rewrites `.env`, `supabase/config.toml`, `vercel.json` (the `/api/mcp` and
   `/api/og-dashboard` rewrites), `apple/Config/Backend.xcconfig` and the `AppConfig.swift`
   fallbacks; `bunx vitest run src/test/backend-config.test.ts` confirms they agree.
4. Vercel → Settings → Environment Variables: if `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` are set there, update them
   (they override the committed `.env`); then merge/deploy the frontend.
5. Stripe: disable the old webhook endpoint.
6. Apple apps: regenerate (`xcodegen` in `apple/`) and ship new builds; old builds keep talking
   to the old project until updated, so keep Lovable alive until most users have updated or
   accept that old builds stop syncing.
7. Tell MCP users to use `https://tokeny.martinpohl.cz/api/mcp` (the Settings page already shows
   it). This URL works before and after the cutover because only the Vercel rewrite changes.
8. Everyone signs in again once.

## 14. Rollback

As long as the Lovable project still exists:

```sh
node scripts/set-backend.mjs cfjusewixhycahgxoylm <old anon key>   # old anon key is in git history
```

redeploy the frontend, re-enable the old Stripe webhook. Data written to the new project in the
meantime would have to be copied back by hand, so decide quickly. Only delete/abandon the Lovable
project after a couple of weeks without problems and after the Apple builds are updated.

## Appendix: files involved

- `scripts/set-backend.mjs`: one command to switch the project ref everywhere (refuses secret keys).
- `scripts/restore-lovable-export.sh`, `supabase/restore/post-restore.sql`: restore.
- `scripts/upload-storage.mjs`: og-images upload.
- `supabase/migrations/20261030150000_cron_jobs_from_vault.sql`: cron jobs reading the URL from Vault.
- `ci/supabase-deploy.yml`: manual GitHub Actions deploy (move to `.github/workflows/`).
- Tests: `src/test/backend-config.test.ts`, `supabase/tests/run-vault-test.sh`,
  `supabase/tests/run-restore-test.sh`.
