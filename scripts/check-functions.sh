#!/usr/bin/env bash
# Type-check every Supabase Edge Function with Deno (each from its own directory so a
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
exit $status
