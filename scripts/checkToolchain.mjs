import { existsSync, readFileSync } from 'fs';

const expected = {
  electron: '45.2.3',
  'electron-builder': '26.18.0',
  '@electron/rebuild': '4.2.1',
  'electron-updater': '6.8.11',
  vue: '3.2.40',
  '@vue/compiler-sfc': '3.2.40',
  typescript: '4.6.2',
  'vue-tsc': '1.6.5',
  prettier: '2.4.1',
  eslint: '8.43.0',
  tape: '5.6.1',
  'ts-node': '10.7.0',
  'tsconfig-paths': '3.14.1',
  'better-sqlite3': '13.0.3',
};

const failures = [];
const [nodeMajor, nodeMinor] = process.versions.node
  .split('.')
  .map((part) => Number(part));
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  failures.push(
    `Node ${process.versions.node} is unsupported; Electron 45 requires Node 22.12+`
  );
}

if (!existsSync(new URL('../yarn.lock', import.meta.url))) {
  failures.push('yarn.lock is missing; install from the locked toolchain');
}

if (existsSync(new URL('../package-lock.json', import.meta.url))) {
  failures.push('package-lock.json is present; use yarn.lock for this fork');
}

function packageVersion(name) {
  const packageJsonPath = new URL(
    `../node_modules/${name}/package.json`,
    import.meta.url
  );
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

for (const [name, version] of Object.entries(expected)) {
  const actual = packageVersion(name);
  if (actual === version) {
    continue;
  }

  failures.push(`${name}: expected ${version}, found ${actual ?? 'missing'}`);
}

if (failures.length) {
  console.error('Toolchain preflight failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(
    '\nInstall the exact locked specs described in STABILIZATION.md.'
  );
  process.exit(1);
}

console.log('Toolchain preflight passed.');
