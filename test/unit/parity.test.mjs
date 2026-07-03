// Parity tests for card sv3-runner-xxl.1 — behavior-preserving extraction of pure
// helpers from scripts/setup.mjs into scripts/lib/sv3.mjs. Each assertion pins the
// EXACT value the inline code in setup.mjs produced (characterization). See epic
// sv3-runner-xxl §Strategy.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSv3Listing,
  selectLatestZip,
  selectSv3Zip,
  checkNodeVersionOk,
  fileAgeLabel,
  hashesFilenameFor,
  sqlite3TargetDir,
  sqlite3BinaryPath,
} from '../../scripts/lib/sv3.mjs';

test('parseSv3Listing extracts SV3 linux zip filenames from a CDN directory listing', () => {
  const html = [
    '<a href="U_STIGViewer-linux_x64-3-5-1.zip">3-5-1</a>',
    '<a href="U_STIGViewer-linux_x64-3-6-0.zip">3-6-0</a>',
    '<a href="U_STIGViewer-linux_x64-3-7-0.zip">3-7-0</a>',
    '<a href="U_STIGViewer-win_x64-3-7-0.zip">win (ignored)</a>',
  ].join('\n');
  assert.deepEqual(parseSv3Listing(html), [
    'U_STIGViewer-linux_x64-3-5-1.zip',
    'U_STIGViewer-linux_x64-3-6-0.zip',
    'U_STIGViewer-linux_x64-3-7-0.zip',
  ]);
});

test('selectLatestZip picks the highest version NUMERICALLY (not lexically)', () => {
  assert.equal(
    selectLatestZip([
      'U_STIGViewer-linux_x64-3-7-0.zip',
      'U_STIGViewer-linux_x64-3-5-1.zip',
      'U_STIGViewer-linux_x64-3-6-0.zip',
    ]),
    'U_STIGViewer-linux_x64-3-7-0.zip',
  );
  // 3-10-0 > 3-7-0 numerically but "10" < "7" lexically — pins numeric sort
  assert.equal(
    selectLatestZip([
      'U_STIGViewer-linux_x64-3-7-0.zip',
      'U_STIGViewer-linux_x64-3-10-0.zip',
    ]),
    'U_STIGViewer-linux_x64-3-10-0.zip',
  );
});

test('selectSv3Zip: CLI arg > newest zip in downloads > default name', () => {
  const dl = '/downloads';
  const files = [
    'U_STIGViewer-linux_x64-3-6-0.zip',
    'U_STIGViewer-linux_x64-3-7-0.zip',
    'notes.txt',
  ];
  assert.equal(selectSv3Zip('/x/custom.zip', dl, files, 'default.zip'), '/x/custom.zip');
  assert.equal(selectSv3Zip(undefined, dl, files, 'default.zip'), '/downloads/U_STIGViewer-linux_x64-3-7-0.zip');
  assert.equal(selectSv3Zip(undefined, dl, [], 'U_STIGViewer-linux_x64-3-7-0.zip'), '/downloads/U_STIGViewer-linux_x64-3-7-0.zip');
});

test('checkNodeVersionOk accepts only the [min,max] major range', () => {
  assert.equal(checkNodeVersionOk('v22.5.1', 22, 22), true);
  assert.equal(checkNodeVersionOk('v20.0.0', 22, 22), false);
  assert.equal(checkNodeVersionOk('v23.1.0', 22, 22), false);
});

test('fileAgeLabel formats a ms delta the same way the inline code did', () => {
  assert.equal(fileAgeLabel(30 * 60 * 1000), '30 minutes ago'); // <1h → minutes
  assert.equal(fileAgeLabel(5 * 60 * 60 * 1000), '5 hours ago'); // <24h → hours
  assert.equal(fileAgeLabel(3 * 24 * 60 * 60 * 1000), '3 days ago'); // else → days
});

test('hashesFilenameFor pins CURRENT (buggy) output — card .3 fixes + updates this', () => {
  // The inline code has a no-op `.replace(/-/g,'-')`, yielding a wrong name.
  // Characterization only: proves the extraction is behavior-preserving.
  assert.equal(hashesFilenameFor('U_STIGViewer-linux_x64-3-7-0.zip'), 'U_STIGViewer_-3-7-0_Hashes.txt');
});

test('sqlite3 target paths match the inline join()', () => {
  assert.equal(
    sqlite3TargetDir('/app', 'darwin', 'arm64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-darwin/napi-v3-darwin-arm64',
  );
  assert.equal(
    sqlite3BinaryPath('/app', 'linux', 'x64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-linux/napi-v3-linux-x64/node_sqlite3.node',
  );
});
