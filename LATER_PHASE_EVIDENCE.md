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

## Checkpoint 3 — Electron/platform gates

**Status:** source, scripts, and CI configuration implemented; **real packaged Linux x64/ARM64 smoke tests are not available in this sandbox**.

- `package.json` now pins Electron `45.2.3`, `electron-builder` `26.18.0`, `@electron/rebuild` `4.2.1`, `electron-updater` `6.8.11`, and `node-abi` `^4.40.0`. Direct `yarn.lock` entries were appended from npm registry metadata.
- `scripts/checkToolchain.mjs` now requires Node `22.12+` and verifies the exact Electron/platform package versions. All active GitHub workflows use Node `22.14.0`.
- `package.json` exposes `yarn rebuild:native`, `yarn check:native-arch`, and `yarn check:platform`. `scripts/checkPlatformPolicy.mjs` verifies the pinned versions, Linux x64/ARM64 targets, Linux sandbox guard, lock entries, and workflow node versions.
- `electron-builder-config.mjs` now enables native rebuilds and includes `arm64` for `deb`, `rpm`, and `AppImage`; previously AppImage was x64-only.
- `scripts/checkNativeArchitecture.mjs` scans an unpacked app directory and fails if any `.node` file is not an ELF binary for the requested x64/arm64 target. `tests/testPlatformArchitecture.spec.ts` covers matching and mismatching synthetic ELF headers, missing modules, non-ELF files, the Linux sandbox opt-in, and the static policy gate.
- `src/utils/platform.ts` and `main.ts` keep the Chromium sandbox off-limits by default and allow an explicit Linux-only `BOOKS_DISABLE_CHROMIUM_SANDBOX=1` diagnostic fallback. `LINUX_SANDBOX.md` documents the security trade-off and preferred system fixes.
- `.github/workflows/platform.yml` is a manual native-runner gate for x64 and ARM64. It packages the app, checks unpacked native-module architecture, and launches the binary under Xvfb. `build.yml`, `lint.yml`, and `test.yml` also run toolchain/platform preflight on pull requests.

Verification:

- Targeted platform spec: **11 / 11 passing**.
- Full tape suite at checkpoint 3: **1328 / 1328 passing** across **36 spec files**.
- `vue-tsc --noEmit --pretty false`, `eslint . --ext ts,vue`, Prettier check, `yarn check:toolchain`, `yarn check:platform`, `node build/scripts/build.mjs --nopackage`, and `git diff --check`: all green.

Limitations:

- This sandbox cannot download/run Electron desktop binaries for Linux x64 or ARM64, so the manual packaged-architecture workflow and Xvfb launch step were **not executed here**.
- `npm rebuild better-sqlite3 --build-from-source` restored the host test toolchain, but it is not an Electron-ABI rebuild inside a packaged artifact. `yarn rebuild:native` on a native CI runner remains the packaged rebuild gate.
- Yarn's registry fetch endpoint was not usable from this sandbox. Direct lock entries were added, but a full transitive `yarn.lock` regeneration should be performed by a network-enabled CI runner.
- No upstream issue is marked locally closed without the packaged launch and native-architecture smoke-test outputs.

## Checkpoint 4 — release policy and distribution boundary

**Status:** policy, static gates, and guarded RPM scriptlet implemented; **no release tag, GitHub Release, packaged RPM, package-manager removal test, or Flathub listing was created**.

- `RELEASE_POLICY.md` records the fork version/tag rule: keep `package.json` as the version source, use `v0.37.0-fork.N` tags from `master`, never reuse upstream `v0.37.0`, and publish only to `ahbeeahkao/books`.
- `package.json` now points `repository.url` to the fork and exposes `yarn check:release`. `.github/workflows/publish.yml` remains manually dispatched and runs toolchain, platform, and release-policy preflights on every platform job.
- `scripts/checkReleasePolicy.mjs` rejects feature branches, pull-request refs, and upstream tags in CI, checks the fork repository and release-gate wiring, and fails if a Flatpak target appears without a revised distribution checkpoint.
- `build/scripts/linux/after-remove.sh` is wired through `deb.afterRemove` and `rpm.afterRemove`. It queries the alternatives database before removal, tolerates `update-alternatives --remove` errors, preserves AppArmor cleanup, and always exits zero. This addresses the scriptlet shape reported in #1395.
- Windows NSIS icon paths were corrected to the actual camelCase filenames, removing one case-sensitive release blocker noted in #1515. The policy still requires the first actionable CI error from any failed platform build, not an assumed signing failure.
- `RELEASE_POLICY.md` states that Flatpak/Flathub support is out of scope: no `flatpak` target, manifest, publisher verification, or listing restoration is included. The existing `io.frappe.books` appId is retained for compatibility only.
- `tests/testReleasePolicy.spec.ts` covers allowed/blocked release refs, the static gate, and two synthetic `update-alternatives` failure modes for the guarded scriptlet.

Verification:

- Targeted release spec: **9 / 9 passing**.
- Full tape suite at checkpoint 4: **1337 / 1337 passing** across **37 spec files**.
- `vue-tsc`, ESLint, Prettier, `yarn check:toolchain`, `yarn check:platform`, `yarn check:release`, `node build/scripts/build.mjs --nopackage`, and `git diff --check`: all green.

Limitations:

- No RPM was built or removed with `dnf`; the guarded scriptlet was exercised with synthetic command stubs, not a package-manager transaction.
- No release tag, draft, or GitHub Release was created; the publish workflow was not executed.
- Flathub restoration, publisher verification from #1144, and Flatpak target builds remain explicitly out of scope.
- No upstream issue is marked locally closed without packaged artifacts and package-manager evidence.

## Checkpoint 5 — minimal native UX

**Status:** source, static policy, and unit tests implemented; **no packaged Electron app was launched and no e2e/screenshot UI test was recorded**.

- `src/pages/Desk.vue` replaces the low-opacity hover-only sidebar restore icon with an always-visible background/border control, a chevron, and a translated `Show Sidebar` text label. `aria-label` and `title` remain translatable through `t`; RTL rotation is applied to the icon only.
- `src/utils/platform.ts` adds the pure `getZoomActionFromKeyboardEvent` helper, and `main.ts` wires it through Electron's `before-input-event`. `Ctrl/Cmd +`, `=`, `-`, `0`, and numpad variants now zoom in, zoom out, or reset zoom with conservative bounds.
- `NATIVE_UX.md` records the boundary: no broad redesign, no new dependencies, no new sidebar roots, no extra POS confirmations, and no untranslated visible labels.
- `scripts/checkNativeUXPolicy.mjs` checks the visible control, translatable labels, zoom wiring, documentation boundaries, and `yarn check:native-ux` registration. `tests/testNativeUX.spec.ts` covers 16 keyboard/policy assertions. `.github/workflows/test.yml` runs the native UX preflight.
- `src/utils/sidebarConfig.ts` and `src/pages/POS/POS.vue` were deliberately left unchanged.

Verification:

- Targeted native UX spec: **16 / 16 passing**.
- Full tape suite at checkpoint 5: **1353 / 1353 passing** across **38 spec files**.
- `vue-tsc`, ESLint, Prettier, `yarn check:toolchain`, `yarn check:platform`, `yarn check:release`, `yarn check:native-ux`, `node build/scripts/build.mjs --nopackage`, and `git diff --check`: all green.

Limitations:

- The sidebar change was verified statically and through source build, not a packaged app screenshot.
- Zoom mapping was verified with synthetic keyboard inputs, not a live Electron `webContents` session.
- Broader translation gaps (#459), regional issues (#624), printing delay (#1427), and dropdown clipping (#1495) remain deferred; no upstream issue is locally closed.
- Together, CP3–CP5 complete the five later-phase checkpoints at the source/gate level. Real packaged launch/removal outputs, release tags, real customer data, and genuine upstream issue closure remain open.
