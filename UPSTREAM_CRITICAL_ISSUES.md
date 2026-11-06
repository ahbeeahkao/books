# Upstream Critical Issue Register

**Date:** 2026-11-06
**Branch:** `arena/9ef0fb7f-books`
**Baseline:** `f7b0f81` — PR #1 merged into `master`
**Upstream:** [`frappe/books` issues](https://github.com/frappe/books/issues) — discontinued upstream project

## Purpose

This file is the local stabilization backlog for the fork. Upstream issues are **not** closed from this repository, and the Arena GitHub App still lacks `issues=write`, so no fork GitHub issues can be created. Until that permission is available, critical upstream parity work is tracked here and in `STABILIZATION.md`.

The goal is to stabilize the fork against the discontinued upstream before adding more new features. This is **not** a claim that all upstream issues are fixed. Every issue below still needs a fork-side reproduction on `0.37.0` before a code fix is considered complete.

## Source and method

GitHub API search on 2026-11-06 reported:

- **108 open upstream issues**
- **588 closed upstream issues**
- **35 open upstream PRs**
- `open_issues_count` is **143** because GitHub includes the 35 open PRs alongside the 108 open issues

Query used for the review:

```text
repo:frappe/books is:issue is:open
```

All 108 open issues were reviewed by title, labels, body, and comment count. Feature requests, questions, regional enhancements, cosmetic UI polish, accessibility/ergonomics requests, and speculative platform/integration work were excluded from the critical backlog unless they block startup, data integrity, accounting correctness, or a core workflow.

`P0` / `P1` / `P2` below are **local fork triage priorities**, not upstream labels. Upstream has no `critical`, `P0`, or `P1` labels; currently there are 13 open upstream issues labelled `bug`.

### Priority definitions

- **P0 — stabilization gate:** data loss/corruption, DB open/restore failure, app cannot launch, security/runtime EOL, or wrong financial reports.
- **P1 — core workflow blocker:** incorrect accounting/inventory, blocked transaction flows, broken import/export, or broken existing navigation required to use the app.
- **P2 — important follow-up:** packaging/distribution, developer guardrails, regional export encoding, and other non-gating but still relevant issues.

### Local status legend

- **Fixed:** fork has a code fix and regression coverage.
- **Synthetic:** fork has a code fix and synthetic tests, but not a real user `.db` reproduction.
- **Partial:** a related guard/label/toolchain issue was hardened, but the upstream symptom is not fully reproduced or closed.
- **Triage:** needs concrete reproduction data on this fork.
- **Platform:** packaging/runtime work; separate from app-schema logic.
- **Deferred:** feature, visual redesign, or enhancement work to revisit after stabilization.

## Pass 4 local status (2026-11-06)

Implemented after this tracker was created. No upstream GitHub issues were closed. No real broken `.db` reproduction, visual redesign, new sidebar roots, extra POS clicks, FTS/scheduled jobs, Electron upgrade, release tag, or packaged-artifact smoke test was attempted.

| Upstream issue(s)               | Local status                            | Evidence / remaining gate                                                                                                                                                                   |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1446                           | **Fixed**                               | Existing computed-status filter regression; unchanged from Pass 1.                                                                                                                          |
| #1536, #1351, #1291, #1546      | **Synthetic (DatabaseManager)**         | Checkpoint 1 reproduces documented shapes through `DatabaseManager.connectToDatabase()`; real broken `.db` samples are still required before local closure.                                 |
| #815, #819, #1394, #1410, #1541 | **Code fix (synthetic fixtures)**       | Checkpoint 2 reconciles #1394 export values, #1410 opening balance, and #1541 prior-fiscal-year P&L with labelled synthetic fixtures; real customer/ledger data remains open.               |
| #1102, #1413, #1513, #1516      | **Platform gate (synthetic)**           | Electron 45.2.3, native-architecture checks, Linux sandbox guidance, and manual CI smoke-test workflow added; real packaged launch outputs remain open.                                     |
| #1538, #842                     | **Code fix (synthetic) / data pending** | Stock-in-hand posting now uses net item amount instead of GST-inclusive grand total; large imported stock-ledger dataset still needed for #842.                                             |
| #1539, #1540, #1277, #1431      | **Code fix (synthetic) / data pending** | Multi-reference write-off validation, write-off ledger settlement, and line-discount clamping were fixed; #1431 has a synthetic item-selection fixture but still needs real item/rule data. |
| #770                            | **Fixed (synthetic)**                   | Zero-decimal currency display precision and tax truncation helper with regression tests.                                                                                                    |
| #1535                           | **Unresolved**                          | Needs a COA root delete/recreate reproduction; no UI or schema change was made.                                                                                                             |
| #1491, #1222                    | **Fixed (synthetic)**                   | Canonical export/import field keys, UTF-8 BOM CSV export, BOM-tolerant parser, and regression tests.                                                                                        |
| #1390                           | **Fixed**                               | ERPNext sync button no longer reloads/redirects the window; success/error toasts and error logging remain.                                                                                  |
| #1523                           | **Fixed**                               | Sidebar restore control is visibly rendered and labelled; this is a functional fix, not a visual redesign.                                                                                  |
| #1444                           | **Fixed**                               | `npm run check:toolchain` validates Node, `yarn.lock`, absence of `package-lock.json`, and pinned module versions.                                                                          |
| #1515, #1395, #1551             | **Unresolved release/distribution**     | Fork release policy and RPM/Flatpak scriptlets need packaged artifacts and package-manager verification.                                                                                    |
| #459, #624, #1470, #1495, #1427 | **Deferred**                            | Translation/regional/UI polish remains with later visual redesign work.                                                                                                                     |

### Later-phase checkpoint 1 (2026-11-07)

`backend/database/tests/testSyntheticIssueStepDatabases.spec.ts` adds four **synthetic issue-step** reproductions through the public `DatabaseManager.connectToDatabase()` path, with 48 targeted assertions. It covers #1351 missing FKs on a copied old DB, #1536 dangling FK fail-loud behaviour, #1291 post-update missing columns, and #1546 `Misc.openCount` in a writable versus non-writable DB directory. Fixtures are generated in temporary directories; no binary `.db` is committed. See `LATER_PHASE_EVIDENCE.md`.

This improves fork-side evidence but **does not close P0-1 or P0-2**. Real broken company DBs and real `foreign_key_check` / file-permission traces remain the gate for end-to-end local closure.

### Later-phase checkpoint 2 (2026-11-07)

`tests/testLaterPhaseReconciliation.spec.ts` adds labelled synthetic fixtures for #1394, #1410, #1541, #842, #1431, and #1535. It covers exported customer balance numeric values, carry-forward ledger opening balance, prior-fiscal-year P&L date ranges and totals, finite stock valuation, pricing-rule item candidates, and root-account recreation constraints. See `LATER_PHASE_EVIDENCE.md`.

These fixtures support local code hardening, but real customer CSVs, a prior-fiscal-year company DB, a large imported stock ledger, concrete pricing-rule data, and a COA delete/recreate trace remain required before end-to-end local closure.

### Later-phase checkpoint 3 (2026-11-07)

Electron and packaging dependencies were upgraded to the latest stable versions verified from the npm registry. Native architecture checks, Linux desktop sandbox guidance, Node/toolchain preflight, and CI packaging gates were added. See `LATER_PHASE_EVIDENCE.md` and `LINUX_SANDBOX.md`.

This is **not** a packaged launch smoke test. The manual native-runner workflow has not executed in the Arena sandbox, and no upstream platform issue is closed until its outputs are attached.

---

## P0 — must verify or fix before new features

### P0-1. Company DB open / restore / migration fails with foreign-key errors

**Upstream:** [#1536](https://github.com/frappe/books/issues/1536), [#1351](https://github.com/frappe/books/issues/1351), [#1291](https://github.com/frappe/books/issues/1291)
**Why critical:** users cannot open or restore company databases; this is the highest data-availability risk.
**Fork status:** **Synthetic (DatabaseManager).** `backend/database/core.ts` rebuilds tables safely, fills required-column defaults, restores FK enforcement, and checks `foreign_key_check`. `backend/database/tests/testSyntheticIssueStepDatabases.spec.ts` now reproduces the documented #1536 / #1351 / #1291 shapes through `DatabaseManager.connectToDatabase()`, in addition to the earlier core-level regression suites.
**Next action:** obtain real broken `.db` files, reproduce DB open / restore / migration against `0.37.0`, and verify historical schema order, dangling FKs, backup/restore locking, and `PatchRun` state. Do not mark the upstream reports fully closed from synthetic tests alone.

### P0-2. `SingleValue.openCount` update fails with “unable to open database file”

**Upstream:** [#1546](https://github.com/frappe/books/issues/1546)
**Why critical:** app fails while writing the open-count single value; possible DB lock, missing table/column, or file availability problem.
**Fork status:** **Synthetic (DatabaseManager).** Pass 3 covers missing/legacy `SingleValue` shapes; checkpoint 1 adds a writable-directory versus non-writable-directory `Misc.openCount` reproduction through `DatabaseManager.connectToDatabase()`.
**Next action:** obtain a real `0.37.0-dev` company DB that shows the failure; test backup/restore locking, file permissions, concurrent open paths, and the exact `update SingleValue ... openCount` statement.

### P0-3. Computed `status` filter leaks into SQL

**Upstream:** [#1446](https://github.com/frappe/books/issues/1446)
**Why critical:** filtering `status != Cancelled` produces `no such column: status` and blocks list views.
**Fork status:** **Fixed.** `src/utils/statusFilters.ts` splits computed-status filters out of SQL and applies all operators client-side; `src/pages/ListView/List.vue` and `tests/testStatusFilter.spec.ts` cover the regression.
**Next action:** keep the regression suite green; no further fix expected unless a new computed-status operator is added.

### P0-4. Core financial reports show wrong or missing values

**Upstream:** [#815](https://github.com/frappe/books/issues/815), [#819](https://github.com/frappe/books/issues/819), [#1541](https://github.com/frappe/books/issues/1541), [#1394](https://github.com/frappe/books/issues/1394), [#1410](https://github.com/frappe/books/issues/1410)
**Why critical:** Trial Balance, Balance Sheet, Profit & Loss, customer balances, and ledger opening balances are accounting-correctness surfaces. Wrong reports can hide real ledger errors.
**Fork status:** **Code fix (synthetic fixtures).** Pass 2 and Pass 4 added P&L, date, currency, and export hardening. Checkpoint 2 adds synthetic reconciliations for #1394, #1410, and #1541 and an automatic carry-forward opening balance row in the General Ledger; #815 and #819 still need real report data.
**Next action:** obtain real customer/ledger exports and compare General Ledger, Trial Balance, Balance Sheet, P&L, and CSV export end-to-end; the synthetic checkpoint-2 fixtures are not a substitute for that data.

### P0-5. Release/runtime platform blockers

**Upstream:** [#1102](https://github.com/frappe/books/issues/1102), [#1413](https://github.com/frappe/books/issues/1413), [#1513](https://github.com/frappe/books/issues/1513), [#1516](https://github.com/frappe/books/issues/1516)
**Why critical:** packaged builds may not launch on Ubuntu 24.04 / AppImage, ARM64 artifacts may ship x86_64 `better-sqlite3` native modules, and the upstream Electron 22 runtime was EOL with no security patches.
**Fork status:** **Platform gate (synthetic).** Electron `45.2.3`, builder `26.18.0`, Node `22.12+` preflight, x64/ARM64 native-architecture checks, Linux sandbox guidance, and a manual packaged CI gate are in place. Real packaged launch outputs are still required.
**Next action:** run `.github/workflows/platform.yml` on native x64/ARM64 runners, attach the packaged launch and `.node` architecture outputs, then decide the fork release/tag policy in checkpoint 4.

---

## P1 — core workflow and data-correctness blockers

### P1-1. Stock and purchase/inventory accounting correctness

**Upstream:** [#1538](https://github.com/frappe/books/issues/1538), [#842](https://github.com/frappe/books/issues/842)
**Why critical:** stock-in-hand value includes GST for purchase receipts, and Stock Ledger / Stock Balance may fail to load on large imported datasets.
**Fork status:** **Code fix (synthetic).** CP4 centralized POS stock quantity validation; checkpoint 2 added a finite stock valuation guard and a synthetic Stock Balance fixture. The large imported dataset from #842 is still needed.
**Next action:** reproduce with a GST-enabled purchase receipt and a large imported stock-ledger dataset; inspect `StockLedgerEntry`, valuation method, batch rows, and report query limits. Add regression tests before changing valuation or report logic.

### P1-2. Payment, discount and pricing-rule correctness

**Upstream:** [#1539](https://github.com/frappe/books/issues/1539), [#1540](https://github.com/frappe/books/issues/1540), [#1277](https://github.com/frappe/books/issues/1277), [#1431](https://github.com/frappe/books/issues/1431)
**Why critical:** multiple Sales Invoice payment fails, payment write-off/discount accounting is wrong, item discount reduces rate instead of amount, and pricing-rule discount cannot find an item.
**Fork status:** **Triage.** These were part of the old P1 accounting/inventory triage list but have no concrete reproduction fixture yet.
**Next action:** reproduce multi-invoice payment, write-off accounting, item-level discount amount, and pricing-rule item lookup on this fork; verify ledger entries and regression tests before fixes.

### P1-3. Currency precision and rounding

**Upstream:** [#770](https://github.com/frappe/books/issues/770)
**Why critical:** JPY amounts with decimals are rounded incorrectly; display precision hides but does not fix the stored amount.
**Fork status:** **Triage.** No dedicated zero-decimal currency rounding test exists in the fork.
**Next action:** reproduce with JPY / `internalPrecision` / `countryInfo.json`, add a Money/Converter regression test, then fix rounding without changing display-only precision.

### P1-4. Chart of Accounts root rebuild

**Upstream:** [#1535](https://github.com/frappe/books/issues/1535)
**Why critical:** users cannot recreate or rebuild root groups after deleting the chart of accounts structure.
**Fork status:** **Synthetic fixture.** Root-group recreation is now allowed after setup while child accounts still require a parent; a real delete/recreate trace remains open.
**Next action:** reproduce delete/recreate root group, inspect FK constraints and COA defaults, then add a regression test.

### P1-5. Import/export round-trip and CSV encoding

**Upstream:** [#1491](https://github.com/frappe/books/issues/1491), [#1222](https://github.com/frappe/books/issues/1222)
**Why critical:** same-version export/import is cumbersome due to mismatched column titles/order, and Simplified Chinese CSV export is garbled in Excel.
**Fork status:** **Triage.** No round-trip or encoding regression exists.
**Next action:** capture export and import templates for core DocTypes, add a round-trip test, and verify UTF-8 BOM / Excel compatibility for non-ASCII data.

### P1-6. ERPNext sync workflow broken

**Upstream:** [#1390](https://github.com/frappe/books/issues/1390)
**Why critical:** “Sync data from server” does not behave like an action and redirects home; the fork still contains `src/utils/erpnextSync.ts`.
**Fork status:** **Triage.** CP3 tightened UOM/conversion import validation but did not reproduce the sync button flow.
**Next action:** reproduce with configured API details; verify click handling, route, and pre-sync validation. Keep any fix separate from new sync features.

### P1-7. Existing sidebar restore control is broken

**Upstream:** [#1523](https://github.com/frappe/books/issues/1523)
**Why critical:** once minimized, the sidebar cannot be restored, blocking normal navigation.
**Fork status:** **Triage.** This is a functional regression, not a visual redesign or new sidebar root.
**Next action:** reproduce minimize/restore on macOS and add a small state/control regression test if practical.

---

## P2 — important follow-up, not a new-feature gate

### P2-1. Developer toolchain guardrails

**Upstream:** [#1444](https://github.com/frappe/books/issues/1444)
**Why relevant:** unsupported toolchain/lockfile drift produced confusing TypeScript failures.
**Fork status:** **Fixed / Partial.** Pass 2 fixed the type baseline and documented the locked direct-Node tape command, but there is no active preflight guard that rejects drifted toolchains.
**Next action:** optionally add a preflight check to `scripts/test.sh` or a small CI-style script. Do not change app logic.

### P2-2. Fork release policy and distribution artifacts

**Upstream:** [#1515](https://github.com/frappe/books/issues/1515), [#1395](https://github.com/frappe/books/issues/1395), [#1551](https://github.com/frappe/books/issues/1551)
**Why relevant:** upstream `v0.37.0` was never tagged/released, RPM uninstall scriptlets emit errors, and the Flathub package is no longer maintained.
**Fork status:** **Platform / Triage.** Fork-specific release policy is undecided; no Flatpak/Flathub or RPM work is planned for stabilization.
**Next action:** decide fork version/tag/release policy, verify ARM64 packaging from P0-5, and only then decide whether RPM/Flatpak artifacts are in scope.

### P2-3. Translation, regional and UI polish

**Upstream:** [#459](https://github.com/frappe/books/issues/459), [#624](https://github.com/frappe/books/issues/624), [#1470](https://github.com/frappe/books/issues/1470), [#1495](https://github.com/frappe/books/issues/1495), [#1427](https://github.com/frappe/books/issues/1427)
**Why deferred:** these are regional/visual/printing-polish issues, not data-loss or accounting-correctness blockers.
**Fork status:** **Deferred.** Keep these with the later visual redesign / UX workstream, not the stabilization gate.

---

## Explicitly not in the critical backlog

The remaining open upstream issues are mostly feature requests or enhancement ideas: time tracking, self-hosting, GST/e-invoicing, multi-company/sub-entity support, recurring invoices, plugins, multi-currency, user roles, fiscal-year management, depreciation, encryption, budgets, remote DB, custom list views, responsive dashboard, sortable columns, accessibility, AI/MCP, new regional CoAs, and new DocTypes. They are worth considering only **after** P0/P1 stabilization is verified.

In particular, these remain deferred until the stabilization gate is complete:

- **real broken-`.db` P0 reproductions** — part of closing P0-1 / P0-2, not a new feature; should be done first after this register is approved.
- **visual redesign** — later UX workstream.
- **new sidebar roots** — later enhancement; fixing #1523 restore control is different.
- **extra POS clicks / POS redesign** — later enhancement; CP4 explicitly added no extra click.
- **FTS5 tables / scheduled jobs** — still out of enhancement scope under the confirmed scope decisions.

## Definition of done for a tracked issue

An upstream issue can be marked locally **closed** only when all of the following are true:

1. The symptom is reproduced on this fork’s `0.37.0` code, or a documented reason explains why it is upstream-only.
2. A fork commit contains the fix.
3. A regression test covers the symptom.
4. Full tape, typecheck, ESLint, Prettier, and build checks remain green.
5. This file and `STABILIZATION.md` are updated with the local status.
6. If the issue is DB-related, a real user `.db` or a clearly labelled synthetic fixture is recorded; synthetic coverage alone cannot claim end-to-end closure.

## Sequencing after this register

1. Pass 4 code-level P0–P2 fixes are recorded above; synthetic verification is complete.
2. Checkpoint 1 recorded labelled synthetic `DatabaseManager` reproductions for P0-1 / P0-2, and checkpoint 2 recorded labelled synthetic reconciliation fixtures. Real broken-`.db` samples and customer/COA/pricing/stock-ledger data remain open gates.
3. Checkpoint 3 added platform policy and a manual packaged-artifact gate; run it on native x64/ARM64 runners, then finish the checkpoint-4 release policy.
4. Re-run the full verification gates after each remaining fix.
5. Only then revisit visual redesign, new sidebar roots, and extra POS clicks.
