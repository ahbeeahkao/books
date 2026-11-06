# Later-Phase Evidence

**Date:** 2026-11-07
**Branch:** `arena/9ef0fb7f-books`
**Open PR:** [#2 — Stabilize fork against critical upstream issues](https://github.com/ahbeeahkao/books/pull/2)

This file records verification evidence for the five later-phase checkpoints in `LATER_PHASE_PLAN.md`. All fixtures below are **synthetic issue-step reproductions** generated at runtime. They are not real customer databases or real reconciliation files, and they do not close any upstream GitHub issue.

## Checkpoint 1 — Synthetic issue-step broken-DB reproductions

**Status:** synthetic evidence recorded; **real broken-`.db` gate remains open**.

`backend/database/tests/testSyntheticIssueStepDatabases.spec.ts` builds temporary SQLite company DBs from the documented upstream shapes, then opens each through the public `DatabaseManager.connectToDatabase()` → `_connect()` → `#migrate()` path. No binary DB fixture is committed. Each fixture starts from a fully migrated DB and records a future `SingleValue.version` so the test isolates schema migration from historical data patches.

| Upstream issue | Synthetic issue-step shape                                                                                                                                                                      | Fork behaviour observed                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1351          | Old copied DB has `SalesInvoice` rows but no FK definitions, plus one legacy column.                                                                                                            | `DatabaseManager` adds the missing `party` FK, drops the legacy column, preserves parent and child rows, and finishes with clean `foreign_key_check` / `integrity_check`.           |
| #1536          | Old DB has a dangling required Link and a legacy column that forces a rebuild.                                                                                                                  | Migration fails loudly with `foreign key check failed`; the corrupt invoice row is preserved, the file remains readable, FK enforcement stays on, and no `__*` temp table remains.  |
| #1291          | Post-update DB lacks newer `isFullyReturned`, `isSyncedWithErp`, `itemCode`, `itemDiscountAmount`, and `itemDiscountPercent` columns on invoice, quote, purchase, receipt, and shipment tables. | `DatabaseManager` restores all documented columns, gives new check fields the safe `0` default, preserves child rows, and leaves no FK violations or temp tables.                   |
| #1546          | `Misc.openCount` write is attempted with a DB in a non-writable directory, then with a copy in a writable directory.                                                                            | The non-writable case throws; the writable copy stores and reads `openCount = 21`. This is one plausible directory-permission shape, not proof of the reporter's actual root cause. |

Every healthy case also asserts one company per DB through `AccountingSettings.companyName`, no `Company` DocType, `PRAGMA foreign_keys=ON`, empty `PRAGMA foreign_key_check`, `PRAGMA integrity_check=ok`, and no leftover migration temp tables.

Verification:

- Targeted `tape backend/database/tests/testSyntheticIssueStepDatabases.spec.ts`: **48 / 48 passing**.
- `vue-tsc --noEmit --pretty false`: **0 errors**.
- Full tape suite at checkpoint 1: **1288 / 1288 passing** across **34 spec files**.
- `vue-tsc --noEmit --pretty false`, `eslint . --ext ts,vue`, Prettier check, `npm run check:toolchain`, `node build/scripts/build.mjs --nopackage`, and `git diff --check`: all exit 0. Nonfatal Vite dynamic-import/chunk-size warnings remain unchanged.

Limitations:

- Upstream attachment retrieval remains blocked by this sandbox's outbound allowlist; the #819 `test.books.db.zip` redirect to `objects.githubusercontent.com` could not be downloaded.
- No real user `.db` sample, file-permission trace, or foreign-key-check output was available.
- No upstream issue is marked locally closed from this evidence; real samples remain required before end-to-end local closure.

## Checkpoint 2 — Synthetic reconciliation fixtures

**Status:** deterministic fixtures and fork-side code hardening recorded; **real customer/COA/pricing-rule/stock-ledger data remains open**.

`tests/testLaterPhaseReconciliation.spec.ts` generates small runtime fixtures from documented issue steps and compares them to expected report/filter values where the upstream reports provide them. A stub `Fyo` supplies deterministic ledger rows and fiscal-year settings; no binary database or CSV fixture is committed.

| Upstream issue | Synthetic fixture and reconciliation result                                                                                                                                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1394          | Customer rows with a Money-like `rawValue` and a non-finite balance export as `50000` and `0`; `[object Object]` and `Infinity` no longer leak into CSV. `reports/commonExporter.ts` now exports the numeric `float` value and bounds non-finite numbers.                                                                                       |
| #1410          | Balance till 25 Oct `₹50,000`, range movement on 26 Oct `−₹1,000`, expected closing `₹49,000`. `reports/GeneralLedger/GeneralLedger.ts` now fetches entries through `toDate`, computes carry-forward opening balances locally, adds an `Opening` row, offsets running/closing balances, and groups opening balances by the active report group. |
| #1541          | FY 1 Apr 2025 – 31 Mar 2026 with a 5 May 2025 income entry. `ProfitAndLoss` resolves the prior fiscal-year range to `2025-04-01` / exclusive `2026-04-01`, includes the back-dated invoice in its query filters, and reconciles a `₹50,000` total-income row.                                                                                   |
| #842           | The exact floating-point valuation pair from the issue (`11.997499999999993` / `−11.997500000000002`) and non-finite Stock Ledger values produce finite Stock Balance output. `StockQueue` rejects non-finite inputs and `reports/inventory/helpers.ts` bounds report values to zero for display; the underlying stock data is not rewritten.   |
| #1431          | One eligible sales item, one purchase-only item, and one disabled item produce exactly the sales item for pricing-rule selection, with no wrong-item fallback. Real feature-flag/item/rule data from the reporter is still unavailable.                                                                                                         |
| #1535          | Post-setup root delete/recreate fixture allows an explicit top-level group with a `rootType`, while ordinary child accounts without a parent remain constrained. `models/baseModels/Account/Account.ts` uses this rule in its required-parent check.                                                                                            |

Implementation helpers are in `src/utils/reconciliation.ts` and `src/utils/stabilization.ts`. These are bounded display/validation fixes, not a silent repair of real corrupt stock data.

Verification:

- Targeted reconciliation spec: **29 / 29 passing**.
- Full tape suite at checkpoint 2: **1317 / 1317 passing** across **35 spec files**.
- `vue-tsc --noEmit --pretty false`, `eslint . --ext ts,vue`, Prettier check, `npm run check:toolchain`, `node build/scripts/build.mjs --nopackage`, and `git diff --check`: all exit 0.

Limitations:

- No real exported customer balance CSV, prior-fiscal-year company DB, large imported stock ledger, pricing-rule screenshot data, or COA delete/recreate trace was available.
- #1410 now implements automatic carry-forward opening balance; it queries all non-reverted ledger entries through `toDate`, so performance on very large company DBs still needs a real dataset check.
- No upstream issue is marked locally closed from these synthetic fixtures.

## Checkpoints 3–5

Pending in sequential order.
