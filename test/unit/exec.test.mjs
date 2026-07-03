// Unit tests for the centralized command runner (card sv3-runner-tu5.2).
// Exercised with harmless real commands only — no network, no mocks. `node -e`
// is guaranteed present (we are running under node). These pin the exact
// contract setup.mjs's inline run/runCapture had, so the centralization is
// provably behavior-preserving.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { run, runCapture } from '../../scripts/lib/exec.mjs';

test('runCapture returns trimmed stdout on success', () => {
  // console.log emits a trailing newline; runCapture must trim it.
  assert.equal(runCapture(`node -e "console.log('ok')"`), 'ok');
});

test('runCapture returns null on a non-zero exit (soft failure)', () => {
  assert.equal(runCapture(`node -e "process.exit(1)"`), null);
});

test('run echoes the command and returns normally on success', () => {
  const originalLog = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try {
    // stdio:'ignore' overrides the inherit default (also proves opts pass-through)
    // and keeps the child's output out of the test log.
    run(`node -e ""`, { stdio: 'ignore' });
  } finally {
    console.log = originalLog;
  }
  assert.ok(
    lines.some((line) => line.includes('$ node -e ""')),
    'run should echo "  $ <cmd>" before executing',
  );
});

test('run throws on a non-zero exit (loud failure, unlike runCapture)', () => {
  assert.throws(() => run(`node -e "process.exit(2)"`, { stdio: 'ignore' }));
});
