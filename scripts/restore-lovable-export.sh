#!/usr/bin/env bash
# Restores a Lovable Cloud database export (pg_dump custom format) into a NEW, empty Supabase
# project, keeping users (with password hashes and Google/Apple identities) and all app data.
#
#   NEW_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#     scripts/restore-lovable-export.sh path/to/export.dump
#
# Use the *session* pooler (port 5432) or direct connection, not the transaction pooler (6543).
# Needs pg_restore/psql 16+ built with zstd. See docs/migrate-off-lovable.md for the full runbook.
#
# What it does, in one transaction (any error rolls everything back):
#   1. enables the extensions the schema needs (pg_cron, pg_net, pgmq, supabase_vault)
#   2. restores the `public` + `supabase_migrations` schema (tables, functions, RLS, grants) and data
#   3. restores `auth` data (users, identities, MFA factors), skipping GoTrue's own bookkeeping
#   4. runs supabase/restore/post-restore.sql (auth trigger, email queues, og-images bucket)
# Afterwards run `supabase db push` to apply the migrations Lovable never ran (incl. #16).
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP="${1:-}"
[ -n "$DUMP" ] || { echo "usage: NEW_DB_URL=... $0 path/to/export.dump" >&2; exit 1; }
: "${NEW_DB_URL:?set NEW_DB_URL to the connection string of the new project}"
case "$NEW_DB_URL" in *cfjusewixhycahgxoylm*) echo "refusing: that is the Lovable Cloud project" >&2; exit 1;; esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pg_restore --list "$DUMP" > "$WORK/toc.all"

# Schema entries for public + supabase_migrations, minus the schemas themselves (they exist or are
# created below) and extension/comment noise that a fresh Supabase project already has.
grep -E '^[0-9]+; [0-9]+ [0-9]+ [A-Z ]+ (public|supabase_migrations) ' "$WORK/toc.all" \
  | grep -vE ' (TABLE DATA|SEQUENCE SET|BLOB|BLOBS|DEFAULT ACL) ' > "$WORK/toc.schema" || true
grep -E '^[0-9]+; [0-9]+ [0-9]+ (TABLE DATA|SEQUENCE SET) (public|supabase_migrations) ' "$WORK/toc.all" > "$WORK/toc.data" || true
# auth data, without GoTrue's migration table and short-lived rows that are useless after the move
# (sessions/refresh tokens are signed with the old JWT secret anyway).
grep -E '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA auth ' "$WORK/toc.all" \
  | grep -vE ' auth (schema_migrations|sessions|refresh_tokens|flow_state|one_time_tokens|mfa_amr_claims|mfa_challenges|audit_log_entries) ' \
  > "$WORK/toc.auth" || true

echo "public/supabase_migrations schema entries: $(wc -l < "$WORK/toc.schema")"
echo "public/supabase_migrations data entries:   $(wc -l < "$WORK/toc.data")"
echo "auth data entries:                         $(wc -l < "$WORK/toc.auth") ($(cut -d" " -f7 "$WORK/toc.auth" | tr '\n' ' '))"

pg_restore --no-owner -L "$WORK/toc.schema" -f "$WORK/schema.sql" "$DUMP"
pg_restore --no-owner --data-only -L "$WORK/toc.auth" -f "$WORK/auth.sql" "$DUMP"
pg_restore --no-owner --data-only -L "$WORK/toc.data" -f "$WORK/data.sql" "$DUMP"

psql -X -q -o /dev/null -v ON_ERROR_STOP=1 --single-transaction "$NEW_DB_URL" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions" \
  -c "CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE" \
  -c "CREATE EXTENSION IF NOT EXISTS pgmq" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN CREATE EXTENSION pg_cron; END IF; END \$\$" \
  -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations" \
  -f "$WORK/schema.sql" \
  -c "SET session_replication_role = replica" \
  -f "$WORK/auth.sql" \
  -f "$WORK/data.sql" \
  -c "SET session_replication_role = DEFAULT" \
  -f supabase/restore/post-restore.sql

psql -X -A -t "$NEW_DB_URL" <<'SQL'
SELECT 'auth.users:            ' || count(*) FROM auth.users;
SELECT 'public.profiles:       ' || count(*) FROM public.profiles;
SELECT 'provider_credentials:  ' || count(*) FROM public.provider_credentials;
SELECT 'identities (Google/Apple/email): ' || (xpath('/row/c/text()', query_to_xml('select count(*) as c from auth.identities', false, true, '')))[1]::text WHERE to_regclass('auth.identities') IS NOT NULL;
SELECT 'migrations recorded:   ' || count(*) FROM supabase_migrations.schema_migrations;
SQL
echo "Restore done. Next: supabase db push (applies pending migrations incl. the Vault key move)."
