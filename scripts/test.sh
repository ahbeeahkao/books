#!/usr/bin/env bash
set -o pipefail
export IS_TEST=true

if [ "$#" -gt 0 ]; then
  specs=("$@")
else
  mapfile -t specs < <(
    find . -path ./node_modules -prune -o -name '*.spec.ts' -print | sort
  )
fi

./scripts/runner.sh ./node_modules/.bin/tape "${specs[@]}" | ./node_modules/.bin/tap-spec
