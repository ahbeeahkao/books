import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'tape';
import {
  CHROMIUM_SANDBOX_OVERRIDE_ENV,
  shouldDisableChromiumSandbox,
} from '../src/utils/platform';

/**
 * Platform gate coverage for checkpoint 3. The ELF fixtures are tiny synthetic
 * headers; this spec does not claim a packaged Linux/ARM64 app was launched.
 */

const nativeArchitectureScript = path.resolve(
  'scripts/checkNativeArchitecture.mjs'
);
const platformPolicyScript = path.resolve('scripts/checkPlatformPolicy.mjs');

function writeFakeElf(filePath: string, machine: number) {
  const header = Buffer.alloc(20);
  header.write('\x7fELF', 0, 'ascii');
  header[4] = 2; // ELFCLASS64
  header[5] = 1; // little endian
  header.writeUInt16LE(machine, 18);
  fs.writeFileSync(filePath, header);
}

function runArchitectureCheck(arch: string, dir: string): string {
  return execFileSync(
    process.execPath,
    [nativeArchitectureScript, '--arch', arch, '--dir', dir],
    { encoding: 'utf8' }
  );
}

test('Linux Chromium sandbox stays on unless explicitly overridden', (t) => {
  t.notOk(
    shouldDisableChromiumSandbox('linux', {}),
    'Linux default keeps the sandbox enabled'
  );
  t.ok(
    shouldDisableChromiumSandbox('linux', {
      [CHROMIUM_SANDBOX_OVERRIDE_ENV]: '1',
    } as NodeJS.ProcessEnv),
    'explicit Linux environment override is honoured'
  );
  t.ok(
    shouldDisableChromiumSandbox('linux', {
      [CHROMIUM_SANDBOX_OVERRIDE_ENV]: 'true',
    } as NodeJS.ProcessEnv),
    'true override is honoured'
  );
  t.notOk(
    shouldDisableChromiumSandbox('linux', {
      [CHROMIUM_SANDBOX_OVERRIDE_ENV]: '0',
    } as NodeJS.ProcessEnv),
    'zero override does not disable the sandbox'
  );
  t.notOk(
    shouldDisableChromiumSandbox('darwin', {
      [CHROMIUM_SANDBOX_OVERRIDE_ENV]: '1',
    } as NodeJS.ProcessEnv),
    'override is Linux-only'
  );
  t.end();
});

test('native architecture checker accepts matching x64 and arm64 ELF headers', (t) => {
  const x64Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'books-elf-x64-'));
  const arm64Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'books-elf-arm64-'));
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'books-elf-empty-'));
  const invalidDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'books-elf-invalid-')
  );

  try {
    writeFakeElf(path.join(x64Dir, 'better_sqlite3.node'), 62);
    writeFakeElf(path.join(arm64Dir, 'better_sqlite3.node'), 183);
    fs.writeFileSync(path.join(invalidDir, 'not_elf.node'), 'not an ELF file');

    t.ok(
      runArchitectureCheck('x64', x64Dir).includes('passed'),
      'x64 ELF machine 62 passes'
    );
    t.ok(
      runArchitectureCheck('arm64', arm64Dir).includes('passed'),
      'ARM64 ELF machine 183 passes'
    );

    let mismatch = false;
    try {
      runArchitectureCheck('arm64', x64Dir);
    } catch {
      mismatch = true;
    }
    t.ok(mismatch, 'x64 binary fails the ARM64 gate');

    let empty = false;
    try {
      runArchitectureCheck('x64', emptyDir);
    } catch {
      empty = true;
    }
    t.ok(empty, 'missing native module fails closed');

    let invalid = false;
    try {
      runArchitectureCheck('x64', invalidDir);
    } catch {
      invalid = true;
    }
    t.ok(invalid, 'non-ELF native module fails closed');
  } finally {
    for (const dir of [x64Dir, arm64Dir, emptyDir, invalidDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  t.end();
});

test('platform policy gate accepts the Electron 45 and Linux arch policy', (t) => {
  const output = execFileSync(process.execPath, [platformPolicyScript], {
    encoding: 'utf8',
  });
  t.ok(output.includes('passed'), 'platform policy script passes');
  t.end();
});
