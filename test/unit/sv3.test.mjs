// Full edge-case coverage for the pure helpers in scripts/lib/sv3.mjs (card sv3-runner-tu5.4).
// parity.test.mjs proves the extraction was behavior-preserving; this file exercises the
// boundaries and pins the FIXED hashesFilenameFor against the researched DISA name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'cdn-listing.html');

test('parseSv3Listing extracts only the linux_x64 zips from a real CDN listing (no win32, no msi, no hashes)', () => {
  const html = readFileSync(FIXTURE, 'utf-8');
  assert.deepEqual(parseSv3Listing(html), [
    'U_STIGViewer-linux_x64-3-5-1.zip',
    'U_STIGViewer-linux_x64-3-6-0.zip',
    'U_STIGViewer-linux_x64-3-7-0.zip',
  ]);
});

test('selectLatestZip picks the highest version NUMERICALLY, not lexically', () => {
  assert.equal(
    selectLatestZip([
      'U_STIGViewer-linux_x64-3-7-0.zip',
      'U_STIGViewer-linux_x64-3-5-1.zip',
      'U_STIGViewer-linux_x64-3-6-0.zip',
    ]),
    'U_STIGViewer-linux_x64-3-7-0.zip',
  );
  // 3-10-0 > 3-7-0 numerically, but "10" < "7" lexically — proves numeric sort.
  assert.equal(
    selectLatestZip(['U_STIGViewer-linux_x64-3-7-0.zip', 'U_STIGViewer-linux_x64-3-10-0.zip']),
    'U_STIGViewer-linux_x64-3-10-0.zip',
  );
});

test('selectSv3Zip: explicit CLI arg wins over everything', () => {
  assert.equal(
    selectSv3Zip('/custom/path.zip', '/downloads', ['U_STIGViewer-linux_x64-3-7-0.zip'], 'def.zip'),
    '/custom/path.zip',
  );
});

test('selectSv3Zip: no CLI arg falls back to newest matching zip in downloads/', () => {
  assert.equal(
    selectSv3Zip(
      undefined,
      '/downloads',
      ['U_STIGViewer-linux_x64-3-6-0.zip', 'U_STIGViewer-linux_x64-3-7-0.zip', 'notes.txt'],
      'def.zip',
    ),
    join('/downloads', 'U_STIGViewer-linux_x64-3-7-0.zip'),
  );
});

test('selectSv3Zip: empty downloads/ falls back to the default name', () => {
  assert.equal(
    selectSv3Zip(undefined, '/downloads', [], 'U_STIGViewer-linux_x64-3-7-0.zip'),
    join('/downloads', 'U_STIGViewer-linux_x64-3-7-0.zip'),
  );
});

test('checkNodeVersionOk accepts only the [min,max] major range, inclusive of the boundary', () => {
  assert.equal(checkNodeVersionOk('v24.0.0', 24, 24), true);
  assert.equal(checkNodeVersionOk('v24.14.0', 24, 24), true);
  assert.equal(checkNodeVersionOk('v22.0.0', 24, 24), false);
  assert.equal(checkNodeVersionOk('v25.0.0', 24, 24), false);
});

test('fileAgeLabel picks minutes < 1h, hours < 24h, else days', () => {
  assert.equal(fileAgeLabel(30 * 60 * 1000), '30 minutes ago');
  assert.equal(fileAgeLabel(59 * 60 * 1000), '59 minutes ago');
  assert.equal(fileAgeLabel(5 * 60 * 60 * 1000), '5 hours ago');
  assert.equal(fileAgeLabel(23 * 60 * 60 * 1000), '23 hours ago');
  assert.equal(fileAgeLabel(3 * 24 * 60 * 60 * 1000), '3 days ago');
});

test('sqlite3TargetDir / sqlite3BinaryPath build the sqlite3-offline-next path for each platform-arch', () => {
  assert.equal(
    sqlite3TargetDir('/app', 'darwin', 'arm64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-darwin/napi-v3-darwin-arm64',
  );
  assert.equal(
    sqlite3TargetDir('/app', 'darwin', 'x64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-darwin/napi-v3-darwin-x64',
  );
  assert.equal(
    sqlite3BinaryPath('/app', 'linux', 'x64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-linux/napi-v3-linux-x64/node_sqlite3.node',
  );
  assert.equal(
    sqlite3BinaryPath('/app', 'win32', 'x64'),
    '/app/node_modules/sqlite3-offline-next/binaries/sqlite3-win32/napi-v3-win32-x64/node_sqlite3.node',
  );
});

test('hashesFilenameFor returns the REAL DISA name (version-keyed, platform-independent)', () => {
  // Researched against the live CDN 2026-07-03: the zip
  // U_STIGViewer-linux_x64-3-7-0.zip is accompanied by U_STIGViewer_3-7-0_Hashes.txt
  // (HTTP 200); the old buggy name U_STIGViewer_-3-7-0_Hashes.txt 404s.
  assert.equal(
    hashesFilenameFor('U_STIGViewer-linux_x64-3-7-0.zip'),
    'U_STIGViewer_3-7-0_Hashes.txt',
  );
  // The hashes file is per-version, shared across platforms — win32 maps to the same name.
  assert.equal(
    hashesFilenameFor('U_STIGViewer-win32_x64-3-7-0.zip'),
    'U_STIGViewer_3-7-0_Hashes.txt',
  );
});
