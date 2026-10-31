# tokeny.pohl.uk → tokeny.martinpohl.cz (301)

The redirect is **prepared but off**. `vercel.json` has no `redirects` entry. The rule is in
`ci/vercel-redirect-pohl-uk.json`, and `scripts/pohl-uk-redirect.mjs` switches it on or off.
Static `vercel.json` can't read env vars, so the "flag" is one explicit commit. A test
(`src/test/pohl-uk-redirect.test.ts`) fails if the rule ends up in `vercel.json` before that commit.

The rule matches only the host `tokeny.pohl.uk` and sends `/:path*` to
`https://tokeny.martinpohl.cz/:path*` with **301**. `permanent: true` would give a 308, so the rule
uses `statusCode: 301` instead. Path and query should be kept; check this with curl after you turn
it on (step 4).

## State on 2026-10-30 (read-only probes from the box)

| Host | DNS / server | `/` | `/auth/callback`, `/dashboard` |
|---|---|---|---|
| `tokeny.pohl.uk` | `185.158.133.1`, Cloudflare. **Lovable hosting, not Vercel** | 200 | 200 |
| `tokeny.martinpohl.cz` | Vercel (`vercel-dns-017.com`) | 200 | **404**. `main` has no `vercel.json`, so SPA deep links (including the OAuth callback) 404 |

Two consequences:
1. A `vercel.json` redirect does nothing for `tokeny.pohl.uk` until that host points to Vercel.
2. Login on `tokeny.martinpohl.cz` can't work until a branch with `vercel.json` (#13 and up) is
   deployed there. Without it, `/auth/callback` is a 404.

## Checklist before `--enable` (in this order)

1. **The new domain works.** Deploy the stack with `vercel.json` to the Vercel project behind
   `tokeny.martinpohl.cz`, then check that `/auth/callback`, `/dashboard` and `/privacy` return 200.
2. **Supabase Auth → URL Configuration.** Set Site URL to `https://tokeny.martinpohl.cz`. Keep both
   `https://tokeny.martinpohl.cz/**` and `https://tokeny.pohl.uk/**` in Redirect URLs (remove the
   old one only after a few weeks).
3. **Test login on `https://tokeny.martinpohl.cz` with every provider:**
   - Google. The Google Cloud OAuth client redirect URI is the Supabase callback
     (`https://<ref>.supabase.co/auth/v1/callback`); it doesn't change. Only add the domain under
     "Authorized JavaScript origins" if Google asks for it.
   - Sign in with Apple. The Services ID return URL is also the Supabase callback. Under Domains,
     add `tokeny.martinpohl.cz` if Apple refuses it.
   - Email and password: sign-up confirmation, magic link and password reset. The links come from
     Site URL and `redirectTo`.
   - Phone (SMS) and anonymous/demo, if they're still on.
4. **Point `tokeny.pohl.uk` at Vercel.** In Vercel → Project → Domains → Add `tokeny.pohl.uk`, then
   set the DNS record that Vercel shows (CNAME or A) at the DNS provider of `pohl.uk`. This is a DNS
   change; I didn't make it.
   - **Keep `notify.tokeny.pohl.uk`**, which is the email sending domain in
     `auth-email-hook` (`FROM_DOMAIN`). Its records are separate; change only `tokeny`.
   - Lovable may still have `tokeny.pohl.uk` as a custom domain. Remove it there after the DNS move.
5. **Turn it on:**
   ```bash
   node scripts/pohl-uk-redirect.mjs --enable
   bunx vitest run src/test/pohl-uk-redirect.test.ts   # the "NOT active" test now fails on purpose:
   # in the same commit, flip that assertion to toBe(true)
   git commit -am "Enable tokeny.pohl.uk → tokeny.martinpohl.cz 301" && git push   # then deploy
   ```
6. **Check:**
   ```bash
   curl -sI "https://tokeny.pohl.uk/auth/callback?next=%2Fsettings" | grep -iE "^(HTTP|location)"
   # expected: HTTP/2 301 + location: https://tokeny.martinpohl.cz/auth/callback?next=%2Fsettings
   ```

**Alternative without code:** Vercel → Domains → `tokeny.pohl.uk` → "Redirect to another domain"
(choose 301). It does the same job. Leave `--enable` off in that case. (I haven't checked whether
the dashboard redirect keeps the query in every case; test it with the same curl.)

**Undo:** `node scripts/pohl-uk-redirect.mjs --disable`, then commit and deploy. Browsers cache a
301 for a long time, so only turn it on once login works.
