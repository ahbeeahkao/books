import { existsSync, readFileSync } from 'fs';

const root = new URL('../', import.meta.url);
const read = (relativePath) =>
  readFileSync(new URL(relativePath, root), 'utf8');
const failures = [];

const packageJson = JSON.parse(read('package.json'));
const config = read('electron-builder-config.mjs');
const publishWorkflow = read('.github/workflows/publish.yml');
const policy = read('RELEASE_POLICY.md');
const afterRemove = read('build/scripts/linux/after-remove.sh');
const afterRemovePath = new URL('build/scripts/linux/after-remove.sh', root);

if (!existsSync(afterRemovePath)) {
  failures.push('RPM after-remove scriptlet is missing');
}

if (!String(packageJson.repository?.url).includes('ahbeeahkao/books')) {
  failures.push('package.json repository must point to the fork');
}

if (
  packageJson.scripts?.['check:release'] !==
  'node scripts/checkReleasePolicy.mjs'
) {
  failures.push('package.json is missing the check:release script');
}

const ciRef = process.env.GITHUB_REF || '';
const isMaster = ciRef === 'refs/heads/master';
const isForkTag = /^refs\/tags\/v\d+\.\d+\.\d+-fork\.\d+$/.test(ciRef);
if (ciRef && !isMaster && !isForkTag) {
  failures.push(
    `publishing from ${ciRef} is forbidden; use master or a vX.Y.Z-fork.N tag`
  );
}

for (const marker of [
  'v0.37.0-fork.N',
  'No Flathub manifest',
  'update-alternatives',
  'Flatpak / Flathub boundary',
]) {
  if (!policy.includes(marker)) {
    failures.push(`RELEASE_POLICY.md is missing: ${marker}`);
  }
}

if (!config.includes("afterRemove: 'build/scripts/linux/after-remove.sh'")) {
  failures.push(
    'electron-builder rpm.afterRemove is not wired to the guarded scriptlet'
  );
}
if (/target:\s*['"]flatpak['"]/.test(config)) {
  failures.push(
    'Flatpak target requires a separate maintained-package checkpoint'
  );
}
if (
  config.includes('build/installericon.ico') ||
  config.includes('build/uninstallericon.ico')
) {
  failures.push('Windows installer icon paths must match camelCase filenames');
}
if (!publishWorkflow.includes('workflow_dispatch')) {
  failures.push('publish workflow must remain manually dispatched');
}
for (const preflight of [
  'yarn check:toolchain',
  'yarn check:platform',
  'yarn check:release',
]) {
  if (!publishWorkflow.includes(preflight)) {
    failures.push(`publish workflow is missing preflight: ${preflight}`);
  }
}

if (!afterRemove.includes('update-alternatives --query')) {
  failures.push(
    'after-remove scriptlet must query alternatives before removal'
  );
}
if (/^\s*set\s+-e/m.test(afterRemove)) {
  failures.push('after-remove scriptlet must not use set -e');
}
const afterRemoveCodeLines = afterRemove
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'));
for (const line of afterRemoveCodeLines) {
  if (
    line.includes('update-alternatives --remove') &&
    !line.includes('|| true')
  ) {
    failures.push(
      'unguarded update-alternatives --remove would fail package removal'
    );
  }
}
if (!afterRemove.includes('exit 0')) {
  failures.push('after-remove scriptlet must always exit zero');
}

if (failures.length) {
  console.error('Release policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Release policy check passed.');
