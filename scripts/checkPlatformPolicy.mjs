#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';

/**
 * Static platform gate for the Electron 45 / Linux packaging work. It does not
 * claim to launch a packaged app; real Linux x64/ARM64 smoke tests run in the
 * manual packaged-architecture workflow on native runners.
 */

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL('package.json', root), 'utf8')
);
const builderConfig = (
  await import(new URL('electron-builder-config.mjs', root))
).default;

const failures = [];
const expectedVersions = {
  electron: '45.2.3',
  'electron-builder': '26.18.0',
  '@electron/rebuild': '4.2.1',
  'electron-updater': '6.8.11',
};

for (const [name, expected] of Object.entries(expectedVersions)) {
  const actual = packageJson.devDependencies?.[name];
  if (actual !== expected) {
    failures.push(
      `${name}: expected ${expected}, found ${actual ?? 'missing'}`
    );
  }
}

if (packageJson.scripts?.['rebuild:native'] !== 'electron-rebuild') {
  failures.push('missing rebuild:native script');
}

for (const script of ['check:native-arch', 'check:platform']) {
  if (!packageJson.scripts?.[script]) {
    failures.push(`missing ${script} script`);
  }
}

function getTargetArchs(targetName) {
  const target = builderConfig.linux?.target?.find(
    (entry) => entry.target === targetName
  );
  return target?.arch ?? [];
}

for (const targetName of ['deb', 'AppImage', 'rpm']) {
  const archs = getTargetArchs(targetName);
  for (const arch of ['x64', 'arm64']) {
    if (!archs.includes(arch)) {
      failures.push(`linux ${targetName} target does not include ${arch}`);
    }
  }
}

const requiredPaths = [
  'scripts/checkNativeArchitecture.mjs',
  'scripts/checkPlatformPolicy.mjs',
  'src/utils/platform.ts',
  'LINUX_SANDBOX.md',
  '.github/workflows/platform.yml',
];
for (const requiredPath of requiredPaths) {
  if (!existsSync(new URL(requiredPath, root))) {
    failures.push(`missing ${requiredPath}`);
  }
}

const lockSource = readFileSync(new URL('yarn.lock', root), 'utf8');
const lockKeys = new Set(
  lockSource
    .split('\n')
    .filter((line) => line.endsWith(':') && !line.startsWith(' '))
    .flatMap((line) =>
      line
        .slice(0, -1)
        .split(', ')
        .map((key) => key.trim().replace(/^"|"$/g, ''))
    )
);
for (const entry of [
  'electron@45.2.3',
  'electron-builder@26.18.0',
  '@electron/rebuild@4.2.1',
  'electron-updater@6.8.11',
]) {
  if (!lockKeys.has(entry)) {
    failures.push(`yarn.lock is missing direct entry ${entry}:`);
  }
}

const mainSource = readFileSync(new URL('main.ts', root), 'utf8');
if (!mainSource.includes('shouldDisableChromiumSandbox')) {
  failures.push('main process is missing the Linux sandbox opt-in guard');
}

const platformSource = readFileSync(
  new URL('src/utils/platform.ts', root),
  'utf8'
);
if (!platformSource.includes('BOOKS_DISABLE_CHROMIUM_SANDBOX')) {
  failures.push('Linux sandbox environment override is missing');
}

const workflowNames = ['build.yml', 'lint.yml', 'publish.yml', 'test.yml'];
for (const workflowName of workflowNames) {
  const source = readFileSync(
    new URL(`.github/workflows/${workflowName}`, root),
    'utf8'
  );
  if (!source.includes("node-version: '22.14.0'")) {
    failures.push(`${workflowName} is not pinned to Node 22.14.0`);
  }
}

if (failures.length) {
  console.error('Platform policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Platform policy check passed.');
