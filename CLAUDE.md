# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Tooling to run DISA's **STIG Viewer 3 (SV3)** on any platform (macOS ARM/x64, Linux, Windows). DISA ships SV3 as `linux_x64` and `win32_x64` builds only — there is **no macOS build** (that's the gap this repo fills). This repo does **not** contain SV3's source — it extracts the app from DISA's packaged `linux_x64` zip (its `app.asar` is platform-independent), rebuilds the native `sqlite3` module for the host platform, and launches the extracted app with a local Electron runtime.

The core is two entry scripts — `scripts/setup.mjs` (extract + rebuild + patch) and `scripts/run.mjs` (launch) — plus their shared library `scripts/lib/` (`exec.mjs`, `pipeline.mjs`, `sv3.mjs`) and a `test/` suite (`unit/`, `functional/`, `e2e/`, `fixtures/`). There is no SV3 application code here to edit — work happens in those scripts, the lib, the tests, and the surrounding config.

## Commands

```bash
npm run setup              # Full idempotent setup: download (if needed) → extract → npm install → rebuild sqlite3 → patch
npm run setup -- --force   # Re-do every step, ignoring existing artifacts (use after updating the SV3 zip)
npm run setup -- --status  # Report state (Node OK?, zip present?, extracted?, sqlite3 binary built?) — changes nothing
npm run setup -- --download # Fetch latest linux-x64 zip from the DISA CDN, then setup
npm run setup -- --clean   # Remove sv3-app/ and node_modules/
npm start                  # Launch SV3 (npx electron ./sv3-app --no-sandbox)
npm test                   # Unit + functional: node --test 'test/**/*.test.mjs' (scoped glob is required)
npm run test:e2e           # Playwright _electron CKLB acceptance E2E (needs a completed npm run setup)
npm run lint               # ESLint (flat/ESM) + Prettier --check
```

`npm run download` / `npm run status` / `npm run clean` are shortcuts for the `setup -- --*` forms.

Diagnose problems with `npm run setup -- --status` first — it prints exactly which step is missing and the next command to run.

## Node version is a hard requirement, not a preference

**Node 24.x only** (`>=24.0.0 <25.0.0`). This is the project's supported toolchain and matches Electron 40's bundled Node (24.x). (It is *not* a native-module ABI requirement — Node 24 was verified end-to-end: real `npm run setup`, full `node:test`, and the Playwright `_electron` launch all pass on 24. The single-major pin keeps the supported environment unambiguous.) Enforced three ways: `engines` in `package.json`, `engine-strict=true` in `.npmrc`, and `checkNodeVersion()` in `setup.mjs` (which exits and prints the correct `mise`/`fnm`/`nvm`/`volta`/`asdf` command for whichever manager it detects). `.mise.toml` pins Node 24 for mise users. If you invoke the scripts under the wrong Node, they fail fast by design — switch Node, don't patch the check.

## How setup.mjs works (the core flow)

1. **Extract** — Unzip `stig_viewer_3-linux-x64/resources/*` from the DISA zip (macOS/Linux: `unzip`; Windows: PowerShell `Expand-Archive`), then `@electron/asar extract` the `app.asar`. Merge `app.asar.unpacked/` over the result. The asar holds platform-independent JS/HTML/node_modules — that's why a linux zip runs everywhere.
2. **Install** — `npm install` (Electron 40.1.0 + build tools).
3. **Rebuild** — `@electron/rebuild -f -w sqlite3 -v 40.1.0` compiles `sqlite3` from source against Electron's ABI. The bundled `sqlite3-offline-next` ships prebuilt N-API v3 binaries for **linux-x64, darwin-x64, win32-x64, and win32-ia32** — but **never darwin-arm64**, which is why we rebuild it from source on Apple Silicon. (Verified on an arm64 host: after setup, only the darwin-arm64 binary is freshly written by the patch step; the other four ship inside the asar.)
4. **Patch** — Copy the freshly built `node_sqlite3.node` into where `sqlite3-offline-next` expects it: `sv3-app/node_modules/sqlite3-offline-next/binaries/sqlite3-{platform}/napi-v3-{platform}-{arch}/`.

Idempotency is by artifact-existence checks per step (extracted dir, `node_modules/electron`, the target `node_sqlite3.node`). `--force` deletes/redoes each. Steps are gated individually, so a half-finished setup resumes correctly.

## Updating SV3 to a new DISA release

Version constants are duplicated and **must stay in sync**:
- `ELECTRON_VERSION` and `SV3_VERSION` in `scripts/setup.mjs`
- `electron` in `package.json` dependencies

The correct Electron version is in the `version` file inside the SV3 zip. Standard update: `npm run setup -- --download --force`. If Electron changed, edit the two constants + `package.json` first. The CDN base is `https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/` — `findLatestSv3Url()` scrapes its Apache directory listing for `U_STIGViewer-linux_x64-*.zip` and version-sorts. (The human-facing `cyber.mil/stigs/srg-stig-tools/` page is a dynamic Salesforce app and cannot be scraped — always use the CDN.) The CDN is public (no VPN, no auth) — verified HTTP 200.

## Tracked vs generated

Tracked: `scripts/` (the two entry scripts + `scripts/lib/`), `test/` (`unit/`, `functional/`, `e2e/`, `fixtures/`), `.github/` (CI workflows + issue/PR templates + CODEOWNERS), `package.json`, `package-lock.json`, `eslint.config.mjs`, `playwright.config.mjs`, config dotfiles, `README.md`, `LICENSE`, `NOTICE`, the community-health files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`), `downloads/.gitkeep`. Everything else is generated or user-supplied and gitignored: `node_modules/`, `sv3-app/` (extracted app), `downloads/*.zip` (the ~140MB SV3 zip + hashes), `*.node`, `test-results/`, `playwright-report/`.

## Testing status

The test suite exists and is the diamond/pyramid shape:
- **Unit + functional** (`test/unit/`, `test/functional/`) — `node:test`, run with `npm test` (`node --test 'test/**/*.test.mjs'`). The scoped glob is **mandatory**: a bare `node --test` walks into the extracted `sv3-app/` and runs DISA's bundled tests.
- **E2E** (`test/e2e/*.spec.mjs`) — Playwright `_electron` launches SV3 via this runner, opens a fixture `.cklb`, and asserts rule statuses/comments render. Run with `npm run test:e2e` (`@playwright/test` is a declared devDependency; `playwright.config.mjs` is present). Requires a completed `npm run setup`.
- **CI** — fast tier (lint + `node:test`) runs on push/PR (`.github/workflows/ci.yml`). The full cross-OS matrix (real setup + E2E on ubuntu/macos/windows) is the tu5.8 work.

This CKLB acceptance workflow supports the Heimdall2 CKLB converter (heimdall2 ADR-003).

## Platform build prerequisites

`@electron/rebuild` shells out to `node-gyp`, so a C toolchain must be present: macOS → Xcode Command Line Tools (`xcode-select --install`); Linux → `build-essential` + `python3`; Windows → Visual Studio Build Tools. Build failures here are environment problems, not script bugs.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
