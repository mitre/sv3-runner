import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// The single source of truth for shelling out. Previously duplicated inline in
// setup.mjs (run + runCapture) with a near-third copy forming in run.mjs.
//
// Project root is computed from THIS file's location (scripts/lib/exec.mjs → ../..),
// which resolves to the same absolute path the callers previously derived via
// `join(__dirname, '..')` from scripts/ — so the default cwd is unchanged.
const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Run a command with inherited stdio (streams straight to the user), echoing it
// first so setup logs show `  $ <cmd>`. Throws (via execSync) on a non-zero exit —
// this is the LOUD variant; callers wanting a soft failure use runCapture.
export function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: PROJECT_DIR, ...opts });
}

// Run a command and return its trimmed stdout, or null if it exits non-zero.
// The null return IS the error classification: this is a soft probe (e.g. checking
// whether `mise`/`fnm` exist, or fetching a CDN listing) whose callers branch on
// null. Logging the failure here would spew spurious errors for the normal
// "tool not installed" / "offline" cases — so the catch is intentionally silent.
export function runCapture(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf-8', ...opts }).trim();
  } catch {
    return null;
  }
}
