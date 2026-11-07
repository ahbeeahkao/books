#!/usr/bin/env bash
set -o pipefail
export IS_TEST=true

if [ "$#" -gt 0 ]; then
  ./scripts/runner.sh ./node_modules/.bin/tape "$@" | ./node_modules/.bin/tap-spec
else
  find . -path ./node_modules -prune -o -name '*.spec.ts' -print0 |
    xargs -0 ./scripts/runner.sh ./node_modules/.bin/tape |
    ./node_modules/.bin/tap-spec
fi
