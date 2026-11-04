# Stabilization passes 1–2

**Date:** 2026-11-04  
**Branch:** `arena/a27de3bc-books`  
**Original baseline:** `stabilization-baseline` at `8a4ae666b7805c641d66af53feeab16e00d23c9a`  
**Checkpoint tags:** `stabilization-pass-1` (commit `69d9616`), `stabilization-pass-2` (this pass)

This is the pre-enhancement stabilization checkpoint for the archived Electron/Vue/SQLite Books fork. It is intentionally **not** a claim that every upstream P0/P1 issue is closed: only reproducible/code-confirmed blockers were fixed in these passes. FTS search index and scheduled jobs remain out of the enhancement scope, and no UI redesign was introduced.

## Scope decisions

- Stabilization comes before Phase 1 enhancement.
- Fork Issues are enabled and labels were created, but issue creation is currently blocked by the Arena GitHub App token (see below).
- Electron / packaging upgrade (`#1516`) is separate hardening and does not gate schema work.
- Remaining P0 DB-open/restore bugs and P1 accounting/inventory bugs need sample company `.db` files or concrete reproduction data.
- FTS search index and scheduled jobs are excluded; existing `src/utils/search.ts`, `main/initSheduler.ts`, and `jobs/` behavior is unchanged.
- No new visual design: status filtering remains an internal list-view behavior and preserves the existing look.

## Toolchain and baseline checks

Local environment: Node `v22.22.3`, Yarn `1.22.22`, npm `10.9.8`; README expects Node `20.18.1`. `yarn install --frozen-lockfile` repeatedly failed on the sandbox TLS handshake, so pass-2 verification used a **locked, exact-spec npm install** derived from `yarn.lock`: 61 direct specs plus their transitive tree, pinned to the same top-level versions (`typescript@4.6.2`, `vue@3.2.40`, `vue-tsc@1.6.5`, `@types/webpack-env@1.18.8`, `vue-router@4.0.12`). No `package-lock.json` was created. `yarn.lock` still parses to 1008 entries.

`better-sqlite3@9.3.0` from the locked tree does **not** compile against Node 22.22.3 headers (V8 `AccessControl` / `PropertyAttribute` mismatch). For local verification only, `better-sqlite3@9.6.0` was installed with `--no-save --no-package-lock --ignore-scripts` and rebuilt with npm's bundled `node-gyp` against `/tmp/node-headers`; the repository dependency range was **not** changed. The direct-Node test runner also used local-only `global-jsdom@9.2.0` / `jsdom@23.2.0`, a `.vue` require stub, and a minimal `ipc.store` stub because Electron's binary is not downloaded and `scripts/runner.sh` needs zsh + Electron Node. `node_modules` and `dist_electron` are git-ignored.

Verification commands used in pass 2:

```bash
# Full tape suite, bypassing scripts/runner.sh (which needs Electron's node + zsh).
# /tmp/test-setup.js installs jsdom globals, stubs .vue imports, and stubs global.ipc.store.
mapfile -t specs < <(find . -path ./node_modules -prune -o -name '*.spec.ts' -print | sort)
IS_TEST=true TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' TS_NODE_TRANSPILE_ONLY=true \
  node -r /tmp/test-setup.js -r ts-node/register -r tsconfig-paths/register \
    ./node_modules/.bin/tape "${specs[@]}" | ./node_modules/.bin/tap-spec

npx eslint . --ext ts,vue
npx vue-tsc --noEmit --pretty false
npx prettier --check <changed files>
node build/scripts/build.mjs --nopackage
```

Results:

- Full suite: **965 / 965 passing** across 26 spec files (955 pass-1 assertions plus 10 new pass-2 assertions).
- ESLint: **0 errors, 0 warnings** with the locked toolchain and current `.eslintrc.js` ignore patterns. All changed files are Prettier-clean.
- Typecheck: **0 errors**. The pass-1 19-error list below is resolved; the earlier 3-error result from an unlocked `npx vue-tsc@6.0.3` was stale.
- Build: `--nopackage` passed; Vite emitted only pre-existing dynamic-import / chunk-size warnings.
- `git status`: only the pass-2 source/test files below are modified or untracked; pass-1 artifacts are already tracked in `69d9616`.

## Fixes in pass 1

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

Added `@types/webpack-env@^1.18.8` to `package.json` and `yarn.lock`. This removed the immediate `TS2688` failure; pass 2 resolved the remaining project type errors.

## Fixes in pass 2: toolchain/type baseline (closes #1444 drift)

With the locked TypeScript 4.6.2 / vue-tsc 1.6.5 toolchain, the first full `vue-tsc --noEmit` produced 24 errors (not the 19 listed in pass 1, which came from a different install). All are now fixed:

- `main/registerIpcMainActionListeners.ts`: cast the `node-fetch` request options to `RequestInit` instead of passing a narrowed inline object.
- `reports/ProfitAndLoss/ProfitAndLoss.ts`: replaced the impossible `!expenseRoots && !expenseRoots.length` guard with `!expenseRoots || !expenseRoots.length`; corrected the expense-only total label from `Total Income (Credit)` to `Total Expense (Debit)`.
- `src/components/Controls/AttachImage.vue`: guard a missing extension and lowercase the fallback before building the upload path.
- `src/components/Controls/Currency.vue`: declare the inherited `change` event in `emits` so the template can type it.
- `src/components/Dropdown.vue`: cast the dynamic component and `item.action` at the template boundary instead of forcing `never`-typed props.
- `src/components/PageHeader.vue`: move `border-none` off `<Transition>` onto the inner bordered elements.
- `src/pages/POS/KeyboardModal.vue`: replace the untyped `<component :is>` with explicit `Currency` / `Float` controls, add typed `field`, `isCurrencyField`, and `controlDf` computed helpers, guard `selectedItemRow`, and reuse `FieldTypeEnum` instead of `ModelNameEnum` for field types.
- `src/pages/POS/POS.vue`: cast the dynamic `itemVisibilityValue` lookup.
- `src/pages/TemplateBuilder/SetType.vue`: import `fyo` / `SelectOption`, narrow the static option list, and guard the optional `fyo` value.
- `src/utils/types.ts`: widen `DropdownItem.action` and `DropdownItem.component` to the types actually used by Vue templates.
- `src/utils/db.ts`: give `getDbErrorActionSymbol` an explicit `Symbol` return type.
- `reports/ProfitAndLoss/tests/testProfitAndLoss.spec.ts`: 5 new assertions covering income-only, expense-only, empty-root, combined-root, and missing-root P&L branch selection, including the corrected expense total label.

These are type-safety and correctness fixes, not a visual redesign. FTS/scheduled jobs remain untouched.

## Fork issue tracking

Issues are enabled on `ahbeeahkao/books`. Labels `P0`, `P1`, `upstream`, `stabilization`, and `triage` exist. Issue creation is **still blocked** after a pass-2 re-probe: `gh api repos/... -q '.permissions'` reports `admin/maintain/pull/push/triage` but no `issues=write`; both `gh issue create` (GraphQL) and `gh api POST /repos/.../issues` (REST) return:

```text
403 Resource not accessible by integration
X-Accepted-Github-Permissions: issues=write
```

`gh issue list --repo ahbeeahkao/books --state all` remains `[]`. Reconnect GitHub in Arena or grant Issues write permission, then create the following six tracking issues.

| Title                                                                | Labels                                   | Upstream references                           | Status                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Stabilization baseline: triage upstream bugs before enhancement      | `stabilization`, `triage`                | umbrella                                      | Triage done; local tracking here                                                       |
| P0: foreign key constraint failed while opening/restoring company DB | `bug`, `P0`, `upstream`, `stabilization` | #1536, #1351, #1291                           | Likely root cause fixed + regression test; real broken `.db` reproduction still needed |
| P0: database file unavailable while writing SingleValue openCount    | `bug`, `P0`, `upstream`, `triage`        | #1546                                         | Not reproduced                                                                         |
| P0: computed status filter leaks into SQL (no such column: status)   | `bug`, `P0`, `upstream`, `stabilization` | #1446                                         | Fixed + regression test                                                                |
| P0: developer/release baseline before schema work                    | `bug`, `P0`, `upstream`, `triage`        | #1444, #1515, #1513; #1516 separate           | Type baseline fixed; release, ARM64 packaging remain                                   |
| P1: accounting and inventory correctness triage                      | `bug`, `P1`, `upstream`, `triage`        | #1538, #1539, #1540, #819, #842, #1277, #1431 | Triage only; needs reproduction data                                                   |

Issue bodies to paste after reconnect:

1. **Stabilization baseline** — umbrella for the pre-enhancement pass; baseline `8a4ae666b7805c641d66af53feeab16e00d23c9a`; reproduce P0/P1, fix confirmed blockers, tag checkpoint, then Phase 1. FTS/scheduled jobs out of scope.
2. **P0 DB foreign keys** — copy #1536 / #1351 / #1291; acceptance: older schema with removed columns and link fields migrates without FK errors, data preserved, FK enforcement restored, regression test added.
3. **P0 DB file unavailable** — copy #1546; acceptance: reproduce against `0.37.0-dev`, clear error/recovery path, no silent data loss, regression test where feasible.
4. **P0 status filter** — copy #1446; acceptance: all computed-status operators are client-side, no SQL references `status`, regression test added.
5. **P0 developer/release baseline** — copy #1444 / #1515 / #1513, keep #1516 separate; acceptance: documented toolchain, reproducible test/lint/typecheck commands, fork version policy, packaging verification. Type baseline is now clean; release policy and ARM64 packaging remain.
6. **P1 accounting/inventory** — copy #1538 / #1539 / #1540 / #819 / #842 / #1277 / #1431; each must be reproduced before a fix; confirmed fixes require regression tests.

## Remaining before Phase 1 enhancement

1. Reconnect GitHub with `issues=write` and create the six tracking issues above.
2. Obtain a sample broken company `.db` to reproduce #1536 / #1546 / #1351 / #1291 end-to-end.
3. Obtain concrete accounting/inventory data to reproduce the P1 list before changing tax or stock logic.
4. Decide the fork version/release policy (#1515) and verify ARM64 packaging (#1513).
5. Keep Electron 22 upgrade (#1516) as separate platform hardening.
6. Then begin Phase 1: multi-barcode/Item Barcode child table, `itemWeightDigits`, UOM parity, POS stock validator, and custom-form storage decision — following the existing native desktop style and minimizing clicks.
