# Minimal native-desktop UX boundary

Checkpoint 5 keeps the existing sidebar information architecture and makes two small desktop affordances clear. It does **not** redesign the application, add dependencies, create a new sidebar root, or add a POS confirmation step.

## Visible sidebar restore control

Upstream #1523 reports that after collapsing the sidebar, users cannot find the control to restore it. The collapsed `Show Sidebar` control was a low-opacity icon that became fully visible only on hover. In `src/pages/Desk.vue` it is now an always-visible control with a background, border, icon, and text label.

The label uses the existing `t` translation helper and is also exposed through `aria-label` and `title`. RTL layout rotates only the chevron icon, not the translated text. The existing hide control in `src/components/Sidebar.vue` remains unchanged.

## Native zoom shortcuts

Upstream #1470 reports that `Ctrl -` can shrink the UI with no obvious way to enlarge it again. `main.ts` now installs a `before-input-event` listener using the pure helper `getZoomActionFromKeyboardEvent` in `src/utils/platform.ts`:

- `Ctrl/Cmd +` or `Ctrl/Cmd =` zooms in.
- `Ctrl/Cmd -` zooms out.
- `Ctrl/Cmd 0` resets zoom.
- Numpad `Add`, `Subtract`, and `0` work with the same modifiers.
- `Alt` combinations, key-up events, and unrelated keys are ignored.

Zoom changes use Electron's `webContents.setZoomLevel` and are bounded to a conservative range. No custom menu labels are introduced; visible UI labels use `t` so they remain translatable.

## Scope and verification boundaries

- No broad visual redesign, dependency-heavy UI, new sidebar root, or new POS confirmation was added.
- `scripts/checkNativeUXPolicy.mjs` statically checks the visible control, translatable label, zoom shortcut wiring, documentation boundary, and script registration.
- `tests/testNativeUX.spec.ts` covers the synthetic keyboard mappings and the static policy gate.
- No packaged Electron app was launched, no screenshot/e2e UI test was recorded, and no upstream issue is marked locally closed.
