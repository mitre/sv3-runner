#!/usr/bin/env node

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { sqlite3BinaryPath } from './lib/sv3.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const APP_DIR = join(PROJECT_DIR, 'sv3-app');

// Integration-smoke: assert the rebuilt native sqlite3 binary landed where
// sqlite3-offline-next expects it. The path is DERIVED from lib/sv3.mjs
// (sqlite3BinaryPath) — the same helper setup.mjs uses to place it — so this
// check can never drift from where setup writes the binary.
const platform = os.platform();
const arch = os.arch();
const binaryPath = sqlite3BinaryPath(APP_DIR, platform, arch);

if (!existsSync(binaryPath)) {
  console.error(
    `ERROR: sqlite3 native binary not found for ${platform}-${arch}.\n` +
      `  Expected: ${binaryPath}\n` +
      '  Run `npm run setup` first.',
  );
  process.exit(1);
}

console.log(`OK: sqlite3 native binary present for ${platform}-${arch}\n  ${binaryPath}`);
