// Functional tests for scripts/verify-setup.mjs (card sv3-runner-tu5.8).
//
// verify-setup is the integration-smoke gate: after a real setup, it asserts the
// rebuilt native sqlite3 binary landed where sqlite3-offline-next expects it. The
// path is derived from lib/sv3.mjs (sqlite3BinaryPath) — the SAME helper setup.mjs
// uses to place it — so the check can never drift from where setup writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'fs';
import os from 'os';

import { makeSandbox, runScript, stageBinary } from '../helpers/sandbox.mjs';

test('verify-setup exits non-zero with setup guidance when the sqlite3 binary is absent', () => {
  const sb = makeSandbox();
  try {
    const r = runScript(sb, 'verify-setup.mjs', []);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /sqlite3 native binary not found/);
    assert.match(r.stderr, /npm run setup/);
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});

test('verify-setup exits 0 and reports OK when the sqlite3 binary is present', () => {
  const sb = makeSandbox();
  try {
    stageBinary(sb);
    const r = runScript(sb, 'verify-setup.mjs', []);
    assert.equal(r.status, 0);
    assert.match(
      r.stdout,
      new RegExp(`OK: sqlite3 native binary present for ${os.platform()}-${os.arch()}`),
    );
  } finally {
    rmSync(sb, { recursive: true, force: true });
  }
});
