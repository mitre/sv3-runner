import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { run as defaultRun } from './exec.mjs';

// Thrown when the archive DECOMPRESSION step (unzip / PowerShell Expand-Archive)
// fails — distinct from downstream failures so the caller can print
// decompress-specific guidance ("install unzip") while other failures surface
// their own stack. This is deliberate error classification, not a bare catch.
export class ExtractError extends Error {
  constructor(cause) {
    super('SV3 archive decompression failed');
    this.name = 'ExtractError';
    this.cause = cause;
  }
}

// The setup pipeline as dependency-injected steps. Each shell-out goes through an
// injected `run` (default = exec.run) so tests assert the exact command with a spy
// — no duplicated runner, no mocked execSync. Idempotency skip-checks and the
// --force gating stay in setup.mjs's composition (these do the mechanical work).

// Decompress the SV3 zip's resources into tempDir, unpack app.asar into appDir,
// and merge app.asar.unpacked over it. Throws ExtractError if decompression fails;
// any other failure (e.g. asar) propagates unchanged.
export function extractApp({ sv3Zip, appDir, tempDir, platform, run = defaultRun }) {
  mkdirSync(tempDir, { recursive: true });

  try {
    if (platform === 'win32') {
      run(
        `powershell -Command "Expand-Archive -Path '${sv3Zip}' -DestinationPath '${tempDir}' -Force"`,
      );
    } else {
      run(`unzip -q "${sv3Zip}" "stig_viewer_3-linux-x64/resources/*" -d "${tempDir}"`);
    }
  } catch (err) {
    throw new ExtractError(err);
  }

  const resourcesDir = join(tempDir, 'stig_viewer_3-linux-x64', 'resources');
  run(`npx @electron/asar extract "${join(resourcesDir, 'app.asar')}" "${appDir}"`);

  const unpackedDir = join(resourcesDir, 'app.asar.unpacked');
  if (existsSync(unpackedDir)) {
    cpSync(unpackedDir, appDir, { recursive: true, force: true });
  }

  rmSync(tempDir, { recursive: true, force: true });
}

// Install the runner's own dependencies (Electron + build tools) into projectDir.
export function installDeps({ projectDir, run = defaultRun }) {
  run('npm install', { cwd: projectDir });
}

// Rebuild the native sqlite3 addon from source against Electron's Node ABI.
export function buildSqlite({ electronVersion, projectDir, run = defaultRun }) {
  run(`npx @electron/rebuild -f -w sqlite3 -v ${electronVersion}`, { cwd: projectDir });
}

// Copy the freshly built node_sqlite3.node into the location sqlite3-offline-next
// expects. Pure filesystem — targetDir/targetBinary are computed by the caller via
// lib/sv3.mjs's sqlite3TargetDir/sqlite3BinaryPath, so no path logic is duplicated here.
export function patchSqlite({ builtBinary, targetDir, targetBinary }) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(builtBinary, targetBinary);
}
