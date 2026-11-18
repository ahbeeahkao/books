# Linux desktop sandbox guidance

**Applies to:** Electron 45.2.3 and newer Linux packages of this fork.

Electron's Chromium sandbox normally depends on unprivileged user namespaces. Some Ubuntu 24.04 / hardened Linux installations restrict those namespaces, which can make a packaged app stall before the first window appears. This fork keeps the Chromium sandbox **enabled by default**.

## Preferred fixes

1. Keep the system's unprivileged user namespaces enabled:

   ```sh
   sysctl kernel.apparmor_restrict_unprivileged_userns
   sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
   ```

2. Use a distribution package or AppImage launched from a normal writable local directory. Avoid running the database directly from a read-only mount, network share, or sync-service virtual filesystem.
3. If a system policy blocks the sandbox, install an AppArmor/SELinux profile appropriate for the local environment rather than disabling Chromium isolation globally.

## Explicit local fallback

If a Linux desktop launch still stalls and the security trade-off is understood, opt in for a single launch:

```sh
BOOKS_DISABLE_CHROMIUM_SANDBOX=1 ./Frappe-Books-v0.37.0-linux-x64.AppImage
```

Accepted opt-in values are `1`, `true`, and `yes`. On other platforms the variable is ignored. `main.ts` translates the opt-in to Chromium's `--no-sandbox` switch before app startup.

Disabling the sandbox reduces browser-process isolation. Do not set this variable system-wide, and do not use it as the default in packaged desktop files, CI, or launchers. It is a diagnostic fallback, not a security fix.

## Packaged verification boundary

This Arena sandbox can build renderer/main-process sources but cannot launch real Linux x64 or ARM64 Electron packages. `.github/workflows/platform.yml` is a manual native-runner gate that packages each architecture and runs `scripts/checkNativeArchitecture.mjs` against `app.asar.unpacked`. It has not been executed in this sandbox, so no packaged launch smoke test is claimed here.
