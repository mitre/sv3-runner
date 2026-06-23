#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const APP_DIR = join(PROJECT_DIR, 'sv3-app');

if (!existsSync(APP_DIR)) {
  console.error('ERROR: sv3-app/ not found. Run `npm run setup` first.');
  process.exit(1);
}

const extraArgs = process.argv.slice(2).join(' ');
console.log('Launching STIG Viewer 3...');
execSync(`npx electron "${APP_DIR}" --no-sandbox ${extraArgs}`, {
  stdio: 'inherit',
  cwd: PROJECT_DIR,
});
