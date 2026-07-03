// Unit tests for the dependency-injected setup pipeline (card sv3-runner-tu5.3).
// Shell-out steps are tested by asserting the EXACT command string issued to an
// injected `run` spy — no mocks, no network, no real rebuild. patchSqlite is pure
// filesystem, so it gets a real-fs test against a temp directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import { join } from 'path';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';

import {
  extractApp,
  installDeps,
  buildSqlite,
  patchSqlite,
  ExtractError,
} from '../../scripts/lib/pipeline.mjs';
import { sqlite3TargetDir, sqlite3BinaryPath } from '../../scripts/lib/sv3.mjs';

test('extractApp issues unzip then asar with exact commands (non-win32)', () => {
  const calls = [];
  const run = (cmd, opts) => calls.push({ cmd, opts });
  const tempDir = join(os.tmpdir(), `sv3-pipeline-extract-${process.pid}`);
  extractApp({ sv3Zip: '/dl/SV3.zip', appDir: '/app', tempDir, platform: 'linux', run });
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].cmd,
    `unzip -q "/dl/SV3.zip" "stig_viewer_3-linux-x64/resources/*" -d "${tempDir}"`,
  );
  assert.equal(
    calls[1].cmd,
    `npx @electron/asar extract "${join(tempDir, 'stig_viewer_3-linux-x64', 'resources', 'app.asar')}" "/app"`,
  );
});

test('extractApp uses PowerShell Expand-Archive on win32', () => {
  const calls = [];
  const run = (cmd) => calls.push(cmd);
  const tempDir = join(os.tmpdir(), `sv3-pipeline-extract-win-${process.pid}`);
  extractApp({ sv3Zip: '/dl/SV3.zip', appDir: '/app', tempDir, platform: 'win32', run });
  assert.equal(
    calls[0],
    `powershell -Command "Expand-Archive -Path '/dl/SV3.zip' -DestinationPath '${tempDir}' -Force"`,
  );
});

test('extractApp throws ExtractError when the decompress command fails', () => {
  const run = (cmd) => {
    if (cmd.startsWith('unzip') || cmd.startsWith('powershell'))
      throw new Error('no unzip installed');
  };
  const tempDir = join(os.tmpdir(), `sv3-pipeline-extract-fail-${process.pid}`);
  assert.throws(
    () => extractApp({ sv3Zip: '/dl/SV3.zip', appDir: '/app', tempDir, platform: 'linux', run }),
    ExtractError,
  );
});

test('installDeps runs npm install in projectDir', () => {
  const calls = [];
  const run = (cmd, opts) => calls.push({ cmd, opts });
  installDeps({ projectDir: '/proj', run });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'npm install');
  assert.deepEqual(calls[0].opts, { cwd: '/proj' });
});

test('buildSqlite rebuilds sqlite3 against the given Electron version', () => {
  const calls = [];
  const run = (cmd, opts) => calls.push({ cmd, opts });
  buildSqlite({ electronVersion: '40.1.0', projectDir: '/x', run });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'npx @electron/rebuild -f -w sqlite3 -v 40.1.0');
  assert.deepEqual(calls[0].opts, { cwd: '/x' });
});

test('patchSqlite copies the built binary to the sqlite3-offline-next target path', () => {
  const base = mkdtempSync(join(os.tmpdir(), 'sv3-patch-'));
  try {
    const appDir = join(base, 'sv3-app');
    const srcDir = join(base, 'built');
    mkdirSync(srcDir, { recursive: true });
    const builtBinary = join(srcDir, 'node_sqlite3.node');
    writeFileSync(builtBinary, 'FAKEBINARY');

    // target paths come from lib/sv3.mjs (same helpers setup.mjs uses) — DRY.
    const targetDir = sqlite3TargetDir(appDir, 'linux', 'x64');
    const targetBinary = sqlite3BinaryPath(appDir, 'linux', 'x64');

    patchSqlite({ builtBinary, targetDir, targetBinary });

    assert.equal(existsSync(targetBinary), true);
    assert.equal(readFileSync(targetBinary, 'utf-8'), 'FAKEBINARY');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
