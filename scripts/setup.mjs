#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, readdirSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import {
  parseSv3Listing,
  selectLatestZip,
  selectSv3Zip,
  checkNodeVersionOk,
  fileAgeLabel,
  hashesFilenameFor,
  sqlite3TargetDir,
  sqlite3BinaryPath,
} from './lib/sv3.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const APP_DIR = join(PROJECT_DIR, 'sv3-app');
const ELECTRON_VERSION = '40.1.0';
const SV3_VERSION = '3.7.0';
const MIN_NODE_MAJOR = 22;
const MAX_NODE_MAJOR = 22;

// --- CLI argument parsing ---
const args = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const FORCE = args.has('--force');
const STATUS = args.has('--status');
const CLEAN = args.has('--clean');
const DOWNLOAD = args.has('--download');
const HELP = args.has('--help') || args.has('-h');

// cyber.mil/stigs/srg-stig-tools/ is a Salesforce LWR app (dynamic, can't scrape).
// The actual downloads are on this CDN with a plain Apache directory listing.
const SV3_CDN = 'https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/';
const DOWNLOADS_DIR = join(PROJECT_DIR, 'downloads');

if (HELP) {
  console.log(`
sv3-runner setup — Extract and configure STIG Viewer 3 for any platform

Usage:
  node scripts/setup.mjs [options] [path-to-sv3-zip]

Options:
  --status    Show current setup state without changing anything
  --force     Force re-extract, re-install, and re-build (ignores cache)
  --download  Download the latest SV3 linux-x64 zip from cyber.mil
  --clean     Remove sv3-app/, node_modules/, and all build artifacts
  --help, -h  Show this help

Examples:
  node scripts/setup.mjs                          # Setup with defaults
  node scripts/setup.mjs --download               # Download latest + setup
  node scripts/setup.mjs ~/Downloads/SV3.zip      # Specify zip location
  node scripts/setup.mjs --status                 # Check what's installed
  node scripts/setup.mjs --download --force        # Download latest + full rebuild
  node scripts/setup.mjs --force                  # Full rebuild (keep existing zip)
  node scripts/setup.mjs --clean                  # Remove everything

Environment:
  Requires Node ${MIN_NODE_MAJOR}.x — use mise, fnm, nvm, or volta to manage versions.
  SV3 auto-downloads from https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/
  Or manually from https://www.cyber.mil/stigs/srg-stig-tools/ → place in downloads/
`);
  process.exit(0);
}

// --- Helpers ---
function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: PROJECT_DIR, ...opts });
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function findFile(dir, name) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, name);
      if (found) return found;
    } else if (entry.name === name) {
      return fullPath;
    }
  }
  return null;
}

function fileAge(filePath) {
  if (!existsSync(filePath)) return null;
  const mtime = statSync(filePath).mtime;
  return fileAgeLabel(Date.now() - mtime.getTime());
}

async function findLatestSv3Url() {
  console.log(`  Checking ${SV3_CDN} for latest version...`);
  const html = runCapture(`curl -sL "${SV3_CDN}"`);
  if (!html) {
    console.error('ERROR: Could not reach dl.dod.cyber.mil');
    console.error('  Check your network connection. VPN may be required.');
    return null;
  }

  const matches = parseSv3Listing(html);

  if (matches.length === 0) {
    console.error('ERROR: No SV3 linux-x64 downloads found on CDN.');
    return null;
  }

  const latest = selectLatestZip(matches);
  return { filename: latest, url: `${SV3_CDN}${latest}` };
}

async function downloadSv3() {
  console.log('--- Downloading latest SV3 ---');

  const info = await findLatestSv3Url();
  if (!info) {
    console.error('Download failed. Place the zip manually in downloads/');
    process.exit(1);
  }

  const destPath = join(DOWNLOADS_DIR, info.filename);

  if (existsSync(destPath) && !FORCE) {
    console.log(`  Already downloaded: ${info.filename} (use --force to re-download)`);
    return destPath;
  }

  console.log(`  Latest: ${info.filename}`);
  console.log(`  URL: ${info.url}`);
  console.log(`  Downloading (~140MB)...`);

  mkdirSync(DOWNLOADS_DIR, { recursive: true });
  run(`curl -L -o "${destPath}" "${info.url}"`);

  // Also grab hashes if available
  const hashUrl = `${SV3_CDN}${hashesFilenameFor(info.filename)}`;
  const hashDest = join(DOWNLOADS_DIR, `${info.filename.replace('.zip', '')}_Hashes.txt`);
  try {
    run(`curl -sL -o "${hashDest}" "${hashUrl}"`);
    console.log(`  Hashes saved to ${hashDest}`);
  } catch {
    // Hashes file may not exist for all versions — not fatal
  }

  console.log(`  Downloaded to ${destPath}`);
  return destPath;
}

function checkNodeVersion() {
  if (checkNodeVersionOk(process.version, MIN_NODE_MAJOR, MAX_NODE_MAJOR)) return true;

  console.error(`\nERROR: Node ${process.version} is not compatible.`);
  console.error(
    `       Requires Node ${MIN_NODE_MAJOR}.x (Electron ${ELECTRON_VERSION} native module ABI).`,
  );
  console.error('');

  const managers = [
    { name: 'mise', check: 'mise --version', fix: `mise exec -- node scripts/setup.mjs` },
    {
      name: 'fnm',
      check: 'fnm --version',
      fix: `fnm exec --using=${MIN_NODE_MAJOR} -- node scripts/setup.mjs`,
    },
    {
      name: 'nvm',
      check: 'nvm --version',
      fix: `nvm use ${MIN_NODE_MAJOR} && node scripts/setup.mjs`,
    },
    {
      name: 'volta',
      check: 'volta --version',
      fix: `volta run --node ${MIN_NODE_MAJOR} -- node scripts/setup.mjs`,
    },
    {
      name: 'asdf',
      check: 'asdf --version',
      fix: `asdf local nodejs ${MIN_NODE_MAJOR}.0.0 && node scripts/setup.mjs`,
    },
  ];

  for (const mgr of managers) {
    const version = runCapture(mgr.check);
    if (version) {
      console.error(`  Found ${mgr.name} (${version}). Run:`);
      console.error(`    ${mgr.fix}`);
      console.error('');
      break;
    }
  }

  process.exit(1);
}

const platform = os.platform();
const arch = os.arch();
const targetDir = sqlite3TargetDir(APP_DIR, platform, arch);
const targetBinary = sqlite3BinaryPath(APP_DIR, platform, arch);
// Find the SV3 zip: CLI arg > any zip in downloads/ > default name
function findSv3Zip() {
  const zipFiles = existsSync(DOWNLOADS_DIR) ? readdirSync(DOWNLOADS_DIR) : [];
  return selectSv3Zip(positional[0], DOWNLOADS_DIR, zipFiles, 'U_STIGViewer-linux_x64-3-7-0.zip');
}

let sv3Zip = findSv3Zip();

// ============================================================
// --status: show current state and exit
// ============================================================
if (STATUS) {
  console.log('=== SV3 Runner Status ===');
  console.log(`Platform:        ${platform} ${arch}`);
  console.log(`Node:            ${process.version}`);
  console.log(
    `Node OK:         ${checkNodeVersionOk(process.version, MIN_NODE_MAJOR, MAX_NODE_MAJOR) ? '✓' : `✗ (need ${MIN_NODE_MAJOR}.x)`}`,
  );
  console.log(`Electron:        ${ELECTRON_VERSION}`);
  console.log(`SV3 version:     ${SV3_VERSION}`);
  console.log('');
  console.log(`SV3 zip:         ${existsSync(sv3Zip) ? `✓ ${sv3Zip}` : `✗ not found (${sv3Zip})`}`);
  console.log(`sv3-app/:        ${existsSync(APP_DIR) ? `✓ extracted` : '✗ not extracted'}`);
  console.log(
    `node_modules/:   ${existsSync(join(PROJECT_DIR, 'node_modules', 'electron')) ? '✓ installed' : '✗ not installed'}`,
  );
  console.log(
    `sqlite3 binary:  ${existsSync(targetBinary) ? `✓ ${platform}-${arch} (${fileAge(targetBinary)})` : `✗ not built for ${platform}-${arch}`}`,
  );
  console.log('');

  if (existsSync(targetBinary)) {
    console.log('Ready to run: npm start');
  } else if (existsSync(APP_DIR)) {
    console.log('Need: npm run setup (rebuild sqlite3)');
  } else if (existsSync(sv3Zip)) {
    console.log('Need: npm run setup (full setup)');
  } else {
    console.log('Need: download SV3 zip from cyber.mil, then npm run setup');
  }
  process.exit(0);
}

// ============================================================
// --clean: remove everything
// ============================================================
if (CLEAN) {
  console.log('=== Cleaning SV3 Runner ===');
  for (const dir of ['sv3-app', 'node_modules']) {
    const fullPath = join(PROJECT_DIR, dir);
    if (existsSync(fullPath)) {
      console.log(`  Removing ${dir}/...`);
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
  console.log('Clean. Run `npm run setup` to rebuild.');
  process.exit(0);
}

// ============================================================
// --download: fetch latest from cyber.mil (standalone or before setup)
// ============================================================
if (DOWNLOAD) {
  sv3Zip = await downloadSv3();
  if (!FORCE && existsSync(APP_DIR)) {
    console.log('');
    console.log('Download complete. sv3-app/ already exists.');
    console.log('Run with --force to re-extract with the new zip.');
    process.exit(0);
  }
}

// ============================================================
// Main setup flow
// ============================================================
console.log('=== SV3 Runner Setup ===');
console.log(`Platform: ${platform} ${arch}`);
console.log(`Node: ${process.version}`);
if (FORCE) console.log('Mode: --force (rebuilding everything)');
console.log('');

checkNodeVersion();

// Step 1: Extract
if (!existsSync(APP_DIR) || FORCE) {
  if (FORCE && existsSync(APP_DIR)) {
    console.log('--- Step 1: --force: removing existing sv3-app/ ---');
    rmSync(APP_DIR, { recursive: true, force: true });
  }

  // Auto-download if no zip found
  if (!existsSync(sv3Zip)) {
    console.log('--- No SV3 zip found — downloading latest from cyber.mil ---');
    sv3Zip = await downloadSv3();
  }

  console.log('--- Step 1: Extracting SV3 from zip ---');

  if (!existsSync(sv3Zip)) {
    console.error(`ERROR: SV3 zip not found at: ${sv3Zip}`);
    console.error('');
    console.error('Options:');
    console.error('  npm run setup -- --download     Auto-download from cyber.mil');
    console.error('  Place zip manually in downloads/');
    console.error('  node scripts/setup.mjs /path/to/zip');
    process.exit(1);
  }

  const tempDir = join(os.tmpdir(), `sv3-extract-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    if (platform === 'win32') {
      run(
        `powershell -Command "Expand-Archive -Path '${sv3Zip}' -DestinationPath '${tempDir}' -Force"`,
      );
    } else {
      run(`unzip -q "${sv3Zip}" "stig_viewer_3-linux-x64/resources/*" -d "${tempDir}"`);
    }
  } catch {
    console.error('ERROR: Failed to extract zip.');
    console.error(`  macOS: brew install unzip (usually pre-installed)`);
    console.error(`  Linux: sudo apt install unzip`);
    console.error(`  Windows: PowerShell Expand-Archive should work automatically`);
    process.exit(1);
  }

  const resourcesDir = join(tempDir, 'stig_viewer_3-linux-x64', 'resources');
  run(`npx @electron/asar extract "${join(resourcesDir, 'app.asar')}" "${APP_DIR}"`);

  const unpackedDir = join(resourcesDir, 'app.asar.unpacked');
  if (existsSync(unpackedDir)) {
    cpSync(unpackedDir, APP_DIR, { recursive: true, force: true });
  }

  rmSync(tempDir, { recursive: true, force: true });
  console.log(`Extracted to ${APP_DIR}`);
} else {
  console.log('--- Step 1: sv3-app/ exists, skipping (use --force to re-extract) ---');
}

// Step 2: Install deps
const depsInstalled = existsSync(join(PROJECT_DIR, 'node_modules', 'electron'));
if (!depsInstalled || FORCE) {
  console.log('');
  console.log('--- Step 2: Installing dependencies ---');
  run('npm install');
} else {
  console.log('');
  console.log('--- Step 2: Dependencies installed, skipping (use --force to reinstall) ---');
}

// Step 3+4: Build and place sqlite3
if (!existsSync(targetBinary) || FORCE) {
  console.log('');
  console.log(
    `--- Step 3: Building sqlite3 for ${platform}-${arch} (Electron ${ELECTRON_VERSION}) ---`,
  );
  run(`npx @electron/rebuild -f -w sqlite3 -v ${ELECTRON_VERSION}`);

  console.log('');
  console.log('--- Step 4: Patching sqlite3-offline-next ---');
  mkdirSync(targetDir, { recursive: true });

  const builtBinary = findFile(join(PROJECT_DIR, 'node_modules', 'sqlite3'), 'node_sqlite3.node');
  if (!builtBinary) {
    console.error('ERROR: Could not find built node_sqlite3.node');
    console.error('Try: npm rebuild sqlite3 --build-from-source');
    process.exit(1);
  }

  cpSync(builtBinary, targetBinary);
  console.log(`OK: ${platform}-${arch} binary placed`);
} else {
  console.log('');
  console.log(
    `--- Step 3: sqlite3 binary exists for ${platform}-${arch}, skipping (use --force to rebuild) ---`,
  );
}

// Verify
console.log('');
if (existsSync(targetBinary)) {
  console.log('=== Setup complete ===');
  console.log('');
  console.log('  npm start             Launch SV3');
  console.log('  npm run setup --status  Check setup state');
  console.log('  npm run setup --force   Full rebuild');
  console.log('  npm run setup --clean   Remove everything');
} else {
  console.error('FAIL: native module not found after setup');
  process.exit(1);
}
