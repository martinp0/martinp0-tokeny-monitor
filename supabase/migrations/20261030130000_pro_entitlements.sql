-- Server-side Pro entitlements.
--
-- Free tier: 1 provider credential, last 30 days of history, CSV import.
-- Pro: everything (multi-provider, full history, auto-sync, budget alerts, exports, MCP, AI agent,
-- shared dashboards).
--
-- The TS twin of these rules is supabase/functions/_shared/plan.ts — keep in sync.
-- Edge functions that use the service role (bypassing RLS) enforce the same rules in code.

-- 1. Entitlement helpers -----------------------------------------------------------------------

-- is_pro(uid): for service_role / internal use only (would leak other users' plan otherwise).
CREATE OR REPLACE FUNCTION public.is_pro(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trialing', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_pro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO service_role;

-- current_user_is_pro(): the caller's own plan (used by RLS and the client).
CREATE OR REPLACE FUNCTION public.current_user_is_pro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE public.is_pro(auth.uid()) END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_pro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_pro() TO authenticated, service_role;

-- First visible day for free users, as 'YYYY-MM-DD' (activity_rows.created_at is ISO-ish TEXT,
-- so a prefix string comparison is exact and never fails on odd formats).
CREATE OR REPLACE FUNCTION public.free_history_floor()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char((now() AT TIME ZONE 'utc') - interval '30 days', 'YYYY-MM-DD');
$$;

GRANT EXECUTE ON FUNCTION public.free_history_floor() TO authenticated, service_role;

-- 2. activity_rows: free users see the last 30 days --------------------------------------------
-- Rows are never deleted; upgrading reveals full history again.
-- Wrapped in (SELECT …) so Postgres evaluates the helpers once per query (initplan), not per row.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_rows'
      AND cmd = 'SELECT' AND 'authenticated' = ANY (roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.activity_rows', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users read own activity rows (free: last 30 days)"
  ON public.activity_rows FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      (SELECT public.current_user_is_pro())
      OR left(created_at, 10) >= (SELECT public.free_history_floor())
    )
  );

-- 3. budget_alerts: Pro only (read/delete stay allowed so a downgraded user can clean up) --------
DROP POLICY IF EXISTS "Users manage own budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Users read own budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Users delete own budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Pro users insert budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Pro users update budget alerts" ON public.budget_alerts;

CREATE POLICY "Users read own budget alerts" ON public.budget_alerts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own budget alerts" ON public.budget_alerts
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Pro users insert budget alerts" ON public.budget_alerts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (SELECT public.current_user_is_pro()));
CREATE POLICY "Pro users update budget alerts" ON public.budget_alerts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (SELECT public.current_user_is_pro()));

-- 4. shared_dashboards: creating/editing shares is Pro; read/delete own stays allowed ------------
DROP POLICY IF EXISTS "Users can manage own shared dashboards" ON public.shared_dashboards;
DROP POLICY IF EXISTS "Users read own shared dashboards" ON public.shared_dashboards;
DROP POLICY IF EXISTS "Users delete own shared dashboards" ON public.shared_dashboards;
DROP POLICY IF EXISTS "Pro users insert shared dashboards" ON public.shared_dashboards;
DROP POLICY IF EXISTS "Pro users update shared dashboards" ON public.shared_dashboards;

CREATE POLICY "Users read own shared dashboards" ON public.shared_dashboards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own shared dashboards" ON public.shared_dashboards
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Pro users insert shared dashboards" ON public.shared_dashboards
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (SELECT public.current_user_is_pro()));
-- Updates (label/expiry/og image reset) stay allowed for the owner so a downgraded user can
-- still manage or revoke existing links.
CREATE POLICY "Pro users update shared dashboards" ON public.shared_dashboards
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. mcp_tokens: created only by the create-mcp-token function (service role, Pro-checked).
--    Owners may still list and delete their tokens.
DROP POLICY IF EXISTS "Users manage own mcp tokens" ON public.mcp_tokens;
DROP POLICY IF EXISTS "Users read own mcp tokens" ON public.mcp_tokens;
DROP POLICY IF EXISTS "Users delete own mcp tokens" ON public.mcp_tokens;

CREATE POLICY "Users read own mcp tokens" ON public.mcp_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own mcp tokens" ON public.mcp_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. subscriptions lookups used by the webhook / checkout
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON public.subscriptions (stripe_subscription_id);

-- 7. auto-sync picks only Pro users' credentials (in SQL, so free users' never-synced
--    credentials cannot fill the batch and starve paying users).
CREATE OR REPLACE FUNCTION public.auto_sync_due_credentials(p_due_before timestamptz, p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, user_id uuid, provider text, api_key text, enabled boolean, last_synced_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_id, c.provider, c.api_key, c.enabled, c.last_synced_at
  FROM public.provider_credentials c
  WHERE c.enabled
    AND c.provider IN ('openrouter', 'anthropic', 'openai')
    AND (c.last_sync_attempt_at IS NULL OR c.last_sync_attempt_at < p_due_before)
    AND public.is_pro(c.user_id)
  ORDER BY c.last_sync_attempt_at ASC NULLS FIRST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
$$;

REVOKE ALL ON FUNCTION public.auto_sync_due_credentials(timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_sync_due_credentials(timestamptz, int) TO service_role;

-- 8. Accept every Stripe subscription status (incl. 'paused'), so the webhook upsert never fails
--    on a CHECK constraint and loops on Stripe retries.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (
  status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired',
             'unpaid', 'paused', 'inactive')
);
