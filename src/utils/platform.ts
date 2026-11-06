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
