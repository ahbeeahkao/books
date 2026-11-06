# Later-Phase Plan

**Date:** 2026-11-07
**Branch:** `arena/9ef0fb7f-books`
**Open PR:** [#2 — Stabilize fork against critical upstream issues](https://github.com/ahbeeahkao/books/pull/2)

## Decisions

- Continue on the fixed branch and extend PR #2 with new commits.
- Work through the later-phase list sequentially.
- Upstream attachment retrieval is limited by the sandbox outbound allowlist. The #819 `test.books.db.zip` redirects from `github.com` to `objects.githubusercontent.com`, which is not reachable here; other upstream issues mostly contain screenshots rather than downloadable `.db`/CSV fixtures.
- Until real user samples are uploaded, use representative databases and transaction data generated from documented issue steps, clearly labelled **synthetic issue-step reproduction**, not real-user evidence.
- Upgrade Electron to the latest stable release reported by the npm registry: **Electron `45.2.3`**.
- Use **minimal native-desktop polish** for visual/UX work: no broad design system, no new dependency-heavy UI, and no change to the one-company-per-DB rule.

## Sequential checkpoints

1. **P0 DB evidence — #1536, #1351, #1291, #1546**

   - Generate small SQLite company DBs from the documented broken shapes.
   - Run them through the same `DatabaseCore.migrate()` / `DatabaseManager` path the app uses.
   - Label all results synthetic; keep the real broken-`.db` gate open.

2. **Reconciliation fixtures — #1394, #1410, #1541, #842, #1431, #1535**

   - Build deterministic ledger, fiscal-year, stock-ledger, pricing-rule, and COA fixtures from issue descriptions.
   - Compare report/filter outputs to expected values where the issue provides them.
   - Keep fixtures small and generated at runtime; do not commit binary databases or large CSVs.

3. **Platform — #1102, #1413, #1513, #1516**

   - Upgrade Electron and packaging dependencies to supported versions.
   - Add native-module architecture verification for x64/arm64 artifacts.
   - Add Linux desktop sandbox guidance/config and CI gates.
   - Document that local sandbox cannot produce cross-platform packaged smoke tests.

4. **Release policy — #1515, #1395, #1551**

   - Record fork version/tag/release policy.
   - Guard RPM uninstall alternatives scriptlets.
   - State the Flatpak/Flathub support boundary explicitly.

5. **Minimal native UX — visual redesign, new sidebar roots, extra POS clicks**
   - Keep the existing native desktop visual language.
   - Add clear functional roots/actions only.
   - Avoid extra confirmation steps in core POS flows unless they prevent data loss.

## Non-goals for this phase

- No claim that upstream GitHub issues are closed.
- No merge of PR #2 unless explicitly requested.
- No GitHub issue creation until `issues=write` is available.
- No FTS5 tables or scheduled jobs.
- No direct MyInvois API/GPL component copying.
- No broad visual redesign or new DocTypes before stabilization/platform gates are recorded.

## Checkpoint progress

| Checkpoint | Status                                     | Evidence                                                                                     |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1          | **Synthetic issue-step reproduction done** | `LATER_PHASE_EVIDENCE.md`; 48/48 targeted assertions; real broken-`.db` gate remains open.   |
| 2          | **Synthetic reconciliation fixtures done** | `LATER_PHASE_EVIDENCE.md`; 29/29 targeted assertions; real reconciliation data remains open. |
| 3          | **Platform policy/gates implemented**      | `LATER_PHASE_EVIDENCE.md`; 11/11 targeted assertions; real packaged smoke tests remain open. |
| 4          | Pending                                    | Version/tag/release policy, RPM scriptlet guard, Flatpak/Flathub boundary.                   |
| 5          | Pending                                    | Minimal native-desktop UX, functional roots, and no extra core POS confirmation clicks.      |
