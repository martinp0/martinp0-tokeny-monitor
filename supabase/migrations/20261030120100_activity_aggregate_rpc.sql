-- SQL-side aggregation for activity_rows, so totals are never truncated by PostgREST's
-- max-rows (1000) limit. Used by mcp, chat-agent, check-budget and og-dashboard.
--
-- SECURITY INVOKER: runs with the caller's privileges, so RLS on activity_rows still applies.
--   * authenticated callers: p_user_id is ignored in effect — RLS only exposes their own rows,
--     and the default (NULL) resolves to auth.uid().
--   * service_role callers (edge functions) must pass p_user_id explicitly.
--
-- created_at is TEXT (ISO-like: 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS.sss', or ISO 8601), so
-- filtering is lexicographic. A date-only p_to ('YYYY-MM-DD') is treated as inclusive of the
-- whole day.

CREATE OR REPLACE FUNCTION public.activity_aggregate(
  p_user_id  uuid DEFAULT NULL,
  p_from     text DEFAULT NULL,
  p_to       text DEFAULT NULL,
  p_model    text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_group_by text DEFAULT 'none'
)
RETURNS TABLE (
  bucket                text,
  cost_total            double precision,
  request_count         bigint,
  row_count             bigint,
  tokens_prompt         bigint,
  tokens_completion     bigint,
  tokens_reasoning      bigint,
  tokens_cached         bigint,
  generation_time_ms_sum double precision,
  timed_rows            bigint,
  first_at              text,
  last_at               text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    CASE p_group_by
      WHEN 'model'    THEN a.model_permaslug
      WHEN 'provider' THEN a.provider_name
      WHEN 'source'   THEN a.provider_source
      WHEN 'day'      THEN left(a.created_at, 10)
      WHEN 'hour'     THEN left(a.created_at, 13)
      ELSE 'all'
    END                                                    AS bucket,
    coalesce(sum(a.cost_total), 0)::double precision       AS cost_total,
    coalesce(sum(a.request_count), 0)::bigint              AS request_count,
    count(*)::bigint                                       AS row_count,
    coalesce(sum(a.tokens_prompt), 0)::bigint              AS tokens_prompt,
    coalesce(sum(a.tokens_completion), 0)::bigint          AS tokens_completion,
    coalesce(sum(a.tokens_reasoning), 0)::bigint           AS tokens_reasoning,
    coalesce(sum(a.tokens_cached), 0)::bigint              AS tokens_cached,
    coalesce(sum(a.generation_time_ms) FILTER (WHERE a.generation_time_ms > 0), 0)::double precision
                                                           AS generation_time_ms_sum,
    count(*) FILTER (WHERE a.generation_time_ms > 0)::bigint AS timed_rows,
    min(a.created_at)                                      AS first_at,
    max(a.created_at)                                      AS last_at
  FROM public.activity_rows a
  WHERE a.user_id = coalesce(p_user_id, auth.uid())
    AND (p_from IS NULL OR a.created_at >= p_from)
    AND (
      p_to IS NULL
      OR (length(p_to) = 10 AND a.created_at < (p_to::date + 1)::text)
      OR (length(p_to) <> 10 AND a.created_at <= p_to)
    )
    AND (p_model IS NULL OR a.model_permaslug = p_model)
    AND (p_provider IS NULL OR a.provider_name = p_provider OR a.provider_source = p_provider)
  GROUP BY 1
$$;

REVOKE ALL ON FUNCTION public.activity_aggregate(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activity_aggregate(uuid, text, text, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.activity_aggregate(uuid, text, text, text, text, text) IS
  'RLS-safe (security invoker) aggregation of activity_rows. p_group_by: none|model|provider|source|day|hour.';
