#!/usr/bin/env bash
# Type-check (and run the Deno tests of) every Supabase Edge Function with Deno (each from its own directory so a
# per-function deno.json import map, e.g. supabase/functions/mcp/deno.json, is honoured).
set -euo pipefail
cd "$(dirname "$0")/../supabase/functions"
status=0
for dir in */; do
  fn="${dir%/}"
  [[ "$fn" == _* || ! -f "$fn/index.ts" ]] && continue
  if (cd "$fn" && deno check --no-lock --quiet index.ts); then
    echo "ok   $fn"
  else
    echo "FAIL $fn"; status=1
  fi
done
# Function-level tests (Deno), e.g. supabase/functions/mcp/app.test.ts.
for t in */*.test.ts; do
  [[ -e "$t" ]] || continue
  if (cd "$(dirname "$t")" && deno test --no-lock --quiet "$(basename "$t")" >/dev/null 2>&1); then
    echo "ok   test $t"
  else
    echo "FAIL test $t (run: cd supabase/functions/$(dirname "$t") && deno test --no-lock $(basename "$t"))"; status=1
  fi
done
exit $status
