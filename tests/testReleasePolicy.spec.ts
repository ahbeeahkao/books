import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'tape';

/**
 * Checkpoint 4 release-policy coverage. These are static CI gates and synthetic
 * command stubs; no tag, GitHub Release, RPM package, or Flathub listing is
 * created here.
 */

const releasePolicyScript = path.resolve('scripts/checkReleasePolicy.mjs');
const afterRemoveScript = path.resolve('build/scripts/linux/after-remove.sh');

function runReleasePolicy(ref: string): {
  status: number | null;
  stdout: string;
} {
  const result = spawnSync(process.execPath, [releasePolicyScript], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF: ref },
  });
  return { status: result.status, stdout: result.stdout || '' };
}

function writeFakeAlternatives(dir: string, queryStatus: number) {
  fs.mkdirSync(dir, { recursive: true });
  const script = `#!/bin/sh
case "$1" in
  --query)
    echo 'Name: frappe-books'
    echo 'Alternative: /opt/Frappe Books/frappe-books'
    exit ${queryStatus}
    ;;
  --remove)
    echo 'frappe-books has not been configured as an alternative' >&2
    exit 2
    ;;
esac
exit 0
`;
  const file = path.join(dir, 'update-alternatives');
  fs.writeFileSync(file, script);
  fs.chmodSync(file, 0o755);
}

function runAfterRemove(fakeBin: string): number | null {
  const result = spawnSync('bash', [afterRemoveScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
    },
  });
  return result.status;
}

test('release policy allows local checks, master, and fork tags', (t) => {
  t.ok(
    runReleasePolicy('').stdout.includes('Release policy check passed'),
    'local check passes without a CI ref'
  );
  t.ok(
    runReleasePolicy('refs/heads/master').stdout.includes(
      'Release policy check passed'
    ),
    'master is an allowed release ref'
  );
  t.ok(
    runReleasePolicy('refs/tags/v0.37.0-fork.1').stdout.includes(
      'Release policy check passed'
    ),
    'fork release tags are allowed'
  );
  t.end();
});

test('release policy rejects feature branches and upstream tags', (t) => {
  t.notEqual(
    runReleasePolicy('refs/heads/arena/9ef0fb7f-books').status,
    0,
    'feature branches cannot publish'
  );
  t.notEqual(
    runReleasePolicy('refs/tags/v0.37.0').status,
    0,
    'the unpublished upstream tag cannot be reused'
  );
  t.notEqual(
    runReleasePolicy('refs/pull/2/merge').status,
    0,
    'pull-request refs cannot publish'
  );
  t.end();
});

test('guarded RPM after-remove scriptlet tolerates alternatives errors', (t) => {
  const registeredDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'books-alternatives-registered-')
  );
  const missingDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'books-alternatives-missing-')
  );

  try {
    writeFakeAlternatives(registeredDir, 0);
    writeFakeAlternatives(missingDir, 2);
    t.equal(
      runAfterRemove(registeredDir),
      0,
      'a failed remove call does not fail the scriptlet'
    );
    t.equal(
      runAfterRemove(missingDir),
      0,
      'an unconfigured alternatives query does not fail the scriptlet'
    );
  } finally {
    fs.rmSync(registeredDir, { recursive: true, force: true });
    fs.rmSync(missingDir, { recursive: true, force: true });
  }
  t.end();
});

test('release policy script passes from the default local environment', (t) => {
  const output = execFileSync(process.execPath, [releasePolicyScript], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF: '' },
  });
  t.ok(output.includes('passed'), 'release policy check passes');
  t.end();
});
