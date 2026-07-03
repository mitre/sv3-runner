# sv3-runner

Run [STIG Viewer 3](https://www.cyber.mil/stigs/downloads/) on any platform (macOS, Linux, Windows) for development and CKLB acceptance testing.

DISA publishes SV3 as a linux-x64 Electron app only. This project extracts the app source from the packaged binary, rebuilds the native sqlite3 module for your platform, and launches SV3 using a local Electron runtime. The result is a working SV3 on macOS ARM, macOS x64, Linux, or Windows — from a single setup command.

## Prerequisites

- **Node.js 24.x** — the project's supported toolchain, matching Electron 40's bundled Node. Use a version manager:

  | Manager | Install Node 24 | Run with Node 24 |
  |---------|----------------|-------------------|
  | [mise](https://mise.jdx.dev) | `mise install` (reads `.mise.toml`) | `mise exec -- npm run setup` |
  | [fnm](https://github.com/Schniz/fnm) | `fnm install 24` | `fnm exec --using=24 -- npm run setup` |
  | [nvm](https://github.com/nvm-sh/nvm) | `nvm install 24` | `nvm use 24 && npm run setup` |
  | [volta](https://volta.sh) | `volta pin node@24` | `npm run setup` |

  The setup script detects your Node version and tells you exactly what to do if it's wrong.

- **SV3 zip file** — Setup auto-downloads the latest SV3 linux-x64 zip from the [DISA CDN](https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/) (the same files linked from [cyber.mil/stigs/srg-stig-tools](https://www.cyber.mil/stigs/srg-stig-tools/)). You can also download manually and place in `downloads/`.

- **Build tools** — `node-gyp` compiles the sqlite3 native module. On macOS this requires Xcode Command Line Tools (`xcode-select --install`). On Linux: `build-essential`. On Windows: Visual Studio Build Tools.

## Quick Start

```bash
# Clone and run — two commands
git clone https://github.com/mitre/sv3-runner.git
cd sv3-runner

# Setup — downloads SV3, extracts, builds sqlite3 for your platform
mise exec -- npm run setup    # with mise (recommended)
fnm exec --using=24 -- npm run setup   # with fnm
npm run setup                 # if Node 24 is already active

# Launch STIG Viewer 3
npm start
```

Setup is idempotent — run it again and it skips what's already done. If no SV3 zip is found in `downloads/`, it auto-downloads the latest from the DISA CDN.

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full setup — extract SV3, install deps, build sqlite3. Idempotent: skips steps already done. Auto-downloads from cyber.mil if no zip found. |
| `npm run setup -- --force` | Force full rebuild — re-extract, re-install, re-build. Use after updating the SV3 zip. |
| `npm run setup -- --download` | Download the latest SV3 linux-x64 zip from cyber.mil CDN, then setup. |
| `npm run setup -- --status` | Show current setup state without changing anything. |
| `npm run setup -- --clean` | Remove `sv3-app/` and `node_modules/`. Start fresh. |
| `npm run setup -- --help` | Show usage and options. |
| `npm run download` | Shortcut: download latest SV3 from cyber.mil. |
| `npm run status` | Shortcut: show setup state. |
| `npm run clean` | Shortcut: remove everything. |
| `npm start` | Launch STIG Viewer 3. |
| `npm test` | Run Playwright acceptance tests (CKLB validation). |

## How It Works

1. **Extract** — Unpacks `app.asar` from the linux SV3 zip using `@electron/asar`. The asar contains the full Electron app source (JavaScript, HTML, node_modules) which is platform-independent.

2. **Rebuild** — The bundled `sqlite3-offline-next` package ships prebuilt native binaries for linux-x64 only (and darwin-x64, but not darwin-arm64). `@electron/rebuild` compiles the `sqlite3` npm package from source for your platform and Electron's Node ABI.

3. **Patch** — Places the rebuilt `node_sqlite3.node` binary where `sqlite3-offline-next` expects it (`binaries/sqlite3-{platform}/napi-v3-{platform}-{arch}/`).

4. **Launch** — Runs the extracted app source with a locally installed Electron 40.1.0 via `npx electron ./sv3-app`.

## Updating SV3

When DISA releases a new SV3 version:

```bash
# Auto-download latest + rebuild
npm run setup -- --download --force
```

Or manually: download the new zip, place in `downloads/`, run `npm run setup -- --force`.

If the new SV3 uses a different Electron version, update `ELECTRON_VERSION` in `scripts/setup.mjs` and `electron` in `package.json` (check the `version` file inside the zip).

## Troubleshooting

### "Electron failed to install correctly"

You're running the wrong Node version. This project's supported toolchain is Node 24.x (matching Electron 40's bundled Node).

```bash
node --version   # Should show v24.x.x
```

Use a version manager (see Prerequisites). The `.mise.toml` file pins Node 24 for `mise` users automatically.

### "NodeJS X.X.X Module NNN not compatible"

The sqlite3 native module was built for a different Node ABI. Force a rebuild:

```bash
npm run setup -- --force
```

### "Database preheat failed" on launch

Harmless on first launch — the STIG library database is empty. SV3 works fine; import STIGs via File menu to populate the library.

### Build fails on macOS

Ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

### Build fails on Linux

Install build essentials:

```bash
# Debian/Ubuntu
sudo apt install build-essential python3

# RHEL/Fedora
sudo dnf groupinstall "Development Tools"
```

## Project Structure

```
sv3-runner/
  .mise.toml              # Pins Node 24 for mise users
  .gitignore              # Ignores generated/downloaded files
  package.json            # Dependencies + npm scripts
  scripts/
    setup.mjs             # Extract + rebuild + patch (idempotent, cross-platform)
    run.mjs               # Launch SV3 via local Electron
  downloads/              # Place SV3 zip here
    .gitkeep              # Keeps directory in git
    *.zip                 # (user-provided) SV3 zip from cyber.mil — gitignored
  sv3-app/                # (generated) Extracted SV3 source — gitignored
  node_modules/           # (generated) Dependencies — gitignored
```

## For CKLB Acceptance Testing

This project supports the Heimdall2 CKLB converter ([ADR-003](https://github.com/mitre/heimdall2/blob/main/docs/adr-003-cklb-converter.md)). The acceptance test workflow:

1. Heimdall generates a `.cklb` file (forward mapper output or round-trip export)
2. Playwright launches SV3 via this runner
3. SV3 opens the generated `.cklb` file
4. Playwright verifies SV3 displays rules with correct statuses and comments
5. Screenshot captured as evidence

This validates that Heimdall's CKLB output is accepted by the real STIG Viewer 3 — not just schema-valid, but tool-accepted.

## License

This project (the sv3-runner tooling) is licensed under the Apache License, Version 2.0 — see the [LICENSE](./LICENSE) file for the full text, and [NOTICE](./NOTICE) for the MITRE copyright and attribution.

STIG Viewer 3 itself is a U.S. Government (DISA) product. This repository does **not** contain, vendor, or modify SV3 — the setup script downloads it directly from the DISA CDN at run time. The Apache-2.0 license applies only to the sv3-runner scripts and configuration, not to STIG Viewer 3. See [NOTICE](./NOTICE) for details.
