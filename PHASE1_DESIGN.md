# Phase 1 Design / Impact Note

**Date:** 2026-11-04  
**Branch:** `arena/a27de3bc-books` (active)  
**Baseline:** `0a4be28` / `stabilization-pass-3`  
**Status:** CP1–CP5 merged; code-resolvable P0–P2 upstream parity fixes verified before new features

This note converted the confirmed roadmap decisions into a concrete implementation plan for the archived Electron/Vue/SQLite Books fork and now records the CP1–CP5 outcomes.

## Confirmed scope decisions

The four previously skipped decisions are now confirmed with their **recommended defaults**:

| #   | Decision             | Confirmed value                                                                                                                                               |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Migration policy     | **Strict automatic migration with backups** on DB open; fail loudly on corruption; no silent data loss.                                                       |
| 2   | Company model        | **One company per DB**. Keep `AccountingSettings.companyName`, `SystemSettings`, and per-DB singles; do not add a multi-company `Company` DocType in Phase 1. |
| 3   | Malaysia e-invoice   | **Offline UBL first** in a later phase. No direct MyInvois API and no GPL component copied into core schemas now.                                             |
| 4   | FTS / scheduled jobs | **Out of enhancement scope**. `src/utils/search.ts`, `main/initSheduler.ts`, and `jobs/` remain unchanged.                                                    |

A fifth planning assumption, **Phase 1 order**, was **not** one of the four user-confirmed decisions and was initially unconfirmed. The user later confirmed `CP4 then CP5, then create PR`; CP1–CP3 had already been implemented in the working sequence `itemWeightDigits` → Item Barcode child table → UOM parity. The other four decisions remain confirmed.

## Baseline

Stabilization passes 1–3 are complete and pushed:

- `stabilization-pass-1` (`69d9616`): computed `status` filters, SQLite FK-safe migration rebuild, `@types/webpack-env`.
- `stabilization-pass-2` (`55b88df`): zero typecheck errors, P&L guard/label fix, 965/965 tests.
- `stabilization-pass-3` (`0a4be28`): synthetic broken-DB reproduction, required-column fallback in `prestigeTheTable`, 1024/1024 tests.

Current verification baseline: full tape suite 1024/1024, `vue-tsc --noEmit` 0 errors, ESLint 0 errors/0 warnings, Prettier clean, `build --nopackage` passes.

Local toolchain remains Node `v22.22.3` with a locked exact-spec npm install; README expects Node `20.18.1`. `better-sqlite3@9.6.0` and `global-jsdom` are local-only verification aids, not manifest changes. No `package-lock.json` is persisted.

## Phase 1 objectives

1. Make `itemWeightDigits` a real persisted setting and make the existing weight-barcode path safe.
2. Replace the single 12-digit `Item.barcode` limitation with a multi-barcode child table while preserving backward compatibility.
3. Bring UOM parity closer to the successor repo without a visual redesign.
4. Add a single POS stock validator so scan/search, add-item, and final invoice validation agree on available quantity.
5. Decide and document custom-form storage before any new DocType work.

## Explicit non-goals

- No FTS search index and no scheduled-job port.
- No new visual design system; reuse `colors.json`, Tailwind `darkMode: 'class'`, `tailwindcss-rtl`, Feather icons, and existing components.
- No new sidebar root per DocType; continue using generic `/edit/:schemaName/:name` and `/list/:schemaName`.
- No separate Barcode / Serial / Tax / e-Invoice managers.
- No `Company`, `Item Price`, `Contact`, `Country`, tax templates, ERPNext-style stored statuses, batch/serial FIFO, or Malaysia e-invoice in Phase 1; those are Phases 2–5.
- No copying GPL-3.0 `erpnext_malaysia` code into AGPL-3.0-only Books schemas.

## Architecture constraints

- New DocType JSON → `schemas/app/*.json` or `schemas/app/inventory/...`, registered in `schemas/schemas.ts` `appSchemas` and `models/types.ts` `ModelNameEnum`.
- Python-style controllers from the successor repo are reimplemented as TypeScript in `models/`, `fyo/models/`, or `models/inventory/`; no verbatim GPL/AGPL mixing without review.
- Whitelisted/server-style methods become pure helpers, `fyo.db` / `DatabaseManager` / `BespokeQueries`, or IPC actions — not direct UI DB access.
- Hooks/patches → model lifecycle plus `backend/patches/` and `PatchRun`; scheduler → Bree is explicitly out of scope.
- `DatabaseCore.#buildColumnForTable()` makes `name` the primary key. Child tables retain `name` and use the existing child meta fields (`parent`, `parentSchemaName`, `parentFieldname`, `idx`).
- UI: reuse `Button`, `Toast`, `StatusPill`, `DropdownWithActions`, `Table`, `FormControl`, `CommonForm`, `CommonFormSection`, `LinkedEntries`, `QuickView`, `PageHeader`, `MultiLabelLink`, `Barcode`, and `WeightEnabledBarcode`. Inline child tables and validation over new modals. Errors inline/toast. Labels translatable via `t`. Smart defaults and contextual actions. One always-focused POS scan/search field; one scan/Enter adds an item; weight barcode sets quantity. No extra click.

---

## Workstream 1: `itemWeightDigits` + weight barcode wiring

### Current state

- `models/inventory/Point of Sale/POSSettings.ts` already declares `itemWeightDigits?: number` and hides it unless `enableBarcodes` and `weightEnabledBarcode` are on.
- `src/pages/POS/POS.vue` already reads `posSettings?.itemWeightDigits || 0` in `handleItemSearch()` to compute `expectedWeightBarcodeLength`.
- `src/components/Controls/WeightEnabledBarcode.vue` already parses `checkDigits`, `itemCodeDigits`, and `itemWeightDigits`, but is **unwired**.
- `schemas/app/inventory/Point of Sale/POSSettings.json` is missing `itemWeightDigits`, so the value cannot be persisted.
- `src/components/Controls/Barcode.vue` hard-codes `/^[A-Za-z0-9]{12,}$/` and a `< 12` scanner cutoff.
- `src/pages/POS/POS.vue` hard-codes `searchTerm.length === 12` for plain barcode matching.
- `WeightEnabledBarcode.vue` calls `checkDigits.toString()` after an unchecked `as number`, which can throw when the setting is absent.

### Proposed changes

1. Add to `POSSettings.json`:
   ```json
   {
     "fieldname": "itemWeightDigits",
     "label": "Item Weight Digits",
     "fieldtype": "Int",
     "default": 0,
     "section": "Barcode"
   }
   ```
2. Extract a pure helper, e.g. `src/utils/barcodes.ts`, with:
   - `parseBarcodeSearchTerm(value, settings)` returning a discriminated result: plain barcode, weight barcode, item code, or plain name;
   - `getBarcodeMatch(fyo, parsed)` resolving against `Item.barcode`, `Item.itemCode`, and later `ItemBarcode.barcode`;
   - `getWeightBarcodeQuantity(parsed, unit)` replacing duplicated `Kg`/`Gram`/`Unit` switch logic.
3. Do **not** add a second scanner input to POS. Keep the single `MultiLabelLink` search field in `ClassicPOS.vue` / `ModernPOS.vue`; route its `@keyup.enter` / `@change` through `POS.vue.handleItemSearch()` as today.
4. Refactor `Barcode.vue` and `WeightEnabledBarcode.vue` to use the helper. `CommonForm.vue` keeps one barcode control in the header; when `weightEnabledBarcode` is enabled it should use the weight-capable path rather than mounting both controls.
5. Replace hard-coded 12-digit checks with configurable validation: accept arbitrary-length `Data` barcodes from the child table, keep legacy 12-digit `Item.barcode` working, and validate weight-barcode length from `checkDigits + itemCodeDigits + itemWeightDigits`.
6. Guard missing/undefined settings before `.toString()` or arithmetic; use `Number(...) || 0` consistently.

### Files

- `schemas/app/inventory/Point of Sale/POSSettings.json`
- `models/inventory/Point of Sale/POSSettings.ts` (only if hidden/validation maps need tightening)
- `src/utils/barcodes.ts` (new)
- `src/components/Controls/Barcode.vue`
- `src/components/Controls/WeightEnabledBarcode.vue`
- `src/pages/CommonForm/CommonForm.vue`
- `src/pages/POS/POS.vue`
- `src/pages/POS/ClassicPOS.vue`, `src/pages/POS/ModernPOS.vue` (only if the single search field contract changes)
- `tests/testBarcodes.spec.ts` (new)

### Migration

- Additive `SingleValue` field on a single schema: no table rebuild required. `#getSinglesUpdateList()` / `#initializeSingles()` will backfill the `0` default.
- `DatabaseManager.#executeMigration()` already creates a backup before `db.migrate()`; no second backup layer.
- Add a `backend/patches/` entry only if a data transform is needed; the field default is sufficient.

### Acceptance

- `itemWeightDigits` persists and is visible only when barcodes + weight barcodes are enabled.
- A weight barcode of the configured length resolves to the right item and sets the correct quantity for `Kg`, `Gram`, `Unit`, `Meter`, `Hour`, `Day`.
- Missing settings produce a clear toast, not a `TypeError`.
- Legacy 12-digit `Item.barcode` still resolves.
- Typecheck/lint/tests/build remain clean.

---

## Workstream 2: Item Barcode child table

### Current state

- `Item.json` has one `barcode` `Data` field and one `itemCode` `Data` field.
- `InventorySettings.enableBarcodes` gates the feature.
- `POS.vue.handleItemSearch()` fetches every item with `fields: ['name', 'barcode', 'itemCode', 'unit']` and matches in memory.
- `MultiLabelLink.vue` exposes `secondary-link="barcode"` and `third-link="itemCode"` but resolves from a single `Item` row.
- No child table, barcode type, or arbitrary-length/duplicate validation exists.

### Proposed changes

1. Add `schemas/app/ItemBarcode.json` as an `isChild` table:
   - `barcode` — `Data`, `required: true`;
   - `barcodeType` — `Select` with `EAN`, `UPC`, `Code 128`, `Custom`; default `Custom`;
   - `uom` — `Link` to `UOM`, optional, for per-barcode unit hints;
   - `tableFields: ["barcode", "barcodeType", "uom"]`;
   - `name` is added by `addNameField()` and becomes the primary key.
2. Register `ItemBarcode` in `schemas/schemas.ts` and `models/types.ts`.
3. Add to `Item.json` a `barcodes` `Table` field targeting `ItemBarcode`, section `Inventory`. Keep the legacy `barcode` field for backward compatibility.
4. Add `Item.ts` hidden/validation maps:
   - hide `barcodes` unless `enableBarcodes`;
   - reject duplicate `barcode` values within one item and across items;
   - require `barcode` on each child row.
5. Extend `src/utils/barcodes.ts` and `POS.vue.handleItemSearch()` to resolve a scan against `ItemBarcode` first, then legacy `Item.barcode`, then `itemCode`, then `name`.
6. Extend `MultiLabelLink.vue` `getOptions()` so the POS dropdown can include child barcodes without adding a new route or manager. Use `BespokeQueries` / `fyo.db.getAll` rather than FTS.
7. Backfill existing `Item.barcode` values into one `ItemBarcode` child row per item via a versioned `backend/patches/` patch. Do not delete `Item.barcode`.

### Migration

- New `ItemBarcode` table is created by `DatabaseCore.migrate()`.
- `barcodes` is a `Table` field, so no new column is added to `Item`.
- Backfill patch runs after schema creation and is recorded in `PatchRun`; backup is already created by `#executeMigration()`.
- Pass-3 `prestigeTheTable` required-column fallback protects any future rebuild of the child table.

### Acceptance

- An item can have multiple arbitrary-length barcodes with types.
- Duplicate barcodes are rejected with a translatable inline/toast error.
- POS scan/Enter resolves child-table barcodes and still resolves legacy 12-digit barcodes.
- No new sidebar entry or separate Barcode manager.
- Existing DBs keep their old `Item.barcode` data and gain a backfilled child row.

---

## Workstream 3: UOM parity

### Current state

- `UOM.json`: `name`, `isWhole`.
- `UOMConversionItem.json`: `uom` Link to `UOM`, `conversionFactor` Float default `1`.
- `Item.json`: `unit` Link to `UOM`, `uomConversions` Table to `UOMConversionItem`.
- `Item.ts.beforeSync()` already de-duplicates `uomConversions` by `uom` and drops non-positive factors.
- `InventorySettings.enableUomConversions` gates the feature.
- `WeightEnabledBarcode.vue` / `POS.vue` switch on `unit` strings (`Kg`, `Gram`, `Unit`, `Meter`, `Hour`, `Day`).

### Proposed changes

1. Keep the existing `name` primary-key model; do **not** attempt a `serial_no`-style PK change.
2. Add parity fields only where they change behavior:
   - `UOM.mustBeWholeNumber` / keep `isWhole` as the existing boolean and document the mapping;
   - `UOMConversionItem` validation for positive `conversionFactor` and unique `uom` per item;
   - `Item.unit` and `uomConversions` hidden/required maps driven by `enableUomConversions`.
3. Replace hard-coded unit-name switches in barcode parsing with a helper that uses `UOM.isWhole` and the item's conversion factors, while preserving current `Kg`/`Gram` behavior for legacy data.
4. Add tests for whole-number UOMs, conversion factors, and weight-barcode quantity rounding.

### Files

- `schemas/app/UOM.json`
- `schemas/app/inventory/UOMConversionItem.json`
- `schemas/app/Item.json`
- `models/baseModels/Item/Item.ts`
- `src/utils/barcodes.ts`
- `src/components/Controls/WeightEnabledBarcode.vue`
- `tests/testUomParity.spec.ts` (new)

### Acceptance

- Whole-number UOMs reject fractional quantities.
- Conversion factors are positive and unique per item/UOM.
- Weight barcode quantity uses the configured UOM rather than a hard-coded string switch.
- No new UOM manager or sidebar root.

---

## Workstream 4: POS stock validator

### Current state

Stock checks are duplicated and inconsistent:

- `POS.vue.addItem()` checks `itemQtyMap[itemName]?.availableQty <= 0`, then calls `validateQty()` from `models/helpers.ts`.
- `models/helpers.ts.getItemQtyMap()` builds `ItemQtyMap` from `StockLedgerEntry` rows, valuation method, and POS inventory location.
- `models/helpers.ts.validateQty()` checks batch/quantity against `getItemQtyMap()`.
- `src/utils/pos.ts.validateSinv()` re-checks quantities at final validation using `itemQtyMap`.
- `POS.vue.setItems()` uses `hideUnavailableItems` and `availableQty` to filter the item grid.
- `POS.vue` also calls `fyo.db.getStockQuantity()` directly in batch paths.

### Proposed changes

1. Create one pure validator, e.g. `src/utils/posStock.ts` (or extend `src/utils/pos.ts`), with:
   - `getAvailableQty(itemQtyMap, itemName, batch?)`;
   - `validateAddItemQty(itemQtyMap, item, quantity, existingItems, options)`;
   - `validateInvoiceQty(itemQtyMap, items, isReturn)`.
2. Have `POS.vue.addItem()`, `POS.vue.validate()`, and `models/helpers.validateQty()` call the same helper. Remove duplicated `availableQty <= 0` / `quantity > availableQty` branches.
3. Make the helper location-aware through the existing `getItemQtyMap()` result; do not introduce a second stock query path.
4. Keep `hideUnavailableItems` as a UI filter only, not a validation rule.
5. Add regression tests for: zero stock, quantity greater than available, batch-specific stock, return invoices, non-inventory items, and weight-barcode quantities.

### Files

- `src/utils/pos.ts` and/or `src/utils/posStock.ts` (new)
- `src/pages/POS/POS.vue`
- `models/helpers.ts`
- `src/components/POS/types.ts` (`ItemQtyMap` type)
- `tests/testPosStockValidator.spec.ts` (new)

### Acceptance

- Scan/search, add-item, and final invoice validation all reject the same over-quantity cases with the same message.
- Batch-specific stock is respected.
- Return invoices and non-inventory items bypass stock checks as today.
- No extra click is added to POS.

---

## Workstream 5: Custom-form storage decision

### Current state

- `CustomForm.json` / `CustomField.json` are real DocTypes; `CustomField` is an `isChild` table.
- `DatabaseManager.setRawCustomFields()` reads `CustomField` rows from the company DB and `getSchemas(countryCode, rawCustomFields)` merges them into the runtime schema map.
- `fyo/models/CustomField.ts` and `CustomForm.ts` provide validation, hidden maps, lists, and option checks.
- `src/pages/CustomizeForm/CustomizeForm.vue` currently offers a form-type selector; customizations are per DB.

### Decision

**Keep custom fields/forms stored per company DB.** Do not promote user-defined custom fields into static `schemas/app/*.json`.

Rationale:

- One company per DB is confirmed, so per-DB customization is the correct scope.
- Automatic migration with backups applies to core schema changes; user custom fields should remain data, not schema files.
- The existing `rawCustomFields` merge already works and avoids a second storage path.

**Status:** implemented in CP5; no storage migration.

### Implemented changes

1. Documented the decision here and in `STABILIZATION.md`; no storage migration.
2. Added `backend/database/tests/testCustomFieldsMigration.spec.ts`: a `CustomField` row survives `DatabaseManager.connectToDatabase()` and `db.migrate()`, is loaded into `rawCustomFields` and `getSchemaMap()`, and is absent from the static schema map.
3. Added `src/utils/customForm.ts` and used it from `CustomizeForm.vue`, `CustomField.ts`, and `CustomForm.ts` to exclude `isSingle` / `isChild` schemas plus `ItemBarcode`, `CustomField`, `CustomForm`, `NumberSeries`, `PatchRun`, `SingleValue`, and `SetupWizard`.
4. Deferred any larger Customize Form UI completion; it is not required for Phase 1 barcode/UOM/stock work.

### Files

- `PHASE1_DESIGN.md`, `STABILIZATION.md`
- `src/utils/customForm.ts` (new)
- `backend/database/tests/testCustomFieldsMigration.spec.ts` (new)
- `src/pages/CustomizeForm/CustomizeForm.vue`
- `fyo/models/CustomField.ts`
- `fyo/models/CustomForm.ts`

---

## Migration and versioning

- Current app version: `0.37.0` (`package.json`); DB version is stored in `SingleValue` as `SystemSettings.version` via `src/utils/initialization.ts:setVersion()`.
- `DatabaseManager.#executeMigration()` reads that value, selects `PatchRun`-gated patches from `backend/patches/index.ts`, creates a backup in `backups/`, runs pre-patches, calls `db.migrate()`, then runs post-patches.
- Phase 1 patches should use a new version above `0.37.0` (for example `0.38.0`) and be added to `backend/patches/index.ts` with `version` and optional `priority`.
- Strict automatic migration means: no opt-in UI, no manual step, backup before migration, `PRAGMA foreign_key_check` after rebuilds, and a loud error on corruption.
- Any new required column must either have a schema default or be covered by the pass-3 `#getMissingFieldFallback()` behavior.
- Do not add FTS5 tables or Bree jobs.

## UI / UX rules

- One always-focused POS scan/search field: the existing `MultiLabelLink` in `ClassicPOS.vue` / `ModernPOS.vue`.
- One scan/Enter adds the item; weight barcode sets quantity.
- Inline child tables via `Table.vue` / `CommonFormSection.vue`; no new modal per barcode/UOM row.
- Reuse `PageHeader`, `Button`, `DropdownWithActions`, `StatusPill`, `Toast`, `FormControl`, `CommonForm`, `LinkedEntries`, `QuickView`, Feather icons, `colors.json`, Tailwind dark mode and RTL.
- Translatable labels via `t\`...\``.
- Errors inline or toast; no silent fallback to the wrong item.
- Smart defaults and contextual actions; no extra click.
- Generic `/edit/:schemaName/:name` and `/list/:schemaName` routes; no new sidebar root per DocType.

## Verification plan per checkpoint

Each small implementation checkpoint must run:

```bash
# Locked toolchain, direct-Node tape suite (see STABILIZATION.md for /tmp/test-setup.js)
mapfile -t specs < <(find . -path ./node_modules -prune -o -name '*.spec.ts' -print | sort)
IS_TEST=true TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' TS_NODE_TRANSPILE_ONLY=true \
  node -r /tmp/test-setup.js -r ts-node/register -r tsconfig-paths/register \
    ./node_modules/.bin/tape "${specs[@]}" | ./node_modules/.bin/tap-spec

npx eslint . --ext ts,vue
npx vue-tsc --noEmit --pretty false
npx prettier --check <changed files>
node build/scripts/build.mjs --nopackage
```

New regression specs:

- `tests/testBarcodes.spec.ts`
- `tests/testUomParity.spec.ts`
- `tests/testPosStockValidator.spec.ts`
- `backend/database/tests/testItemBarcodeMigration.spec.ts`
- `backend/database/tests/testCustomFieldsMigration.spec.ts`

Existing migration suites `backend/database/tests/testMigration.spec.ts` and `backend/database/tests/testSyntheticBrokenDatabases.spec.ts` must stay green.

## Implementation checkpoints (CP4/CP5 order confirmed)

1. **CP1 — `itemWeightDigits` + single barcode helper.** Add the setting, extract `src/utils/barcodes.ts`, wire/refactor `Barcode.vue` / `WeightEnabledBarcode.vue` / `CommonForm.vue` / `POS.vue`, add barcode tests.
2. **CP2 — Item Barcode child table.** Add `ItemBarcode.json`, register schema/enum, add `Item.barcodes`, backfill patch, duplicate validation, multi-barcode POS resolution, migration test.
3. **CP3 — UOM parity.** Add UOM/conversion validation and replace hard-coded unit switches; add UOM tests.
4. **CP4 — POS stock validator.** Extract the shared validator, remove duplicate checks, add stock tests.
5. **CP5 — Custom-form decision.** Document/test per-DB storage, tighten exclusions; no storage migration.

Each checkpoint has its own commit and push on `arena/a27de3bc-books`. A `phase-1` series of tags is optional; no checkpoint tag was created. PR #1 was merged as `f7b0f81`.

## Open items / residual risk

- GitHub issue creation is still blocked by missing `issues=write`; the six templates remain in `STABILIZATION.md`, and the detailed critical-upstream tracker is `UPSTREAM_CRITICAL_ISSUES.md`. P0/P1 stabilization should be reproduced and fixed before new features.
- A real broken company `.db` is optional evidence for upstream P0 reports; pass-3 synthetic coverage is not a real-user reproduction.
- P1 accounting/inventory issues still need concrete transaction data.
- Release policy (#1515), ARM64 packaging (#1513), and Electron 22 (#1516) remain separate platform work.
- Licensing: local Books is AGPL-3.0-only; `erpnext_malaysia` is GPL-3.0. Reimplement semantics or keep any e-invoice component separate; review compatibility before copying verbatim.
- Phase 2–5 remain: Company/Item Price/Contact/Country/linked panes; tax templates/stored statuses; serial/batch FIFO/duplicate/return lifecycle; Malaysia SST/UBL then optional MyInvois.

## Next action

After approval of this design note **and confirmation of the proposed checkpoint order**, begin **CP1** with a small commit: add `itemWeightDigits` to `POSSettings.json`, create `src/utils/barcodes.ts`, and add `tests/testBarcodes.spec.ts`. No Item Barcode child-table schema changes until CP1 is verified.
