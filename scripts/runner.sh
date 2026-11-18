#!/usr/bin/env bash
# Electron's Node keeps native modules on the same ABI as the desktop app.
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'
export TS_NODE_TRANSPILE_ONLY=true
export ELECTRON_RUN_AS_NODE=true

exec ./node_modules/.bin/electron \
  --require ./scripts/testSetup.js \
  --require ts-node/register \
  --require tsconfig-paths/register \
  "$@"
