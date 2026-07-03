#!/usr/bin/env node

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { run as defaultRun } from './lib/exec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const APP_DIR = join(PROJECT_DIR, 'sv3-app');

// Launch the extracted SV3 app with a local Electron runtime, passing through any
// extra CLI args. Shell-out via the shared runner (which echoes the command).
function launchSv3({ appDir, extraArgs = '', run = defaultRun }) {
  run(`npx electron "${appDir}" --no-sandbox ${extraArgs}`);
}

if (!existsSync(APP_DIR)) {
  console.error('ERROR: sv3-app/ not found. Run `npm run setup` first.');
  process.exit(1);
}

console.log('Launching STIG Viewer 3...');
launchSv3({ appDir: APP_DIR, extraArgs: process.argv.slice(2).join(' ') });
