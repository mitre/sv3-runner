// Functional tests for the CLI contract of setup.mjs / run.mjs (card sv3-runner-tu5.5).
//
// The scripts derive PROJECT_DIR from their own location (join(__dirname, '..')),
// so we isolate by copying scripts/ into a fresh temp sandbox and spawning the REAL
// scripts from there — their PROJECT_DIR becomes the sandbox, never the real repo.
// No network, no download, no native rebuild, no mutation of the working tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, cpSync } from 'fs';
import os from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { sqlite3BinaryPath } from '../../scripts/lib/sv3.mjs';

const REPO_SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');

// Fresh isolated project root with a byte-for-byte copy of the real scripts/.
function makeSandbox() {
  const dir = mkdtempSync(join(os.tmpdir(), 'sv3-cli-'));
  cpSync(REPO_SCRIPTS, join(dir, 'scripts'), { recursive: true });
  return dir;
}

// Spawn a script in the sandbox with the SAME node binary; never throws on non-zero.
function runScript(sandbox, scriptName, args = []) {
  const res = spawnSync(process.execPath, [join(sandbox, 'scripts', scriptName), ...args], {
    cwd: sandbox,
    encoding: 'utf-8',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

// Stage a fake built sqlite3 binary at the exact path sqlite3BinaryPath computes.
function stageBinary(sandbox) {
  const bin = sqlite3BinaryPath(join(sandbox, 'sv3-app'), os.platform(), os.arch());
  mkdirSync(dirname(bin), { recursive: true });
  writeFileSync(bin, 'FAKE-SQLITE3');
  return bin;
}

test('setup --help prints usage and exits 0', () => {
  const sb = makeSandbox();
  try {
    const r = runScript(sb, 'setup.mjs', ['--help']);
    assert.equal(r.status, 0);
    assert.match(
      r.stdout,
      /sv3-runner setup — Extract and configure STIG Viewer 3 for any platform/,
    );
    assert.match(r.stdout, /--help, -h {2}Show this help/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup --status reports nothing present in an empty project', () => {
  const sb = makeSandbox();
  try {
    const r = runScript(sb, 'setup.mjs', ['--status']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /SV3 zip: .*✗ not found/);
    assert.match(r.stdout, /sv3-app\/: .*✗ not extracted/);
    assert.match(r.stdout, /node_modules\/: .*✗ not installed/);
    assert.match(r.stdout, /sqlite3 binary: .*✗ not built for/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup --status detects a staged zip in downloads/', () => {
  const sb = makeSandbox();
  try {
    mkdirSync(join(sb, 'downloads'), { recursive: true });
    writeFileSync(join(sb, 'downloads', 'U_STIGViewer-linux_x64-3-7-0.zip'), 'ZIP');
    const r = runScript(sb, 'setup.mjs', ['--status']);
    assert.match(r.stdout, /SV3 zip: .*✓ .*U_STIGViewer-linux_x64-3-7-0\.zip/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup --status detects an extracted sv3-app/', () => {
  const sb = makeSandbox();
  try {
    mkdirSync(join(sb, 'sv3-app'), { recursive: true });
    const r = runScript(sb, 'setup.mjs', ['--status']);
    assert.match(r.stdout, /sv3-app\/: .*✓ extracted/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup --status detects a built sqlite3 binary', () => {
  const sb = makeSandbox();
  try {
    stageBinary(sb);
    const r = runScript(sb, 'setup.mjs', ['--status']);
    assert.match(r.stdout, new RegExp(`sqlite3 binary: .*✓ ${os.platform()}-${os.arch()}`));
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup --clean removes sv3-app/ and node_modules/ (temp fixture only) and exits 0', () => {
  const sb = makeSandbox();
  try {
    mkdirSync(join(sb, 'sv3-app', 'sub'), { recursive: true });
    mkdirSync(join(sb, 'node_modules', 'electron'), { recursive: true });
    const r = runScript(sb, 'setup.mjs', ['--clean']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Removing sv3-app\/\.\.\./);
    assert.match(r.stdout, /Removing node_modules\/\.\.\./);
    assert.match(r.stdout, /Clean\. Run `npm run setup` to rebuild\./);
    assert.equal(existsSync(join(sb, 'sv3-app')), false);
    assert.equal(existsSync(join(sb, 'node_modules')), false);
    // --clean must NOT touch the scripts (the code) — only the two artifact dirs.
    assert.equal(existsSync(join(sb, 'scripts', 'setup.mjs')), true);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('setup skips every step when all artifacts already exist (idempotent, no heavy work)', () => {
  const sb = makeSandbox();
  try {
    mkdirSync(join(sb, 'sv3-app'), { recursive: true });
    mkdirSync(join(sb, 'node_modules', 'electron'), { recursive: true });
    stageBinary(sb);
    const r = runScript(sb, 'setup.mjs', []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Step 1: sv3-app\/ exists, skipping/);
    assert.match(r.stdout, /Step 2: Dependencies installed, skipping/);
    assert.match(
      r.stdout,
      new RegExp(`Step 3: sqlite3 binary exists for ${os.platform()}-${os.arch()}, skipping`),
    );
    assert.match(r.stdout, /=== Setup complete ===/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('run.mjs exits non-zero with setup guidance when sv3-app/ is missing', () => {
  const sb = makeSandbox();
  try {
    const r = runScript(sb, 'run.mjs', []);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ERROR: sv3-app\/ not found\. Run `npm run setup` first\./);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});
