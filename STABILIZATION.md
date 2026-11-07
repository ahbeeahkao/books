# Stabilization passes 1–3

**Date:** 2026-11-04
**Branch:** `arena/a27de3bc-books`
**Original baseline:** `stabilization-baseline` at `8a4ae666b7805c641d66af53feeab16e00d23c9a`
**Checkpoint tags:** `stabilization-pass-1` (`69d9616`), `stabilization-pass-2` (`55b88df`), `stabilization-pass-3` (this pass)

This is the pre-enhancement stabilization checkpoint for the archived Electron/Vue/SQLite Books fork. It is intentionally **not** a claim that every upstream P0/P1 issue is closed: only reproducible/code-confirmed blockers were fixed in these passes. Pass 3 adds synthetic broken-DB reproduction, which is **not** a real user `.db`. The Phase 1 design/impact note lives in `PHASE1_DESIGN.md`; the detailed upstream critical-issue backlog now lives in `UPSTREAM_CRITICAL_ISSUES.md`. FTS search index and scheduled jobs remain out of the enhancement scope, and no UI redesign was introduced.

## Scope decisions

- Stabilization comes before Phase 1 enhancement.
- Fork Issues are enabled and labels were created, but issue creation is currently blocked by the Arena GitHub App token (see below).
- Electron / packaging upgrade (`#1516`) is separate hardening and does not gate schema work.
- Pass 3 added synthetic broken-DB coverage for the P0 DB-open/migration path; a real user `.db` is still needed only to confirm the exact upstream reports. P1 accounting/inventory bugs still need concrete transaction data.
- FTS search index and scheduled jobs are excluded; existing `src/utils/search.ts`, `main/initSheduler.ts`, and `jobs/` behavior is unchanged.
- No new visual design: status filtering remains an internal list-view behavior and preserves the existing look.
- Phase 1 design was deferred in pass 3 while synthetic broken-DB hardening was completed. The four scope-decision questions have since been confirmed with their recommended defaults; see `PHASE1_DESIGN.md`.

## Confirmed Phase 1 scope decisions

The four decisions that were skipped during the earlier `ask_user` prompt are now confirmed as follows:

| #   | Decision             | Confirmed value                         |
| --- | -------------------- | --------------------------------------- |
| 1   | Migration policy     | Strict automatic migration with backups |
| 2   | Company model        | One company per DB                      |
| 3   | Malaysia e-invoice   | Offline UBL first, in a later phase     |
| 4   | FTS / scheduled jobs | Out of enhancement scope                |

A fifth planning assumption about Phase 1 ordering is **not** one of the four confirmed decisions and remains unconfirmed; `PHASE1_DESIGN.md` uses it only as a proposed checkpoint sequence. Full rationale, file-by-file impact, migration strategy, acceptance criteria, and implementation checkpoints are in `PHASE1_DESIGN.md`.

## Toolchain and baseline checks

Local environment: Node `v22.22.3`, Yarn `1.22.22`, npm `10.9.8`; README expects Node `20.18.1`. `yarn install --frozen-lockfile` repeatedly failed on the sandbox TLS handshake, so pass-2 verification used a **locked, exact-spec npm install** derived from `yarn.lock`: 61 direct specs plus their transitive tree, pinned to the same top-level versions (`typescript@4.6.2`, `vue@3.2.40`, `vue-tsc@1.6.5`, `@types/webpack-env@1.18.8`, `vue-router@4.0.12`). No `package-lock.json` was created. `yarn.lock` still parses to 1008 entries.

`better-sqlite3@9.3.0` from the original locked tree did **not** compile against Node 22 headers (V8 `AccessControl` / `PropertyAttribute` mismatch). The historical local-only verification used `better-sqlite3@9.6.0`; the fork manifest has since been upgraded to `better-sqlite3@13.0.3` after the same incompatibility failed in GitHub Actions. The direct-Node test runner also used local-only `global-jsdom@9.2.0` / `jsdom@23.2.0`, a `.vue` require stub, and a minimal `ipc.store` stub because Electron's binary is not downloaded and `scripts/runner.sh` needs zsh + Electron Node. `node_modules` and `dist_electron` are git-ignored.

Verification commands used in passes 2–3:

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

Pass 2 results:

- Full suite: **965 / 965 passing** across 26 spec files (955 pass-1 assertions plus 10 new pass-2 assertions).
- ESLint: **0 errors, 0 warnings** with the locked toolchain and current `.eslintrc.js` ignore patterns. All changed files are Prettier-clean.
- Typecheck: **0 errors**. The pass-1 19-error list below is resolved; the earlier 3-error result from an unlocked `npx vue-tsc@6.0.3` was stale.
- Build: `--nopackage` passed; Vite emitted only pre-existing dynamic-import / chunk-size warnings.

Pass 3 results:

- Full suite: **1024 / 1024 passing** across 27 spec files (59 new synthetic broken-DB assertions).
- Targeted new spec alone: **59 / 59 passing**.
- ESLint: **0 errors, 0 warnings**.
- Typecheck: **0 errors**.
- Prettier check on all changed files: clean.
- Build: `--nopackage` passed; Vite emitted only pre-existing dynamic-import / chunk-size warnings.
- `git status`: only the pass-3 source/test/doc files below are modified or untracked; pass-1 and pass-2 artifacts are already pushed.

Phase 1 CP1 results (the first proposed checkpoint; checkpoint order is not separately confirmed):

- `POSSettings.json` now persists `itemWeightDigits`. `DatabaseCore.migrate()` backfills the `0` default for existing `POSSettings` singles, and `DatabaseManager.#executeMigration()` still creates the backup. No versioned patch was added because no data transform is needed.
- `src/utils/barcodes.ts` centralizes settings, weight parsing, quantity conversion, and scan resolution. `Barcode.vue` / `WeightEnabledBarcode.vue`, `CommonForm.vue`, and `POS.vue` now share one parser and forward `(name, quantity)` through `addItem`.
- Incomplete weight settings produce a translated configuration toast only when an unrecognized scan cannot be resolved; valid plain and legacy 12-digit barcodes still resolve. No Item Barcode child table, UOM work, FTS, or scheduled jobs are included in CP1.
- Full suite: **1062 / 1062 passing** across 28 spec files; targeted CP1 migration/barcode specs: **43 / 43 passing**.
- ESLint: **0 errors, 0 warnings**; typecheck: **0 errors**; Prettier 2.4.1 on changed files: clean; build `--nopackage`: passed with only pre-existing Vite warnings.
- Pass-3 broken-DB coverage remains synthetic; the upstream P0 database reports are not claimed fixed end-to-end by CP1.

Phase 1 CP2 results (the second proposed checkpoint; checkpoint order is not separately confirmed):

- `ItemBarcode.json` adds an inline child table with `barcode`, `barcodeType`, and optional `uom`; `Item.json` gains `barcodes` while the legacy `Item.barcode` column is preserved. `Item.ts` hides the child table unless barcodes are enabled and rejects blank, repeated, and cross-item duplicate barcodes with translatable errors.
- `src/utils/barcodes.ts` resolves scans against `ItemBarcode` first, then legacy `Item.barcode`, `itemCode`, and `name`; `MultiLabelLink.vue` includes child barcodes in the existing POS dropdown via `fyo.db.getAll`. No FTS, scheduled jobs, sidebar entry, separate manager, or extra clicks were added.
- `backfillItemBarcodes` is a post-migration `0.38.0` patch above the current `0.37.0` app version. Under the confirmed strict automatic migration with backups policy, `DatabaseCore.migrate()` creates the child table, `DatabaseManager.#executeMigration()` retains the backup path, and the patch records `PatchRun`; a regression test asserts a successful, idempotent backfill and preserved legacy data.
- Full suite: **1099 / 1099 passing** across 29 spec files; targeted CP1/CP2 migration/barcode specs: **79 / 79 passing**.
- ESLint: **0 errors, 0 warnings**; typecheck: **0 errors**; Prettier 2.4.1 on changed files: clean; build `--nopackage`: passed with only pre-existing Vite warnings.
- CP3–CP5, FTS/scheduled jobs, and the upstream real broken-`.db` P0 reports remain untouched; pass-3 synthetic coverage is still not a real-user reproduction.

Phase 1 CP3 results (the third proposed checkpoint; checkpoint order is not separately confirmed):

- `src/utils/uom.ts` centralizes whole-number UOM flags and ERPNext `must_be_whole_number` mapping, positive/unique conversion validation, conversion-factor maps, the legacy `Kg` / `Gram` weight factors, whole-number quantity errors, feature-switch config, and shared assertions for both stock and transfer units. `UOM.json` keeps the `name` primary key and adds a hidden, read-only, computed `mustBeWholeNumber` parity alias; `models/baseModels/UOM/UOM.ts` derives it from `isWhole` and `models/index.ts` registers the model.
- `UOMConversionItem.json` documents the positive-factor and one-row-per-UOM rules. `Item.json` documents the feature gate and replaces the invalid quick-edit `uom` field with `uomConversions`. `Item.ts` removes the old `beforeSync()` de-duplication/drop behaviour, rejects disabled-feature, blank, duplicate, and nonpositive conversion rows, adds the `RequiredMap`, and hides/requires `unit` and `uomConversions` according to `InventorySettings.enableUomConversions`.
- `InvoiceItem`, `StockMovementItem`, and `StockTransferItem` no longer silently round fractional quantities in their quantity formulas. Their `quantity` and `transferQuantity` validations use the shared whole-number assertions, so both stock-UOM and transfer-UOM quantities are rejected instead of being coerced. `src/utils/pos.ts` applies the same checks in the POS sales-invoice validator. `src/utils/erpnextSync.ts` maps imported whole-number flags and validates conversion rows with the shared parity rules.
- `src/utils/barcodes.ts` queries optional `UOM` / `UOMConversionItem` rows, resolves child-barcode and override UOM factors, and uses the shared whole-number and weight helpers. `Barcode.vue`, `WeightEnabledBarcode.vue`, and `CommonForm.vue` pass a form-level `unit` / `configuredUnit`; no `POSSettings` UOM field, visual redesign, new UOM manager, or sidebar root was added. Legacy `Kg` / `Gram` barcode quantities are preserved.
- `tests/testUomParity.spec.ts` adds 68 assertions covering schema parity, the computed UOM alias, conversion validation, feature-gated hidden/required maps, `Item.validate()`, fractional stock and transfer quantities, transaction-row validators, configured weight UOMs, and scan resolution with UOM/conversion rows.
- Full suite: **1167 / 1167 passing** across 30 spec files; combined targeted CP1/CP2/CP3 migration, barcode, and UOM specs: **147 / 147 passing**.
- ESLint: **0 errors, 0 warnings**; typecheck: **0 errors**; Prettier 2.4.1 on changed files: clean; build `--nopackage`: passed with only pre-existing Vite warnings.
- FTS/scheduled jobs and the upstream real broken-`.db` P0 reports remain untouched; pass-3 synthetic coverage is still not a real-user reproduction.

Phase 1 CP4 results (the fourth checkpoint; the user confirmed `CP4 then CP5, then create PR`):

- `src/utils/posStock.ts` adds one pure, location-aware validator: `getAvailableQty()` reads total or batch stock from the existing `ItemQtyMap`; `validateAddItemQty()` and `validateInvoiceQty()` share one over-quantity rule and one canonical error message. It does not query stock directly.
- `POS.vue.addItem()` and batch selection now call the shared validator. Duplicate `availableQty <= 0`, `currentQty + addQty > availableQty`, and direct `fyo.db.getStockQuantity()` branches were removed. `setItems()` uses `getAvailableQty()` while `hideUnavailableItems` remains a UI filter only.
- `models/helpers.validateQty()` and `src/utils/pos.validateSinv()` delegate to the shared validator. Final validation now aggregates repeated item/batch rows, respects batch-specific stock, bypasses return invoices and non-inventory items, and preserves the CP3 whole-number quantity assertions.
- `tests/testPosStockValidator.spec.ts` adds 26 assertions covering total/batch availability, zero stock, over-quantity add-item and final validation, batch splits, return and non-inventory bypasses, free items, invalid quantities, and weight-barcode quantities.
- Full suite: **1193 / 1193 passing** across 31 spec files; targeted CP4 spec: **26 / 26 passing**.
- ESLint: **0 errors, 0 warnings**; typecheck: **0 errors**; Prettier 2.4.1 on changed files: clean; build `--nopackage`: passed with only pre-existing Vite warnings.
- FTS/scheduled jobs and the upstream real broken-`.db` P0 reports remain untouched; pass-3 synthetic coverage is still not a real-user reproduction.

Phase 1 CP5 results (the fifth checkpoint; the user confirmed `CP4 then CP5, then create PR`):

- The decision is **keep custom fields/forms stored per company DB**. `CustomField` rows remain data read by `DatabaseManager.setRawCustomFields()` and merged by `getSchemas()`; they are not promoted into static `schemas/app/*.json` files and no storage migration was added.
- `src/utils/customForm.ts` centralizes customizable-schema exclusions. `CustomizeForm.vue`, `CustomField.ts`, and `CustomForm.ts` now share it, excluding `isSingle` / `isChild` schemas plus `ItemBarcode`, `CustomField`, `CustomForm`, `NumberSeries`, `PatchRun`, `SingleValue`, and `SetupWizard`.
- `backend/database/tests/testCustomFieldsMigration.spec.ts` adds 17 assertions. A `CustomField` row survives `DatabaseManager.connectToDatabase()` and `db.migrate()`, is loaded into `rawCustomFields` and `getSchemaMap()`, is marked `isCustom`, and is absent from the static schema map. Backup creation remains skipped under `IS_TEST`; the migration/backfill path is still exercised.
- `PHASE1_DESIGN.md` now records the confirmed CP4/CP5/PR order, the CP5 decision status, and the implemented file list.
- Full suite: **1210 / 1210 passing** across 32 spec files; targeted CP5 spec: **17 / 17 passing**.
- ESLint: **0 errors, 0 warnings**; typecheck: **0 errors**; Prettier 2.4.1 on changed files: clean; build `--nopackage`: passed with only pre-existing Vite warnings.
- CP1–CP5 are complete. FTS/scheduled jobs and the upstream real broken-`.db` P0 reports remain untouched; pass-3 synthetic coverage is still not a real-user reproduction. A PR is created as the final step.

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

## Fixes in pass 3: synthetic broken-DB reproduction

The user selected synthetic broken-DB hardening before Phase 1 design. These tests write small SQLite files with deliberately older/corrupt schema shapes, then run the same `DatabaseCore.migrate()` path the app uses. They are **synthetic reproductions**, not real user `.db` files, and do not close the upstream reports by themselves.

### Real bug found and fixed

`prestigeTheTable` copied legacy rows into a temp table built from the current schema. If a legacy row was missing a column that the current schema marks as required and has no default, the rebuild failed with `NOT NULL constraint failed` (reproduced with a legacy `SingleValue` table lacking `value`).

Changes:

- `backend/database/core.ts`: added `#getMissingFieldFallback(field)`. `prestigeTheTable` now prefers `field.default`, then a type-safe fallback for required fields (`0` for numeric/Currency, `false` for Check, current ISO string for Datetime, `''` for Data/Link/etc.), and still leaves optional missing fields undefined. This prevents a rebuild from silently dropping the row or crashing on a required-column copy.
- `backend/database/tests/helpers.ts`: `getBuiltTestSchemaMap(includeMisc = false)` can now include the real `Misc` Single schema so `openCount` can be exercised.

### New regression suite

`backend/database/tests/testSyntheticBrokenDatabases.spec.ts` adds 6 tests / 59 assertions:

1. Legacy `Customer` / `SalesInvoice` tables with extra columns and enforced FKs: migration drops the legacy columns, preserves parent, invoice, and child rows, restores FK enforcement, leaves no `__*` temp tables, and passes `foreign_key_check` / `integrity_check`.
2. Legacy `SalesInvoice` without a `customer` foreign key: migration detects the new Link FK, rebuilds, adds the FK, preserves rows, and enforces delete restriction.
3. New required `Int` column with a default: additive `ALTER TABLE` path adds the column and populates existing rows with the default without a rebuild.
4. Missing `SingleValue` table: migration recreates it, initializes `SystemSettings` / `Misc` defaults, and `Misc.openCount` can be written and read (synthetic #1546 shape).
5. Legacy `SingleValue` table with no `value` column and an extra `legacy_note`: migration rebuilds it, drops the legacy column, fills the preserved row's required `value` with the fallback, inserts missing defaults, and still accepts `openCount` writes.
6. Legacy row missing a required Link column: migration fails loudly with `foreign key check failed after rebuilding SalesInvoice` instead of silently assigning an invalid parent, and FK enforcement is restored.

Every healthy case asserts `PRAGMA foreign_keys=ON`, empty `PRAGMA foreign_key_check`, `PRAGMA integrity_check=ok`, and no leftover temp tables.

These tests do not change FTS/scheduled jobs, do not introduce a UI redesign, and do not start Phase 1 enhancement.

## Fork issue tracking

Issues are enabled on `ahbeeahkao/books`. Labels `P0`, `P1`, `upstream`, `stabilization`, and `triage` exist. Issue creation is **still blocked** after the pass-2 re-probe; pass 3 did not retry it: `gh api repos/... -q '.permissions'` reports `admin/maintain/pull/push/triage` but no `issues=write`; both `gh issue create` (GraphQL) and `gh api POST /repos/.../issues` (REST) return:

```text
403 Resource not accessible by integration
X-Accepted-Github-Permissions: issues=write
```

`gh issue list --repo ahbeeahkao/books --state all` remains `[]`. Until `issues=write` is available, use `UPSTREAM_CRITICAL_ISSUES.md` as the detailed local tracker for critical upstream parity work. Reconnect GitHub in Arena or grant Issues write permission, then create the following six tracking issues.

| Title                                                                | Labels                                   | Upstream references                           | Status                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Stabilization baseline: triage upstream bugs before enhancement      | `stabilization`, `triage`                | umbrella                                      | Triage done; local tracking here                                                  |
| P0: foreign key constraint failed while opening/restoring company DB | `bug`, `P0`, `upstream`, `stabilization` | #1536, #1351, #1291                           | Code fix + synthetic broken-DB suite; real `.db` still needed to confirm upstream |
| P0: database file unavailable while writing SingleValue openCount    | `bug`, `P0`, `upstream`, `triage`        | #1546                                         | Synthetic missing/legacy SingleValue reproduced; real `.db` still needed          |
| P0: computed status filter leaks into SQL (no such column: status)   | `bug`, `P0`, `upstream`, `stabilization` | #1446                                         | Fixed + regression test                                                           |
| P0: developer/release baseline before schema work                    | `bug`, `P0`, `upstream`, `triage`        | #1444, #1515, #1513; #1516 separate           | Type baseline fixed; release, ARM64 packaging remain                              |
| P1: accounting and inventory correctness triage                      | `bug`, `P1`, `upstream`, `triage`        | #1538, #1539, #1540, #819, #842, #1277, #1431 | Triage only; needs reproduction data                                              |

Issue bodies to paste after reconnect:

1. **Stabilization baseline** — umbrella for the pre-enhancement pass; baseline `8a4ae666b7805c641d66af53feeab16e00d23c9a`; reproduce P0/P1, fix confirmed blockers, tag checkpoint, then Phase 1. FTS/scheduled jobs out of scope.
2. **P0 DB foreign keys** — copy #1536 / #1351 / #1291; acceptance: older schema with removed columns and link fields migrates without FK errors, data preserved, FK enforcement restored, regression test added. Pass 3 added synthetic removed-column/FK regression coverage; a real broken `.db` is still needed to confirm the upstream reports.
3. **P0 DB file unavailable** — copy #1546; acceptance: reproduce against `0.37.0-dev`, clear error/recovery path, no silent data loss, regression test where feasible. Pass 3 added synthetic missing/legacy `SingleValue` and `openCount` write coverage; a real `0.37.0-dev` DB is still needed.
4. **P0 status filter** — copy #1446; acceptance: all computed-status operators are client-side, no SQL references `status`, regression test added.
5. **P0 developer/release baseline** — copy #1444 / #1515 / #1513, keep #1516 separate; acceptance: documented toolchain, reproducible test/lint/typecheck commands, fork version policy, packaging verification. Type baseline is now clean; release policy and ARM64 packaging remain.
6. **P1 accounting/inventory** — copy #1538 / #1539 / #1540 / #819 / #842 / #1277 / #1431; each must be reproduced before a fix; confirmed fixes require regression tests.

## Remaining follow-up work

1. GitHub issue creation is still blocked by missing `issues=write`; track critical upstream parity work in `UPSTREAM_CRITICAL_ISSUES.md` and create the six tracking issues when permissions allow.
2. Optional: obtain a real broken company `.db` to confirm #1536 / #1546 / #1351 / #1291 end-to-end. Pass 3 already added synthetic reproduction; this is no longer a hard gate for Phase 1.
3. Obtain concrete accounting/inventory data to reproduce the P1 list before changing tax or stock logic.
4. Decide the fork version/release policy (#1515) and verify ARM64 packaging (#1513) with the checkpoint-3 manual CI gate.
5. Checkpoint 3 upgraded Electron to `45.2.3`; packaged Linux/ARM64 launch outputs remain the gate for #1516.
6. Scope decisions are confirmed and `PHASE1_DESIGN.md` records the CP1–CP5 decisions and outcomes.
7. CP1–CP5 are implemented and verified above, and PR #1 is merged as `f7b0f81`. Before new features, close the P0/P1 items in `UPSTREAM_CRITICAL_ISSUES.md`; no FTS/scheduled jobs, visual redesign, or extra POS click were included in the merged work.

## Pass 4 — critical upstream parity fixes (2026-11-06)

Before the later real broken-`.db`, visual redesign, new sidebar roots, and extra POS-click phases, the code-resolvable P0–P2 items from `UPSTREAM_CRITICAL_ISSUES.md` were stabilized locally:

- Added `src/utils/stabilization.ts` with UTF-8 BOM helpers, canonical export/import field keys, currency fraction/precision helpers, zero-decimal truncation, line-discount clamping, write-off ledger amounts, local-midnight date normalization, and UTC-safe fiscal date parts.
- CSV export now emits an Excel-compatible UTF-8 BOM; `parseCSV()` strips BOMs; import/export use the same `Schema.fieldname` key format.
- `Fyo#initializeMoneyMaker()` clamps display precision to the currency's minor-unit digits; invoice tax amounts are truncated for zero-decimal currencies.
- Line-item discounts are absolute amounts clamped to the line amount, not per-unit multipliers that can create negative totals.
- Payment write-off postings now settle the full receivable/payable and put the write-off on the correct debit/credit side; multi-reference validation no longer coerces an unset write-off to `0`.
- Purchase Receipt stock-in-hand posting uses net item amount, excluding GST from inventory valuation.
- Ledger posting dates are normalized to local midnight without timezone day drift; fiscal-year endpoints use stored UTC date parts.
- ERPNext sync actions no longer call `ipc.reloadWindow()`; they surface success/error toasts and log failures.
- The sidebar restore control is visible and labelled; the hide control is labelled too. This is a functional fix, not a redesign.
- Added `scripts/checkToolchain.mjs` and `npm run check:toolchain` to fail clearly on unsupported Node, missing `yarn.lock`, a stray `package-lock.json`, or drifted pinned module versions.
- Added `tests/testStabilizationPass4.spec.ts` with 30 assertions.

Verification:

- Targeted stabilization test: **30 / 30 passing**.
- Full tape suite including the new spec: **1240 / 1240 passing** across **33 spec files**.
- `vue-tsc --noEmit --pretty false`: **0 errors**.
- `eslint . --ext ts,vue`: **0 errors, 0 warnings**.
- `prettier --check` on changed files: clean.
- `npm run check:toolchain`: passed.
- `node build/scripts/build.mjs --nopackage`: exit 0 with the same pre-existing Vite dynamic-import/chunk-size warnings.
- `git diff --check`: clean.

Unresolved by design: real broken `.db` files, packaged Linux/ARM64 smoke-test outputs, release tags, packaged RPM removal verification, Flathub restoration, concrete customer-balance/COA/pricing-rule fixtures, and any visual redesign/new sidebar roots/extra POS clicks. These remain in `UPSTREAM_CRITICAL_ISSUES.md` with explicit gates.

## Later phase — checkpoint 1 (2026-11-07)

After PR #2 opened, the authorized later phase started with synthetic issue-step reproductions. Upstream attachment retrieval was attempted first; #819's `test.books.db.zip` redirects to `objects.githubusercontent.com`, which this sandbox cannot reach. The user authorized generated issue-step fixtures, explicitly labelled synthetic.

`backend/database/tests/testSyntheticIssueStepDatabases.spec.ts` creates temporary SQLite company DBs and opens them through `DatabaseManager.connectToDatabase()`:

- #1351: copied old DB with no `SalesInvoice` foreign keys and a legacy column migrates, restores the `party` FK, and preserves rows.
- #1536: dangling required Link fails loudly with `foreign key check failed`, preserving the corrupt row and leaving no migration temp table.
- #1291: newer missing columns from the post-update report are restored on all representative invoice/quote/purchase/receipt/shipment tables, with safe defaults and no FK violations.
- #1546: `Misc.openCount` fails in a non-writable DB directory and succeeds in a writable copy.
- Healthy cases assert `AccountingSettings.companyName`, no `Company` DocType, FK enforcement, `foreign_key_check`, `integrity_check`, and temp-table cleanup.

Targeted result: **48 / 48 assertions passing**; `vue-tsc --noEmit --pretty false` is clean. Evidence and limitations are in `LATER_PHASE_EVIDENCE.md`. No binary `.db` is committed. These are not real user samples; no upstream issue is closed, and the real broken-`.db` gate remains open.

## Later phase — checkpoint 2 (2026-11-07)

Synthetic reconciliation fixtures were added for #1394, #1410, #1541, #842, #1431, and #1535. `src/utils/reconciliation.ts` contains deterministic ledger reconciliation, group opening balances, pricing-rule item candidates, and root-account recreation validation helpers. `src/utils/stabilization.ts` adds a finite-number guard.

- #1394: report CSV/JSON export now reads Money-like `float` values and bounds non-finite numbers.
- #1410: General Ledger now carries forward pre-range entries as an `Opening` row and uses them in running and closing balances. Grouped reports receive group-specific opening balances.
- #1541: prior-fiscal-year date range and P&L total are reconciled against a `₹50,000` back-dated income fixture.
- #842: `StockQueue` and Stock Balance helpers reject/bound `NaN` and `±Infinity`; this is a display guard, not a rewrite of underlying stock data.
- #1431: a synthetic item/rule candidate list selects only the eligible sales item and never falls back to a wrong item.
- #1535: an explicit root group can be recreated after setup while ordinary child accounts still require a parent.

Targeted result: **29 / 29 assertions passing**. Full tape suite: **1317 / 1317 passing** across **35 spec files**. Typecheck, ESLint, Prettier, toolchain preflight, build, and diff check are clean. Evidence and limitations are in `LATER_PHASE_EVIDENCE.md`. Real customer CSVs, prior-year company DBs, large stock ledgers, pricing-rule data, and COA traces remain open gates.

## Later phase — checkpoint 3 (2026-11-07)

Platform dependencies were upgraded to Electron `45.2.3`, electron-builder `26.18.0`, `@electron/rebuild` `4.2.1`, and electron-updater `6.8.11`. Node `22.12+` is now required and active workflows use `22.14.0`. The Linux AppImage target now includes ARM64, native rebuilds are enabled, and a manual native-runner CI workflow packages x64/ARM64 artifacts, checks unpacked ELF `.node` architecture, and launches under Xvfb.

`scripts/checkNativeArchitecture.mjs` and `scripts/checkPlatformPolicy.mjs` are new static/runtime gates. `LINUX_SANDBOX.md` documents Ubuntu 24.04 user-namespace fixes and a Linux-only `BOOKS_DISABLE_CHROMIUM_SANDBOX` fallback; the main process keeps the Chromium sandbox enabled by default.

Targeted result: **11 / 11 assertions passing**. Full tape suite: **1328 / 1328 passing** across **36 spec files**. Typecheck, ESLint, Prettier, toolchain/platform preflight, source build, and diff check are clean. No packaged Electron app was launched in this sandbox; the manual CI gate remains unexecuted and no upstream platform issue is closed.

## Later phase — checkpoint 4 (2026-11-07)

`RELEASE_POLICY.md` defines `v0.37.0-fork.N` tags from `master`, forbids publishing from feature branches or upstream tags, targets the fork repository, and requires all platform builds plus native packaged smoke tests before a release. `scripts/checkReleasePolicy.mjs` enforces the static CI boundary. A guarded `deb`/`rpm` after-remove scriptlet now tolerates missing alternatives registrations, and the Flatpak/Flathub boundary is explicit: no manifest, listing restoration, or publisher verification is included.

Targeted result: **9 / 9 assertions passing**. Full tape suite: **1337 / 1337 passing** across **37 spec files**. Typecheck, ESLint, Prettier, toolchain/platform/release preflight, source build, and diff check are clean. No release tag, GitHub Release, packaged RPM removal test, or Flathub listing was created; no upstream issue is closed.

## Later phase — checkpoint 5 (2026-11-07)

Checkpoint 5 implemented the minimal native-UX boundary: an always-visible, translated `Show Sidebar` control and bounded Ctrl/Cmd keyboard/numpad zoom shortcuts. No broad redesign, new sidebar root, dependency-heavy UI, or extra POS confirmation was added. `NATIVE_UX.md`, `scripts/checkNativeUXPolicy.mjs`, and `tests/testNativeUX.spec.ts` document and guard the boundary.

Targeted result: **16 / 16 assertions passing**. Full tape suite: **1353 / 1353 passing** across **38 spec files**. Typecheck, ESLint, Prettier, toolchain/platform/release/native-UX preflight, source build, and diff check are clean. This completes all five later-phase checkpoints at source/gate level; real packaged launch/removal evidence, release tags, real customer fixtures, and upstream issue closure remain open.

## CI native-module correction (2026-11-07)

After checkpoint 5, GitHub Actions on macOS ARM64/Node `22.14.0` failed during `yarn` because the old `better-sqlite3` source could not compile against Node 22 V8 headers. The manifest and lock now use `better-sqlite3@13.0.3` (Node `>=22`, no install-time `node-gyp` script), with `node-addon-api@8.5.0` and an updated toolchain preflight. A direct SQLite probe and the full local gate set pass: **1353 / 1353 assertions** across **38 specs**. Packaged Electron-ABI rebuild and launch remain native-runner gates.

CI also needed a committed tape setup (`scripts/testSetup.js`, `global-jsdom`, a `.vue` stub, and an `ipc` proxy) and an electron-builder 26 schema correction (`mac.notarize: false`; no removed `win.publisherName` or `win.signDlls`). The builder config was validated against the 26.18.0 schema and the platform preflight now guards those fields. No upstream issue is closed by these CI corrections.

## Final Electron 45 CI correction (2026-11-07)

A renderer-origin regression was diagnosed from CI console logs: Vite emitted absolute `app://assets/...` URLs, which Electron 45 blocked by CORS from the `app://.` origin. `build/scripts/build.mjs` now uses relative asset URLs, and `uitest/index.mjs` waits for the app navigation and mounted `#app` while surfacing renderer errors. This is a build/test wiring fix, not a UI redesign.

PR #2's final checks are green on GitHub Actions: `setup_and_lint`, `setup_and_test`, `setup_and_uitest`, and `setup_and_build` all pass. The earlier Windows `ia32` packaging failure remains resolved by the x64-only policy. Real packaged Linux launches/removals, release tags, real customer fixtures, and upstream issue closure are still open; no upstream issue is locally closed.
