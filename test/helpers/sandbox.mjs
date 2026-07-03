// Shared test harness for the functional CLI tests.
//
// The scripts derive PROJECT_DIR from their own location (join(__dirname, '..')),
// so we isolate by copying scripts/ into a fresh temp sandbox and spawning the REAL
// scripts from there — their PROJECT_DIR becomes the sandbox, never the real repo.
// No network, no download, no native rebuild, no mutation of the working tree.
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import os from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { sqlite3BinaryPath } from '../../scripts/lib/sv3.mjs';

const REPO_SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');

// Fresh isolated project root with a byte-for-byte copy of the real scripts/.
export function makeSandbox() {
  const dir = mkdtempSync(join(os.tmpdir(), 'sv3-cli-'));
  cpSync(REPO_SCRIPTS, join(dir, 'scripts'), { recursive: true });
  return dir;
}

// Spawn a script in the sandbox with the SAME node binary; never throws on non-zero.
export function runScript(sandbox, scriptName, args = []) {
  const res = spawnSync(process.execPath, [join(sandbox, 'scripts', scriptName), ...args], {
    cwd: sandbox,
    encoding: 'utf-8',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

// Stage a fake built sqlite3 binary at the exact path sqlite3BinaryPath computes.
export function stageBinary(sandbox) {
  const bin = sqlite3BinaryPath(join(sandbox, 'sv3-app'), os.platform(), os.arch());
  mkdirSync(dirname(bin), { recursive: true });
  writeFileSync(bin, 'FAKE-SQLITE3');
  return bin;
}
