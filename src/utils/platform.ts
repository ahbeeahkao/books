/**
 * Linux desktop startup guard for Electron 45.
 *
 * Ubuntu 24.04 can restrict unprivileged user namespaces, which may make
 * Chromium's sandbox stall during app launch. The fork does not disable the
 * sandbox by default; a Linux operator must explicitly opt in through the
 * environment variable below.
 */

export const CHROMIUM_SANDBOX_OVERRIDE_ENV = 'BOOKS_DISABLE_CHROMIUM_SANDBOX';

export function shouldDisableChromiumSandbox(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (platform !== 'linux') {
    return false;
  }

  const value = (env[CHROMIUM_SANDBOX_OVERRIDE_ENV] ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export type ZoomAction = 'zoomIn' | 'zoomOut' | 'resetZoom' | null;

export interface KeyboardShortcutInput {
  type?: string;
  key: string;
  code?: string;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Pure keyboard mapping for native zoom shortcuts. Electron's InputEvent is
 * structurally compatible, but this helper stays independent from Electron so
 * the mapping can be tested without launching a desktop window.
 */
export function getZoomActionFromKeyboardEvent(
  input: KeyboardShortcutInput
): ZoomAction {
  if (input.type && input.type !== 'keyDown') {
    return null;
  }

  if (input.alt || (!input.control && !input.meta)) {
    return null;
  }

  const key = input.key.toLowerCase();
  const code = input.code ?? '';

  if (key === '0' && !input.shift) {
    return 'resetZoom';
  }

  if (key === '+' || key === '=' || key === 'add' || code === 'NumpadAdd') {
    return 'zoomIn';
  }

  if (
    key === '-' ||
    key === '_' ||
    key === 'subtract' ||
    code === 'NumpadSubtract'
  ) {
    return 'zoomOut';
  }

  return null;
}
