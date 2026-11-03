# Stabilization pass 1

**Date:** 2026-11-04  
**Branch:** `arena/a27de3bc-books`  
**Original baseline:** `stabilization-baseline` at `8a4ae666b7805c641d66af53feeab16e00d23c9a`  
**Checkpoint tag:** `stabilization-pass-1`

This is the pre-enhancement stabilization checkpoint for the archived Electron/Vue/SQLite Books fork. It is intentionally **not** a claim that every upstream P0/P1 issue is closed: only reproducible/code-confirmed blockers were fixed in this pass. FTS search index and scheduled jobs remain out of the enhancement scope, and no UI redesign was introduced.

## Scope decisions

- Stabilization comes before Phase 1 enhancement.
- Fork Issues are enabled and labels were created, but issue creation is currently blocked by the Arena GitHub App token (see below).
- Electron / packaging upgrade (`#1516`) is separate hardening and does not gate schema work.
- Remaining P0 DB-open/restore bugs and P1 accounting/inventory bugs need sample company `.db` files or concrete reproduction data.
- FTS search index and scheduled jobs are excluded; existing `src/utils/search.ts`, `main/initSheduler.ts`, and `jobs/` behavior is unchanged.
- No new visual design: status filtering remains an internal list-view behavior and preserves the existing look.

## Toolchain and baseline checks

Local environment: Node `v22.22.3`, Yarn `1.22.22`; README expects Node `20.18.1`. `yarn install` failed on the sandbox TLS handshake, so verification used `npm install --ignore-scripts --no-package-lock --legacy-peer-deps` with the sandbox certificate workaround. `better-sqlite3` was rebuilt locally against the Node ABI with npm's `node-gyp` because Electron's binary was not downloaded. `node_modules` and `dist_electron` are git-ignored.

Verification commands used in this pass:

```bash
# Full tape suite, bypassing scripts/runner.sh (which needs Electron's node + zsh)
IS_TEST=true \
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
TS_NODE_TRANSPILE_ONLY=true \
node -r ts-node/register -r tsconfig-paths/register \
  ./node_modules/.bin/tape <all 25 *.spec.ts> | ./node_modules/.bin/tap-spec

npx eslint . --ext ts,vue
npx vue-tsc --noEmit
node build/scripts/build.mjs --nopackage
```

Results:

- Full suite: **955 / 955 passing** across 25 spec files.
- ESLint: **0 errors**, 109 pre-existing Prettier warnings. The changed TS files are Prettier-clean; `List.vue` retains three pre-existing template-format warnings.
- Build: `--nopackage` passed; Vite emitted only pre-existing dynamic-import / chunk-size warnings.
- Typecheck: the missing `@types/webpack-env` devDependency was added to `package.json` and `yarn.lock`, and `yarn.lock` parses successfully. `vue-tsc --noEmit` still reports **19 pre-existing errors in files untouched by this pass** (upstream #1444 toolchain drift). None of the new/changed files appear in the error list.

Pre-existing typecheck errors, retained for the next baseline-hardening pass:

```text
fyo/model/doc.ts(91,12): TS2352
main/registerIpcMainActionListeners.ts(257,39): TS2345
reports/ProfitAndLoss/ProfitAndLoss.ts(84,8): TS18048
src/components/Controls/AttachImage.vue(132,31): TS2538
src/components/Dropdown.vue(193,24): TS2554
src/components/DropdownWithActions.vue(55,7): TS2322
src/components/Icon.vue(2,4): TS2345
src/components/POS/Classic/SelectedItemRow.vue(270,9): TS2322
src/components/POS/Modern/ModernPOSSelectedItemRow.vue(228,11): TS2322
src/pages/Dashboard/Expenses.vue(32,9): TS2322
src/pages/Desk.vue(48,21): TS18047
src/pages/Desk.vue(48,21): TS2365
src/pages/Desk.vue(48,46): TS18047
src/pages/TemplateBuilder/SetType.vue(41,23): TS2722
src/pages/TemplateBuilder/SetType.vue(41,23): TS18048
src/pages/TemplateBuilder/SetType.vue(43,12): TS2304
src/pages/TemplateBuilder/SetType.vue(46,29): TS2551
src/renderer.ts(36,14): TS2339
src/utils/db.ts(34,7): TS2322
```

## Fixes in this pass

### P0: computed `status` filter leaked into SQL (upstream #1446)

Confirmed code-level root cause: `src/pages/ListView/List.vue` stripped the computed `status` filter only for `like`; `not like` reached `DatabaseCore.getAll` and produced `no such column: status`.

Changes:

- `src/utils/statusFilters.ts`: pure helpers to split computed-status conditions from SQL filters, parse all operators, and apply them client-side (`=`, `!=`, `like`, `not like`, `in`, `not in`, `is null`, `is not null`, comparisons, SQL-like `%` / `_` wildcards).
- `src/pages/ListView/List.vue`: all computed-status operators are removed before the DB query; statuses are resolved from each fetched row via `getDocStatus` rather than the partially populated `statusMap`; unrelated filters are preserved.
- `tests/testStatusFilter.spec.ts`: 24 assertions covering `not like`, substring matching, multiple conditions, empty values, unsupported operators, and wildcards.

### P0: foreign-key failures during schema migration (upstream #1536 / #1351 / #1291)

Code-level hypothesis confirmed by a new regression test: removing columns with `PRAGMA foreign_keys=ON` used `knex.schema.table(...dropColumns...)`, which can break the schema. The existing safe rebuild helper was only used when adding foreign keys.

Changes:

- `backend/database/core.ts`: removed `#dropColumns` and `#addForeignKeys`; `#alterTable` now rebuilds the table via `prestigeTheTable` whenever columns are removed or foreign keys are added. `prestigeTheTable` disables FK enforcement around the rebuild, filters copied rows to the current schema, fills schema defaults for new columns, restores FK enforcement in `finally`, and runs `PRAGMA foreign_key_check` afterwards.
- `backend/database/tests/testMigration.spec.ts`: creates a parent row plus a dependent invoice, removes a parent column, migrates, and asserts no throw, preserved data, dropped column, preserved dependent row, and restored FK enforcement.

### P0 baseline: missing type package (partial #1444)

Added `@types/webpack-env@^1.18.8` to `package.json` and `yarn.lock`. This removes the immediate `TS2688` failure; the 19 pre-existing project type errors above remain.

## Fork issue tracking

Issues are enabled on `ahbeeahkao/books`. Labels `P0`, `P1`, `upstream`, `stabilization`, and `triage` were created successfully. However, **issue creation is blocked**: both `gh issue create` (GraphQL) and `gh api POST /repos/.../issues` (REST) return:

```text
403 Resource not accessible by integration
X-Accepted-Github-Permissions: issues=write
```

The current Arena GitHub App installation token has `admin`/`push`/`triage` on the repo but not `issues=write`. Reconnect GitHub in Arena or grant Issues write permission, then create the following six tracking issues. `gh issue list --repo ahbeeahkao/books --state all` currently returns `[]`.

| Title                                                                | Labels                                   | Upstream references                           | Status                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Stabilization baseline: triage upstream bugs before enhancement      | `stabilization`, `triage`                | umbrella                                      | Triage done; local tracking here                                                       |
| P0: foreign key constraint failed while opening/restoring company DB | `bug`, `P0`, `upstream`, `stabilization` | #1536, #1351, #1291                           | Likely root cause fixed + regression test; real broken `.db` reproduction still needed |
| P0: database file unavailable while writing SingleValue openCount    | `bug`, `P0`, `upstream`, `triage`        | #1546                                         | Not reproduced                                                                         |
| P0: computed status filter leaks into SQL (no such column: status)   | `bug`, `P0`, `upstream`, `stabilization` | #1446                                         | Fixed + regression test                                                                |
| P0: developer/release baseline before schema work                    | `bug`, `P0`, `upstream`, `triage`        | #1444, #1515, #1513; #1516 separate           | Partial: devDependency fixed; typecheck drift, release, ARM64 packaging remain         |
| P1: accounting and inventory correctness triage                      | `bug`, `P1`, `upstream`, `triage`        | #1538, #1539, #1540, #819, #842, #1277, #1431 | Triage only; needs reproduction data                                                   |

Issue bodies to paste after reconnect:

1. **Stabilization baseline** — umbrella for the pre-enhancement pass; baseline `8a4ae666b7805c641d66af53feeab16e00d23c9a`; reproduce P0/P1, fix confirmed blockers, tag checkpoint, then Phase 1. FTS/scheduled jobs out of scope.
2. **P0 DB foreign keys** — copy #1536 / #1351 / #1291; acceptance: older schema with removed columns and link fields migrates without FK errors, data preserved, FK enforcement restored, regression test added.
3. **P0 DB file unavailable** — copy #1546; acceptance: reproduce against `0.37.0-dev`, clear error/recovery path, no silent data loss, regression test where feasible.
4. **P0 status filter** — copy #1446; acceptance: all computed-status operators are client-side, no SQL references `status`, regression test added.
5. **P0 developer/release baseline** — copy #1444 / #1515 / #1513, keep #1516 separate; acceptance: documented toolchain, reproducible test/lint/typecheck commands, fork version policy, packaging verification.
6. **P1 accounting/inventory** — copy #1538 / #1539 / #1540 / #819 / #842 / #1277 / #1431; each must be reproduced before a fix; confirmed fixes require regression tests.

## Remaining before Phase 1 enhancement

1. Reconnect GitHub with `issues=write` and create the six tracking issues above.
2. Obtain a sample broken company `.db` to reproduce #1536 / #1546 / #1351 / #1291 end-to-end.
3. Obtain concrete accounting/inventory data to reproduce the P1 list before changing tax or stock logic.
4. Resolve the 19 pre-existing typecheck errors and decide the fork version/release policy (#1515) and ARM64 packaging check (#1513).
5. Keep Electron 22 upgrade (#1516) as separate platform hardening.
6. Then begin Phase 1: multi-barcode/Item Barcode child table, `itemWeightDigits`, UOM parity, POS stock validator, and custom-form storage decision — following the existing native desktop style and minimizing clicks.
