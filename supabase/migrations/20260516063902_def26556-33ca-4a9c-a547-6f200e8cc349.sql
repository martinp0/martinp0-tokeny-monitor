-- Deduplicate before adding unique constraint (keep most recent per user)
DELETE FROM public.budget_alerts a
USING public.budget_alerts b
WHERE a.user_id = b.user_id AND a.created_at < b.created_at;

ALTER TABLE public.budget_alerts
  ADD CONSTRAINT budget_alerts_user_id_key UNIQUE (user_id);