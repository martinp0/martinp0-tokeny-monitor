#!/usr/bin/env bash
# Applies all migrations to a throwaway Postgres with the supabase_vault extension and checks the
# Vault key migration, including the backfill of plaintext keys.
#
# Needs: Postgres 15+ with supabase_vault installed and preloaded (shared_preload_libraries,
# vault.getkey_script). Usage: PGURL=postgres://postgres@localhost:54329 ./supabase/tests/run-vault-test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?set PGURL to a server URL (database name is ignored)}"
DB=tokeny_vault_test
ADMIN="${PGURL%/*}/postgres"
URL="${PGURL%/*}/$DB"
psql -q "$ADMIN" -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -q -v ON_ERROR_STOP=1 "$URL" -f supabase/tests/supabase-stub.sql

VAULT=supabase/migrations/20261030140000_provider_keys_vault.sql
for f in supabase/migrations/*.sql; do
  if [[ "$f" == "$VAULT" ]]; then
    psql -q -v ON_ERROR_STOP=1 "$URL" <<'SQL'
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'u1@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'u2@example.com');
INSERT INTO public.provider_credentials (user_id, provider, label, api_key, key_preview)
VALUES ('00000000-0000-0000-0000-000000000001', 'openrouter', 'Default', 'sk-or-v1-plaintext-legacy-key-9876', 'sk-o…9876');
SQL
  fi
  # Migrations that need Supabase-only schemas (storage) are skipped; they don't touch credentials.
  if grep -q "storage\.buckets" "$f"; then continue; fi
  psql -q -v ON_ERROR_STOP=1 "$URL" -f "$f" >/dev/null
done
psql -q -v ON_ERROR_STOP=1 "$URL" -f supabase/tests/provider_keys_vault.test.sql
