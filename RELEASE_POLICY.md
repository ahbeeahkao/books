# Fork release policy

This document records the release boundary for the `ahbeeahkao/books` fork. It is a policy and CI gate, **not** a release. No tag or GitHub Release was created in this workspace.

## Version and tag rule

- `package.json` is the source of truth for the application version. The current fork baseline is `0.37.0`, which upstream merged but did not publish as `v0.37.0` (upstream issue #1515).
- Fork releases use `v0.37.0-fork.N`, beginning with `v0.37.0-fork.1`. Never reuse upstream `v0.37.0` or any other upstream tag.
- A version change arrives in its own pull request with a changelog and lockfile review. A tag is pushed from `master` only after that pull request is merged.
- Feature branches, including `arena/*`, never create tags, drafts, or GitHub Releases. `scripts/checkReleasePolicy.mjs` rejects any CI `GITHUB_REF` other than `refs/heads/master` or a `vX.Y.Z-fork.N` tag.
- Publishing targets the fork repository `https://github.com/ahbeeahkao/books.git`, never upstream `frappe/books`.

## Release gate

`.github/workflows/publish.yml` remains manually dispatched. Every platform job runs the toolchain, platform, and release-policy preflights before packaging. A release is allowed only when:

1. Linux, macOS, macOS ARM, and Windows builds succeed and produce the expected artifacts. Electron 45 Windows packaging is x64-only because no `win32-ia32` Electron 45 archive is published. Inspect the first actionable error in each failed job; do not assume a signing-certificate failure.
2. The Linux x64 and ARM64 packaged smoke tests in `.github/workflows/platform.yml` have passed, including native-module architecture checks.
3. Required signing/notarization secrets are available. Missing credentials or a failed platform build blocks the whole release; Linux artifacts are not presented as a complete release on their own.
4. The RPM `%postun` scriptlet has been verified to exit zero when `update-alternatives` was never configured (upstream issue #1395).
5. The release notes identify the fork tag, source commit, platforms, checksums, and any known limitations.

## RPM uninstall scriptlets

Upstream #1395 reports `dnf remove frappe-books` failing its `%postun` scriptlet with exit 2 and `/usr/bin/frappe-books has not been configured as an alternative for frappe-books`. The default electron-builder template calls `update-alternatives --remove` unconditionally.

This fork uses `build/scripts/linux/after-remove.sh` through `rpm.afterRemove`. The script queries the alternatives database before removing a registered path, tolerates removal errors, preserves AppArmor cleanup, and always exits zero. It is intentionally defensive: an incomplete or manually modified installation must not break package removal.

## Flatpak / Flathub boundary

Upstream #1551 reports that `io.frappe.books` is no longer available on Flathub and that the listing says the application is no longer maintained. Restoring a Flathub listing requires a maintained package, verified target-architecture builds, publisher verification from upstream #1144, and a separate Flathub repository/manifest.

This fork does **not** claim Flatpak or Flathub support:

- No `flatpak` target is present in `electron-builder-config.mjs`.
- No Flathub manifest, publisher verification, or listing restoration is included.
- `appId: 'io.frappe.books'` is retained for desktop compatibility only; it is not evidence of Flathub publication.
- Re-enabling Flatpak/Flathub requires a separate checkpoint with a named maintainer and CI build evidence. `scripts/checkReleasePolicy.mjs` fails if a Flatpak target is introduced without that policy being revised.
