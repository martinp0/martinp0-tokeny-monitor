#!/usr/bin/env bash
# Rehearses the Lovable → own-Supabase move locally:
#   1. builds a "Lovable" database from the migrations that are on origin/main (the state Lovable
#      Cloud has applied, as far as we know), with a user and a plaintext provider key;
#   2. pg_dumps it in custom format (the format Lovable's "Export data" is assumed to produce);
#   3. restores it into a fresh database with scripts/restore-lovable-export.sh;
#   4. applies the remaining migrations like `supabase db push` would (by schema_migrations);
#   5. checks users, data, the Vault key move and the cron jobs.
# Usage: PGURL=postgres://postgres@localhost:54329 ./supabase/tests/run-restore-test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?set PGURL to a server URL (database name is ignored)}"
ADMIN="${PGURL%/*}/postgres"
SRC="${PGURL%/*}/tokeny_restore_src"
DST="${PGURL%/*}/tokeny_restore_dst"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

for db in tokeny_restore_src tokeny_restore_dst; do
  q "$ADMIN" -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
done
q "$SRC" -f supabase/tests/supabase-stub.sql
q "$DST" -f supabase/tests/supabase-stub.sql
q "$SRC" -c "CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY, name text)"

apply() { # file db
  local f="$1" db="$2" v; v="$(basename "$f")"; v="${v%%_*}"
  if ! grep -q "storage\.buckets\|storage\.objects" "$f"; then q "$db" -f "$f" >/dev/null; fi
  q "$db" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$v', '$(basename "$f")') ON CONFLICT DO NOTHING"
}

# 1. "Lovable" state = migrations present on origin/main.
git ls-tree --name-only origin/main supabase/migrations/ | grep '\.sql$' | sort > "$WORK/main.txt"
mkdir "$WORK/main"
while read -r f; do git show "origin/main:$f" > "$WORK/main/$(basename "$f")"; apply "$WORK/main/$(basename "$f")" "$SRC"; done < "$WORK/main.txt"
q "$SRC" <<'SQL'
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a1', 'restore@example.com');
INSERT INTO public.provider_credentials (user_id, provider, label, api_key, key_preview)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'openrouter', 'Default', 'sk-or-v1-restore-test-key-1234', 'sk-o…1234');
SQL

# 2. Export.
pg_dump -Fc -f "$WORK/export.dump" "$SRC"

# 3. Restore.
NEW_DB_URL="$DST" scripts/restore-lovable-export.sh "$WORK/export.dump"

# 4. "supabase db push": apply what schema_migrations doesn't list yet.
for f in supabase/migrations/*.sql; do
  v="$(basename "$f")"; v="${v%%_*}"
  if [[ -z "$(psql -X -A -t "$DST" -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$v'")" ]]; then
    echo "pending: $(basename "$f")"; apply "$f" "$DST"
  fi
done

# 5. Checks.
q "$DST" <<'SQL'
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE email = 'restore@example.com';
  ASSERT n = 1, 'user restored';
  SELECT count(*) INTO n FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  ASSERT n = 1, 'profile restored';
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass;
  ASSERT n = 1, 'signup trigger recreated';
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'provider_credentials' AND column_name = 'api_key';
  ASSERT n = 0, 'plaintext api_key column gone after the Vault migration';
  SELECT count(*) INTO n FROM vault.decrypted_secrets WHERE decrypted_secret = 'sk-or-v1-restore-test-key-1234';
  ASSERT n = 1, 'key now encrypted in the NEW project''s Vault';
  SELECT count(*) INTO n FROM cron.job WHERE jobname IN ('tokeny-auto-sync', 'process-email-queue');
  ASSERT n = 2, 'cron jobs created by pending migrations';
  SELECT count(*) INTO n FROM cron.job WHERE command LIKE '%supabase.co%';
  ASSERT n = 0, 'no cron job has a hardcoded project URL';
  INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a2', 'new@example.com');
  SELECT count(*) INTO n FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-0000000000a2';
  ASSERT n = 1, 'new sign-up gets a profile';
  RAISE NOTICE 'restore rehearsal: all checks passed';
END $$;
SQL
for db in tokeny_restore_src tokeny_restore_dst; do q "$ADMIN" -c "DROP DATABASE $db"; done
