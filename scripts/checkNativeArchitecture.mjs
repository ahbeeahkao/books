#!/usr/bin/env node
import {
  closeSync,
  existsSync,
  openSync,
  readSync,
  readdirSync,
  statSync,
} from 'fs';
import path from 'path';

/**
 * Checks that every unpacked native `.node` file inside a packaged Linux
 * Electron app matches the target CPU architecture. This catches x86_64
 * better-sqlite3 binaries accidentally shipped inside an ARM64 package.
 */

const ELF_MACHINES = {
  x64: 62, // EM_X86_64
  arm64: 183, // EM_AARCH64
};

function parseArgs(argv) {
  const options = { arch: '', dir: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--arch' && value) {
      options.arch = value;
      index += 1;
    } else if (flag === '--dir' && value) {
      options.dir = value;
      index += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }

  if (!options.arch || !options.dir) {
    throw new Error('usage: --arch <x64|arm64> --dir <unpacked app directory>');
  }

  if (!Object.hasOwn(ELF_MACHINES, options.arch)) {
    throw new Error(`unsupported architecture: ${options.arch}`);
  }

  return options;
}

function findNodeFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      files.push(...findNodeFiles(entryPath));
    } else if (entryPath.endsWith('.node')) {
      files.push(entryPath);
    }
  }

  return files;
}

function getElfMachine(filePath) {
  const fd = openSync(filePath, 'r');
  const header = Buffer.alloc(20);
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }

  if (
    header[0] !== 0x7f ||
    header[1] !== 0x45 ||
    header[2] !== 0x4c ||
    header[3] !== 0x46
  ) {
    return null;
  }

  if (header[5] === 1) {
    return header.readUInt16LE(18);
  }

  if (header[5] === 2) {
    return header.readUInt16BE(18);
  }

  return null;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.dir)) {
    throw new Error(`directory does not exist: ${options.dir}`);
  }

  const expectedMachine = ELF_MACHINES[options.arch];
  const files = findNodeFiles(options.dir);
  if (files.length === 0) {
    throw new Error(`no unpacked native .node files found in ${options.dir}`);
  }

  const failures = [];
  for (const file of files) {
    const machine = getElfMachine(file);
    if (machine === null) {
      failures.push(`${file}: not a readable ELF binary`);
    } else if (machine !== expectedMachine) {
      failures.push(
        `${file}: ELF machine ${machine}, expected ${expectedMachine} (${options.arch})`
      );
    }
  }

  if (failures.length) {
    throw new Error(
      `native architecture check failed for ${options.arch}:\n${failures.join(
        '\n'
      )}`
    );
  }

  console.log(
    `Native architecture check passed: ${files.length} .node file(s) match ${options.arch}.`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
