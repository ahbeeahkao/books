import { createRequire } from 'module';
import { existsSync } from 'fs';

const rootRequire = createRequire(new URL('../package.json', import.meta.url));

const expected = {
  vue: '3.2.40',
  '@vue/compiler-sfc': '3.2.40',
  typescript: '4.6.2',
  'vue-tsc': '1.6.5',
  prettier: '2.4.1',
  eslint: '8.43.0',
  tape: '5.6.1',
  'ts-node': '10.7.0',
  'tsconfig-paths': '3.14.1',
  'better-sqlite3': '9.6.0',
};

const failures = [];
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  failures.push(`Node ${process.versions.node} is unsupported; use Node 20+`);
}

if (!existsSync(new URL('../yarn.lock', import.meta.url))) {
  failures.push('yarn.lock is missing; install from the locked toolchain');
}

if (existsSync(new URL('../package-lock.json', import.meta.url))) {
  failures.push('package-lock.json is present; use yarn.lock for this fork');
}

function packageVersion(name) {
  try {
    return rootRequire(`${name}/package.json`).version;
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
