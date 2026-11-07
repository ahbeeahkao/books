import { readFileSync } from 'fs';

const root = new URL('../', import.meta.url);
const read = (relativePath) =>
  readFileSync(new URL(relativePath, root), 'utf8');
const failures = [];

const packageJson = JSON.parse(read('package.json'));
const deskSource = read('src/pages/Desk.vue');
const sidebarSource = read('src/components/Sidebar.vue');
const platformSource = read('src/utils/platform.ts');
const mainSource = read('main.ts');
const nativeUXDoc = read('NATIVE_UX.md');

if (
  packageJson.scripts?.['check:native-ux'] !==
  'node scripts/checkNativeUXPolicy.mjs'
) {
  failures.push('package.json is missing the check:native-ux script');
}

for (const marker of [
  'data-testid="show-sidebar"',
  'bg-gray-100',
  'border',
  'opacity-100',
  '{{ t`Show Sidebar` }}',
  'aria-label="t`Show Sidebar`"',
  'title="t`Show Sidebar`"',
]) {
  if (!deskSource.includes(marker)) {
    failures.push(`Desk.vue is missing the visible sidebar marker: ${marker}`);
  }
}
if (
  deskSource.includes('opacity-60') ||
  deskSource.includes('hover:opacity-100')
) {
  failures.push('collapsed sidebar control must not be hover-only');
}
if (!deskSource.includes('rtl-rotate-180')) {
  failures.push('collapsed sidebar chevron must retain RTL rotation');
}
if (!sidebarSource.includes('t`Hide Sidebar`')) {
  failures.push('sidebar hide control must keep its translatable label');
}

for (const marker of [
  'export function getZoomActionFromKeyboardEvent',
  'NumpadAdd',
  'NumpadSubtract',
  'resetZoom',
]) {
  if (!platformSource.includes(marker)) {
    failures.push(`platform.ts is missing zoom helper marker: ${marker}`);
  }
}
for (const marker of [
  'getZoomActionFromKeyboardEvent',
  'before-input-event',
  'setZoomLevel',
  'getZoomLevel',
]) {
  if (!mainSource.includes(marker)) {
    failures.push(`main.ts is missing native zoom wiring: ${marker}`);
  }
}

for (const marker of [
  'No broad visual redesign',
  'translatable',
  'no upstream issue is marked locally closed',
]) {
  if (!nativeUXDoc.toLowerCase().includes(marker.toLowerCase())) {
    failures.push(`NATIVE_UX.md is missing boundary: ${marker}`);
  }
}

if (failures.length) {
  console.error('Native UX policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Native UX policy check passed.');
