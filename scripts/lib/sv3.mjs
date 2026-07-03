// Pure helpers extracted from scripts/setup.mjs (card sv3-runner-xxl.1).
// No I/O, no process/global access — everything is a function of its arguments,
// so these are unit-testable. Behavior is preserved verbatim from the inline code;
// the known hashesFilenameFor bug is fixed separately in card sv3-runner-xxl.3.
import { join } from 'node:path';

// Extract SV3 linux-x64 zip filenames from a DISA CDN Apache directory listing.
export function parseSv3Listing(html) {
  const linkPattern = /HREF="(U_STIGViewer-linux_x64-[\d-]+\.zip)"/gi;
  return [...html.matchAll(linkPattern)].map((m) => m[1]);
}

// Pick the highest-versioned zip by numeric (major, minor, patch) order.
export function selectLatestZip(filenames) {
  const versionOf = (s) => {
    const m = s.match(/(\d+-\d+-\d+)/);
    return m ? m[1].split('-').map(Number) : [0, 0, 0];
  };
  const sorted = [...filenames].sort((a, b) => {
    const va = versionOf(a);
    const vb = versionOf(b);
    for (let i = 0; i < 3; i++) {
      if (va[i] !== vb[i]) return va[i] - vb[i];
    }
    return 0;
  });
  return sorted[sorted.length - 1];
}

// Choose which zip to use: explicit CLI arg > newest matching zip in downloads/ > default.
// `zipFiles` is the directory listing (caller does the fs read); selection stays pure.
export function selectSv3Zip(cliArg, downloadsDir, zipFiles, defaultName) {
  if (cliArg) return cliArg;
  const zips = (zipFiles ?? []).filter((f) => f.match(/^U_STIGViewer-linux_x64.*\.zip$/i)).sort();
  if (zips.length > 0) return join(downloadsDir, zips[zips.length - 1]);
  return join(downloadsDir, defaultName);
}

// True when the Node major version is within the supported [min, max] range.
export function checkNodeVersionOk(version, min, max) {
  const major = parseInt(version.slice(1).split('.')[0], 10);
  return major >= min && major <= max;
}

// Human-readable age from a millisecond delta (minutes < 1h, hours < 24h, else days).
export function fileAgeLabel(msDelta) {
  const hours = msDelta / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)} minutes ago`;
  if (hours < 24) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// Derive the "_Hashes.txt" filename DISA publishes next to a zip.
// NOTE: preserved AS-IS from setup.mjs and KNOWN BUGGY (the `.replace(/-/g, '-')`
// is a no-op, producing e.g. "U_STIGViewer_-3-7-0_Hashes.txt"). Fixed in card .3.
export function hashesFilenameFor(zipFilename) {
  const base = zipFilename
    .replace(/linux_x64-/, '')
    .replace(/\.zip$/, '')
    .replace(/-/g, '-')
    .replace('U_STIGViewer', 'U_STIGViewer_');
  return `${base}_Hashes.txt`;
}

// Directory where sqlite3-offline-next expects the rebuilt native binary.
export function sqlite3TargetDir(appDir, platform, arch) {
  return join(
    appDir,
    'node_modules',
    'sqlite3-offline-next',
    'binaries',
    `sqlite3-${platform}`,
    `napi-v3-${platform}-${arch}`,
  );
}

// Full path to the rebuilt node_sqlite3.node binary.
export function sqlite3BinaryPath(appDir, platform, arch) {
  return join(sqlite3TargetDir(appDir, platform, arch), 'node_sqlite3.node');
}
